const db = require('../database/db');

const DAY_TO_INDEX = {
  Lundi: 1,
  Mardi: 2,
  Mercredi: 3,
  Jeudi: 4,
  Vendredi: 5,
  Samedi: 6,
  Dimanche: 0,
};

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function toTrimmed(value) {
  return String(value || '').trim();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeDurationHours(start, end) {
  if (!start || !end) return 0;
  const [startH = 0, startM = 0] = String(start).split(':').map(Number);
  const [endH = 0, endM = 0] = String(end).split(':').map(Number);
  const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  return totalMinutes > 0 ? totalMinutes / 60 : 0;
}

function countMonthsInclusive(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
  return ((endDate.getFullYear() - startDate.getFullYear()) * 12)
    + (endDate.getMonth() - startDate.getMonth())
    + 1;
}

async function getActiveSchoolYearLabel(schoolId) {
  const activeYear = await get(
    'SELECT label FROM school_years WHERE school_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1',
    [schoolId]
  );
  if (activeYear?.label) return activeYear.label;

  const school = await get('SELECT current_school_year FROM schools WHERE id = ?', [schoolId]);
  return school?.current_school_year || null;
}

async function getActiveSchoolYear(schoolId) {
  const activeYear = await get(
    'SELECT id, label FROM school_years WHERE school_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1',
    [schoolId]
  );
  if (activeYear?.id) return activeYear;

  const school = await get('SELECT current_school_year FROM schools WHERE id = ?', [schoolId]);
  if (!school?.current_school_year) return null;
  return {
    id: null,
    label: school.current_school_year,
  };
}

async function resolveTeacherPaymentModel(schoolId, teacherId) {
  if (!teacherId) {
    return {
      paymentRule: 'suivi',
      paymentSchedule: 'fin_trimestre',
      hourlyRate: 0,
      slotRate: 0,
      forfaitAmount: 0,
      monthlySalary: 0,
    };
  }

  const teacher = await get(
    `SELECT id,
            COALESCE(typePayement, type_payement, '') AS type_payement,
            COALESCE(tauxHoraire, taux_horaire, 0) AS taux_horaire,
            salaire,
            regle_paiement_partiel,
            montant_creneau,
            montant_forfait_trimestre,
            echeance_paiement
       FROM enseignants
      WHERE id = ? AND school_id = ?`,
    [teacherId, schoolId]
  );

  if (!teacher) {
    return {
      paymentRule: 'suivi',
      paymentSchedule: 'fin_trimestre',
      hourlyRate: 0,
      slotRate: 0,
      forfaitAmount: 0,
      monthlySalary: 0,
    };
  }

  const explicitRule = toTrimmed(teacher.regle_paiement_partiel);
  let paymentRule = explicitRule || '';
  if (!paymentRule) {
    if (toNumber(teacher.montant_creneau) > 0) {
      paymentRule = 'creneau';
    } else if (toNumber(teacher.montant_forfait_trimestre) > 0) {
      paymentRule = 'forfait_trimestre';
    } else if (teacher.type_payement === 'tauxHoraire' || toNumber(teacher.taux_horaire) > 0) {
      paymentRule = 'heure';
    } else if (toNumber(teacher.salaire) > 0) {
      paymentRule = 'salaire_fixe';
    } else {
      paymentRule = 'suivi';
    }
  }

  return {
    paymentRule,
    paymentSchedule: toTrimmed(teacher.echeance_paiement) || 'fin_trimestre',
    hourlyRate: toNumber(teacher.taux_horaire),
    slotRate: toNumber(teacher.montant_creneau),
    forfaitAmount: toNumber(teacher.montant_forfait_trimestre),
    monthlySalary: toNumber(teacher.salaire),
  };
}

function computeForecastAmount(workload, options = {}) {
  const rule = toTrimmed(workload.paymentRule || workload.payment_rule);
  const trimestreMonths = toNumber(
    options.trimestreMonths
      ?? workload.trimestre_months
      ?? countMonthsInclusive(parseDate(workload.trimestre_start_date), parseDate(workload.trimestre_end_date))
  );
  const monthlySalary = toNumber(options.monthlySalary ?? workload.monthly_salary ?? workload.salaire ?? workload.salaire_base);
  if (rule === 'heure') {
    return toNumber(workload.adjusted_hours) * toNumber(workload.hourly_rate);
  }
  if (rule === 'creneau') {
    return toNumber(workload.adjusted_slots) * toNumber(workload.slot_rate);
  }
  if (rule === 'forfait_trimestre') {
    return toNumber(workload.forfait_amount);
  }
  if (rule === 'salaire_fixe') {
    return monthlySalary * trimestreMonths;
  }
  return 0;
}

function normalizeWorkloadRow(row) {
  const computedForecastAmount = computeForecastAmount(row);
  const storedForecastAmount = toNumber(row.forecast_amount);
  const forecastAmount = storedForecastAmount > 0 || computedForecastAmount === 0
    ? storedForecastAmount
    : computedForecastAmount;
  return {
    ...row,
    source_hours: toNumber(row.source_hours),
    source_slots: toNumber(row.source_slots),
    adjusted_hours: toNumber(row.adjusted_hours),
    adjusted_slots: toNumber(row.adjusted_slots),
    hourly_rate: toNumber(row.hourly_rate),
    slot_rate: toNumber(row.slot_rate),
    forfait_amount: toNumber(row.forfait_amount),
    forecast_amount: toNumber(forecastAmount),
    is_manual_override: Number(row.is_manual_override || 0),
    is_validated: Number(row.is_validated || 0),
  };
}

function countMatchingDates(startDate, endDate, dayIndex, excludedDates) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  let total = 0;
  while (current <= end) {
    const isoDate = formatDate(current);
    if (current.getDay() === dayIndex && !excludedDates.has(isoDate)) {
      total += 1;
    }
    current.setDate(current.getDate() + 1);
  }
  return total;
}

async function rebuildWorkloadsForTrimestre(schoolId, trimestreId) {
  const trimestre = await get(
    'SELECT * FROM trimestres WHERE id = ? AND school_id = ?',
    [trimestreId, schoolId]
  );
  if (!trimestre) {
    const error = new Error('Trimestre introuvable');
    error.statusCode = 404;
    throw error;
  }

  const startDate = parseDate(trimestre.start_date);
  const endDate = parseDate(trimestre.end_date);
  if (!startDate || !endDate || startDate > endDate) {
    const error = new Error('Les dates du trimestre sont invalides');
    error.statusCode = 400;
    throw error;
  }
  const trimestreMonths = countMonthsInclusive(startDate, endDate);

  const [holidayRows, emplois, existingRows] = await Promise.all([
    all('SELECT date_value FROM school_calendar_days WHERE school_id = ? AND date_value BETWEEN ? AND ?', [schoolId, trimestre.start_date, trimestre.end_date]),
    all(
      `SELECT em.id,
              em.affectation_id,
              em.jour,
              em.heure_debut,
              em.heure_fin,
              a.classe_id,
              c.name AS classe_nom,
              a.nom_matiere AS matiere,
              a.enseignant_id,
              e.nomComplet AS enseignant_nom
         FROM emplois em
         LEFT JOIN affectation a ON a.id = em.affectation_id
         LEFT JOIN classes c ON CAST(c.id AS TEXT) = CAST(a.classe_id AS TEXT)
         LEFT JOIN enseignants e ON CAST(e.id AS TEXT) = CAST(a.enseignant_id AS TEXT)
        WHERE em.school_id = ?
          AND a.id IS NOT NULL`,
      [schoolId]
    ),
    all('SELECT * FROM trimestre_workloads WHERE trimestre_id = ? AND school_id = ?', [trimestreId, schoolId]),
  ]);

  const excludedDates = new Set((holidayRows || []).map((row) => row.date_value));
  const existingByAffectation = new Map(existingRows.map((row) => [String(row.affectation_id || ''), normalizeWorkloadRow(row)]));
  const aggregates = new Map();

  for (const row of emplois) {
    const affectationId = String(row.affectation_id || '');
    if (!affectationId) continue;

    const dayIndex = DAY_TO_INDEX[row.jour];
    if (dayIndex === undefined) continue;

    const slots = countMatchingDates(startDate, endDate, dayIndex, excludedDates);
    const durationHours = computeDurationHours(row.heure_debut, row.heure_fin);
    const totalHours = slots * durationHours;

    if (!aggregates.has(affectationId)) {
      aggregates.set(affectationId, {
        affectationId: row.affectation_id,
        classeId: row.classe_id,
        classeNom: row.classe_nom || '',
        matiere: row.matiere || '',
        enseignantId: row.enseignant_id,
        enseignantNom: row.enseignant_nom || '',
        sourceHours: 0,
        sourceSlots: 0,
      });
    }

    const aggregate = aggregates.get(affectationId);
    aggregate.sourceHours += totalHours;
    aggregate.sourceSlots += slots;
  }

  const processedIds = new Set();

  for (const aggregate of aggregates.values()) {
    const existing = existingByAffectation.get(String(aggregate.affectationId));
    const assignedTeacherId = existing?.is_manual_override && existing.adjusted_enseignant_id
      ? existing.adjusted_enseignant_id
      : aggregate.enseignantId;
    const paymentModel = await resolveTeacherPaymentModel(schoolId, assignedTeacherId);
    const adjustedHours = existing?.is_manual_override ? existing.adjusted_hours : aggregate.sourceHours;
    const adjustedSlots = existing?.is_manual_override ? existing.adjusted_slots : aggregate.sourceSlots;
    const adjustedTeacherId = existing?.is_manual_override && existing.adjusted_enseignant_id
      ? existing.adjusted_enseignant_id
      : aggregate.enseignantId;
    const adjustedTeacherName = existing?.is_manual_override && existing.adjusted_enseignant_nom
      ? existing.adjusted_enseignant_nom
      : aggregate.enseignantNom;

    const data = {
      school_id: schoolId,
      trimestre_id: trimestreId,
      affectation_id: aggregate.affectationId,
      classe_id: aggregate.classeId,
      classe_nom: aggregate.classeNom,
      matiere: aggregate.matiere,
      enseignant_id: aggregate.enseignantId,
      enseignant_nom: aggregate.enseignantNom,
      source_hours: Number(aggregate.sourceHours.toFixed(2)),
      source_slots: aggregate.sourceSlots,
      adjusted_hours: Number(adjustedHours.toFixed(2)),
      adjusted_slots: adjustedSlots,
      adjusted_enseignant_id: adjustedTeacherId || null,
      adjusted_enseignant_nom: adjustedTeacherName || '',
      adjustment_reason: existing?.adjustment_reason || null,
      payment_rule: paymentModel.paymentRule,
      payment_schedule: paymentModel.paymentSchedule,
      hourly_rate: paymentModel.hourlyRate,
      slot_rate: paymentModel.slotRate,
      forfait_amount: paymentModel.forfaitAmount,
      is_manual_override: existing?.is_manual_override ? 1 : 0,
      is_validated: Number(trimestre.is_validated || 0),
    };
    data.forecast_amount = computeForecastAmount(data, {
      monthlySalary: paymentModel.monthlySalary,
      trimestreMonths,
    });

    if (existing) {
      await run(
        `UPDATE trimestre_workloads
            SET classe_id = ?, classe_nom = ?, matiere = ?, enseignant_id = ?, enseignant_nom = ?,
                source_hours = ?, source_slots = ?, adjusted_hours = ?, adjusted_slots = ?,
                adjusted_enseignant_id = ?, adjusted_enseignant_nom = ?, adjustment_reason = ?,
                payment_rule = ?, payment_schedule = ?, hourly_rate = ?, slot_rate = ?, forfait_amount = ?,
                forecast_amount = ?, is_manual_override = ?, is_validated = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND school_id = ?`,
        [
          data.classe_id,
          data.classe_nom,
          data.matiere,
          data.enseignant_id,
          data.enseignant_nom,
          data.source_hours,
          data.source_slots,
          data.adjusted_hours,
          data.adjusted_slots,
          data.adjusted_enseignant_id,
          data.adjusted_enseignant_nom,
          data.adjustment_reason,
          data.payment_rule,
          data.payment_schedule,
          data.hourly_rate,
          data.slot_rate,
          data.forfait_amount,
          data.forecast_amount,
          data.is_manual_override,
          data.is_validated,
          existing.id,
          schoolId,
        ]
      );
      processedIds.add(existing.id);
    } else {
      const result = await run(
        `INSERT INTO trimestre_workloads
          (school_id, trimestre_id, affectation_id, classe_id, classe_nom, matiere, enseignant_id, enseignant_nom,
           source_hours, source_slots, adjusted_hours, adjusted_slots, adjusted_enseignant_id, adjusted_enseignant_nom,
           adjustment_reason, payment_rule, payment_schedule, hourly_rate, slot_rate, forfait_amount, forecast_amount,
           is_manual_override, is_validated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.school_id,
          data.trimestre_id,
          data.affectation_id,
          data.classe_id,
          data.classe_nom,
          data.matiere,
          data.enseignant_id,
          data.enseignant_nom,
          data.source_hours,
          data.source_slots,
          data.adjusted_hours,
          data.adjusted_slots,
          data.adjusted_enseignant_id,
          data.adjusted_enseignant_nom,
          data.adjustment_reason,
          data.payment_rule,
          data.payment_schedule,
          data.hourly_rate,
          data.slot_rate,
          data.forfait_amount,
          data.forecast_amount,
          data.is_manual_override,
          data.is_validated,
        ]
      );
      processedIds.add(result.id);
    }
  }

  for (const row of existingRows) {
    if (!processedIds.has(row.id)) {
      await run('DELETE FROM trimestre_workloads WHERE id = ? AND school_id = ?', [row.id, schoolId]);
    }
  }

  return all(
    `SELECT tw.*,
            t.code AS trimestre_code,
            t.label AS trimestre_label,
            t.start_date AS trimestre_start_date,
            t.end_date AS trimestre_end_date,
            COALESCE(e.salaire, e.salaire_base, 0) AS monthly_salary
       FROM trimestre_workloads tw
       LEFT JOIN trimestres t ON t.id = tw.trimestre_id
       LEFT JOIN enseignants e ON CAST(e.id AS TEXT) = CAST(COALESCE(tw.adjusted_enseignant_id, tw.enseignant_id) AS TEXT) AND e.school_id = tw.school_id
      WHERE tw.trimestre_id = ? AND tw.school_id = ?
      ORDER BY tw.classe_nom, tw.matiere, COALESCE(tw.adjusted_enseignant_nom, tw.enseignant_nom)`,
    [trimestreId, schoolId]
  );
}

exports.listTrimestres = async (req, res) => {
  try {
    const rows = await all(
      `SELECT t.*,
              (SELECT COUNT(*) FROM trimestre_workloads tw WHERE tw.trimestre_id = t.id) AS workload_count
         FROM trimestres t
        WHERE t.school_id = ?
        ORDER BY t.start_date ASC, t.id ASC`,
      [req.user.school_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erreur liste trimestres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.createTrimestre = async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const code = toTrimmed(req.body.code);
    const label = toTrimmed(req.body.label) || code;
    const startDate = toTrimmed(req.body.start_date);
    const endDate = toTrimmed(req.body.end_date);
    const schoolYearLabel = toTrimmed(req.body.school_year_label) || (await getActiveSchoolYearLabel(schoolId));
    const activeSchoolYear = await getActiveSchoolYear(schoolId);

    if (!code || !startDate || !endDate) {
      return res.status(400).json({ error: 'Code, date de debut et date de fin requis' });
    }

    if (!parseDate(startDate) || !parseDate(endDate) || parseDate(startDate) > parseDate(endDate)) {
      return res.status(400).json({ error: 'Les dates du trimestre sont invalides' });
    }

    const result = await run(
      `INSERT INTO trimestres (school_id, school_year_id, school_year_label, code, label, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, activeSchoolYear?.id || null, schoolYearLabel || null, code, label, startDate, endDate]
    );

    const row = await get('SELECT * FROM trimestres WHERE id = ? AND school_id = ?', [result.id, schoolId]);
    res.status(201).json(row);
  } catch (error) {
    console.error('Erreur creation trimestre:', error);
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ce trimestre existe deja pour cette annee scolaire' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.updateTrimestre = async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const trimestreId = req.params.id;
    const current = await get('SELECT * FROM trimestres WHERE id = ? AND school_id = ?', [trimestreId, schoolId]);
    if (!current) {
      return res.status(404).json({ error: 'Trimestre introuvable' });
    }

    const code = toTrimmed(req.body.code) || current.code;
    const label = toTrimmed(req.body.label) || current.label;
    const startDate = toTrimmed(req.body.start_date) || current.start_date;
    const endDate = toTrimmed(req.body.end_date) || current.end_date;
    const schoolYearLabel = toTrimmed(req.body.school_year_label) || current.school_year_label;

    if (!parseDate(startDate) || !parseDate(endDate) || parseDate(startDate) > parseDate(endDate)) {
      return res.status(400).json({ error: 'Les dates du trimestre sont invalides' });
    }

    await run(
      `UPDATE trimestres
          SET code = ?, label = ?, school_year_label = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND school_id = ?`,
      [code, label, schoolYearLabel || null, startDate, endDate, trimestreId, schoolId]
    );

    const updated = await get('SELECT * FROM trimestres WHERE id = ? AND school_id = ?', [trimestreId, schoolId]);
    res.json(updated);
  } catch (error) {
    console.error('Erreur mise a jour trimestre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.listCalendarDays = async (req, res) => {
  try {
    const rows = await all(
      'SELECT * FROM school_calendar_days WHERE school_id = ? ORDER BY date_value ASC, id ASC',
      [req.user.school_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erreur liste calendrier:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.createCalendarDay = async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const dateValue = toTrimmed(req.body.date_value);
    const label = toTrimmed(req.body.label);
    const type = toTrimmed(req.body.type) || 'holiday';

    if (!dateValue || !label) {
      return res.status(400).json({ error: 'Date et libelle requis' });
    }

    await run(
      'INSERT INTO school_calendar_days (school_id, date_value, label, type) VALUES (?, ?, ?, ?)',
      [schoolId, dateValue, label, type]
    );
    const rows = await all(
      'SELECT * FROM school_calendar_days WHERE school_id = ? ORDER BY date_value ASC, id ASC',
      [schoolId]
    );
    res.status(201).json(rows);
  } catch (error) {
    console.error('Erreur creation jour non ouvre:', error);
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Une entree existe deja pour cette date' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.deleteCalendarDay = async (req, res) => {
  try {
    await run('DELETE FROM school_calendar_days WHERE id = ? AND school_id = ?', [req.params.id, req.user.school_id]);
    res.json({ message: 'Jour supprime' });
  } catch (error) {
    console.error('Erreur suppression jour non ouvre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.recomputeTrimestreLoads = async (req, res) => {
  try {
    const rows = await rebuildWorkloadsForTrimestre(req.user.school_id, req.params.id);
    res.json(rows.map(normalizeWorkloadRow));
  } catch (error) {
    console.error('Erreur recalcul trimestre:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erreur serveur' });
  }
};

exports.listTrimestreWorkloads = async (req, res) => {
  try {
    const rows = await all(
      `SELECT tw.*,
              t.code AS trimestre_code,
              t.label AS trimestre_label,
              t.start_date AS trimestre_start_date,
              t.end_date AS trimestre_end_date,
              COALESCE(e.salaire, e.salaire_base, 0) AS monthly_salary
         FROM trimestre_workloads tw
         LEFT JOIN trimestres t ON t.id = tw.trimestre_id
       LEFT JOIN enseignants e ON CAST(e.id AS TEXT) = CAST(COALESCE(tw.adjusted_enseignant_id, tw.enseignant_id) AS TEXT) AND e.school_id = tw.school_id
        WHERE tw.trimestre_id = ? AND tw.school_id = ?
        ORDER BY tw.classe_nom, tw.matiere, COALESCE(tw.adjusted_enseignant_nom, tw.enseignant_nom)`,
      [req.params.id, req.user.school_id]
    );
    res.json(rows.map(normalizeWorkloadRow));
  } catch (error) {
    console.error('Erreur liste charges trimestre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.updateTrimestreWorkload = async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const trimestre = await get('SELECT start_date, end_date FROM trimestres WHERE id = ? AND school_id = ?', [req.params.id, schoolId]);
    const trimestreMonths = countMonthsInclusive(parseDate(trimestre?.start_date), parseDate(trimestre?.end_date));
    const workload = await get(
      'SELECT * FROM trimestre_workloads WHERE id = ? AND trimestre_id = ? AND school_id = ?',
      [req.params.workloadId, req.params.id, schoolId]
    );
    if (!workload) {
      return res.status(404).json({ error: 'Charge trimestrielle introuvable' });
    }

    const adjustedHours = req.body.adjusted_hours === undefined ? toNumber(workload.adjusted_hours) : toNumber(req.body.adjusted_hours);
    const adjustedSlots = req.body.adjusted_slots === undefined ? toNumber(workload.adjusted_slots) : toNumber(req.body.adjusted_slots);
    const adjustedTeacherId = req.body.adjusted_enseignant_id === undefined
      ? workload.adjusted_enseignant_id || workload.enseignant_id
      : req.body.adjusted_enseignant_id;
    const adjustmentReason = toTrimmed(req.body.adjustment_reason) || null;

    let adjustedTeacherName = workload.adjusted_enseignant_nom || workload.enseignant_nom || '';
    if (adjustedTeacherId) {
      const teacher = await get('SELECT nomComplet FROM enseignants WHERE id = ? AND school_id = ?', [adjustedTeacherId, schoolId]);
      if (teacher?.nomComplet) adjustedTeacherName = teacher.nomComplet;
    }

    const paymentModel = await resolveTeacherPaymentModel(schoolId, adjustedTeacherId);
    const payload = {
      adjusted_hours: Number(adjustedHours.toFixed(2)),
      adjusted_slots: Math.max(0, Math.round(adjustedSlots)),
      adjusted_enseignant_id: adjustedTeacherId || null,
      adjusted_enseignant_nom: adjustedTeacherName,
      adjustment_reason: adjustmentReason,
      payment_rule: paymentModel.paymentRule,
      payment_schedule: paymentModel.paymentSchedule,
      hourly_rate: paymentModel.hourlyRate,
      slot_rate: paymentModel.slotRate,
      forfait_amount: paymentModel.forfaitAmount,
      is_manual_override: 1,
    };
    payload.forecast_amount = computeForecastAmount(payload, {
      monthlySalary: paymentModel.monthlySalary,
      trimestreMonths,
    });

    await run(
      `UPDATE trimestre_workloads
          SET adjusted_hours = ?, adjusted_slots = ?, adjusted_enseignant_id = ?, adjusted_enseignant_nom = ?,
              adjustment_reason = ?, payment_rule = ?, payment_schedule = ?, hourly_rate = ?, slot_rate = ?,
              forfait_amount = ?, forecast_amount = ?, is_manual_override = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND trimestre_id = ? AND school_id = ?`,
      [
        payload.adjusted_hours,
        payload.adjusted_slots,
        payload.adjusted_enseignant_id,
        payload.adjusted_enseignant_nom,
        payload.adjustment_reason,
        payload.payment_rule,
        payload.payment_schedule,
        payload.hourly_rate,
        payload.slot_rate,
        payload.forfait_amount,
        payload.forecast_amount,
        payload.is_manual_override,
        req.params.workloadId,
        req.params.id,
        schoolId,
      ]
    );

    const updated = await get(
      'SELECT * FROM trimestre_workloads WHERE id = ? AND trimestre_id = ? AND school_id = ?',
      [req.params.workloadId, req.params.id, schoolId]
    );
    res.json(normalizeWorkloadRow(updated));
  } catch (error) {
    console.error('Erreur mise a jour charge trimestrielle:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.validateTrimestre = async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const trimestreId = req.params.id;

    await run(
      `UPDATE trimestres
          SET is_validated = 1, validated_at = CURRENT_TIMESTAMP, validated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND school_id = ?`,
      [req.user.id, trimestreId, schoolId]
    );
    await run(
      `UPDATE trimestre_workloads
          SET is_validated = 1, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE trimestre_id = ? AND school_id = ?`,
      [trimestreId, schoolId]
    );

    const trimestre = await get('SELECT * FROM trimestres WHERE id = ? AND school_id = ?', [trimestreId, schoolId]);
    res.json(trimestre);
  } catch (error) {
    console.error('Erreur validation trimestre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
