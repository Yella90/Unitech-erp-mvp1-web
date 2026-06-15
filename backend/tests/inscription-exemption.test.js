const assert = require('node:assert/strict');
const test = require('node:test');

const db = require('../database/db');
const systemController = require('../controllers/systemController');
const {
  computeInscriptionForecast,
  buildInscriptionConflictReport,
} = require('../utils/inscriptionForecast');
const { buildSubscriptionAccessStatus } = require('../utils/subscriptionAccess');

const hasPostgresEnv = Boolean(
  process.env.DATABASE_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.POSTGRES_POOLER_URL
  || process.env.POSTGRES_POOLER_UR
);

let postgresTestsEnabled = hasPostgresEnv;
const createdSchoolIds = [];

function makeRes() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return response;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function execStatements(statements = []) {
  for (const statement of statements) {
    await db.query(statement);
  }
}

async function ensurePgTestSchema() {
  await execStatements([
    `
      CREATE TABLE IF NOT EXISTS schools (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE,
        address TEXT,
        plan TEXT DEFAULT 'basic',
        billing TEXT DEFAULT 'monthly',
        current_school_year TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS current_school_year TEXT`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`,
    `
      CREATE TABLE IF NOT EXISTS school_years (
        id BIGSERIAL PRIMARY KEY,
        school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        start_date DATE,
        end_date DATE,
        is_active INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS classes (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        cycle TEXT NOT NULL,
        niveau TEXT NOT NULL,
        mensualite NUMERIC NOT NULL DEFAULT 0,
        frais_inscription NUMERIC DEFAULT 0,
        max_effectif INTEGER NOT NULL DEFAULT 0,
        school_id BIGINT REFERENCES schools(id) ON DELETE CASCADE,
        annee TEXT,
        effectif INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS eleves (
        id BIGSERIAL PRIMARY KEY,
        matricule TEXT UNIQUE NOT NULL,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        date_naissance DATE NOT NULL,
        sexe TEXT,
        date_inscription DATE DEFAULT CURRENT_DATE,
        nom_parent TEXT,
        telephone_parent TEXT,
        classe_actuelle_id BIGINT REFERENCES classes(id) ON DELETE SET NULL,
        ecole_actuelle_id BIGINT REFERENCES schools(id) ON DELETE CASCADE,
        annee_scolaire_id BIGINT REFERENCES school_years(id) ON DELETE SET NULL,
        frais_total NUMERIC DEFAULT 0,
        montant_paye NUMERIC DEFAULT 0,
        reste_a_payer NUMERIC DEFAULT 0,
        etat_paiement TEXT DEFAULT 'non paye',
        dernier_paiement DATE,
        reduction NUMERIC DEFAULT 0,
        exonere_frais_inscription INTEGER DEFAULT 0,
        nombre_absences INTEGER DEFAULT 0,
        absences_justifiees INTEGER DEFAULT 0,
        absences_non_justifiees INTEGER DEFAULT 0,
        retards INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS date_inscription DATE DEFAULT CURRENT_DATE`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS nom_parent TEXT`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS telephone_parent TEXT`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS classe_actuelle_id BIGINT`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS ecole_actuelle_id BIGINT`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS annee_scolaire_id BIGINT`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS frais_total NUMERIC DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS montant_paye NUMERIC DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS reste_a_payer NUMERIC DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS etat_paiement TEXT DEFAULT 'non paye'`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS dernier_paiement DATE`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS reduction NUMERIC DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS exonere_frais_inscription INTEGER DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS nombre_absences INTEGER DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS absences_justifiees INTEGER DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS absences_non_justifiees INTEGER DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS retards INTEGER DEFAULT 0`,
    `ALTER TABLE eleves ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `
      CREATE TABLE IF NOT EXISTS paiements (
        id BIGSERIAL PRIMARY KEY,
        school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        eleve_id BIGINT REFERENCES eleves(id) ON DELETE SET NULL,
        eleve_matricule TEXT,
        montant NUMERIC NOT NULL,
        mois TEXT,
        date_payement DATE,
        mode_payement TEXT,
        annee_scolaire TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    `ALTER TABLE paiements ADD COLUMN IF NOT EXISTS school_year_id BIGINT`,
  ]);
}

async function cleanupSchool(schoolId) {
  if (!schoolId) return;
  await db.query('DELETE FROM paiements WHERE school_id = $1', [schoolId]);
  await db.query('DELETE FROM eleves WHERE ecole_actuelle_id = $1', [schoolId]);
  await db.query('DELETE FROM classes WHERE school_id = $1', [schoolId]);
  await db.query('DELETE FROM school_years WHERE school_id = $1', [schoolId]);
  await db.query('DELETE FROM schools WHERE id = $1', [schoolId]);
}

async function createSchoolFixture(suffix) {
  const schoolYearLabel = `2025-2026-${suffix}`;
  const school = await run(
    `INSERT INTO schools (name, email, plan, billing, current_school_year)
     VALUES (?, ?, 'basic', 'monthly', ?)`,
    [`Ecole test ${suffix}`, `school-${suffix}@example.com`, schoolYearLabel]
  );

  const classRow = await run(
    `INSERT INTO classes (name, cycle, niveau, mensualite, frais_inscription, max_effectif, school_id, annee, effectif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [`Classe ${suffix}`, 'primaire', '1ere', 15000, 8000, 40, school.id, schoolYearLabel]
  );

  createdSchoolIds.push(school.id);

  return {
    schoolId: school.id,
    classId: classRow.id,
    schoolYearLabel,
    className: `Classe ${suffix}`,
  };
}

test.before(async () => {
  if (!hasPostgresEnv) return;
  try {
    await db.query('SELECT 1');
    await ensurePgTestSchema();
    postgresTestsEnabled = true;
  } catch (error) {
    postgresTestsEnabled = false;
    console.warn(`Skipping PostgreSQL integration tests: ${error.message}`);
  }
});

test.afterEach(async () => {
  while (createdSchoolIds.length) {
    const schoolId = createdSchoolIds.pop();
    // Keep test cleanup best-effort so a failing case does not block the next one.
    try {
      await cleanupSchool(schoolId);
    } catch (error) {
      console.error('Cleanup test school failed:', error);
    }
  }
});

test.after(async () => {
  await db.close();
});

function postgresTest(name, fn) {
  test(name, async (t) => {
    if (!postgresTestsEnabled) {
      t.skip('PostgreSQL is not available in this environment');
      return;
    }
    await fn();
  });
}

postgresTest('setup manual student is created without inscription payment', async () => {
  const fixture = await createSchoolFixture('manual');
  const req = {
    user: { school_id: fixture.schoolId },
    body: {
      nom: 'Diallo',
      prenom: 'Aminata',
      classe: fixture.className,
      sexe: 'F',
      dateNaissance: '2012-04-15',
      telparent: '70000000',
      nomparent: 'Oumar Diallo',
    },
  };
  const res = makeRes();

  await systemController.createSetupStudentManual(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(res.body?.id);

  const student = await get('SELECT * FROM eleves WHERE id = $1', [res.body.id]);
  assert.equal(Number(student.exonere_frais_inscription || 0), 1);
  assert.equal(Number(student.frais_total || 0), 0);
  assert.equal(Number(student.montant_paye || 0), 0);
  assert.equal(Number(student.reste_a_payer || 0), 0);
  assert.equal(String(student.etat_paiement || ''), 'paye');

  const paymentCount = await get(
    `SELECT COUNT(*) AS total
     FROM paiements
     WHERE eleve_id = $1 AND LOWER(COALESCE(mois, '')) = 'inscription'`,
    [res.body.id]
  );
  assert.equal(Number(paymentCount.total || 0), 0);

  const classRow = await get('SELECT effectif FROM classes WHERE id = $1', [fixture.classId]);
  assert.equal(Number(classRow.effectif || 0), 1);
});

postgresTest('createPaiement rejects inscription payment for an exempt student', async () => {
  const fixture = await createSchoolFixture('guard');
  const setupReq = {
    user: { school_id: fixture.schoolId },
    body: {
      nom: 'Traore',
      prenom: 'Ibrahim',
      classe: fixture.className,
      sexe: 'M',
      dateNaissance: '2011-09-20',
      telparent: '71000000',
      nomparent: 'Mamadou Traore',
    },
  };
  const setupRes = makeRes();
  await systemController.createSetupStudentManual(setupReq, setupRes);
  const studentId = setupRes.body.id;

  const paymentReq = {
    user: { school_id: fixture.schoolId },
    body: {
      eleve_id: studentId,
      montant: 8000,
      mois: 'inscription',
      date_payement: '2026-06-15',
      mode_payement: 'cash',
      description: "Paiement d'inscription",
    },
  };
  const paymentRes = makeRes();
  await systemController.createPaiement(paymentReq, paymentRes);

  assert.equal(paymentRes.statusCode, 403);
  assert.match(String(paymentRes.body?.error || ''), /exonere/i);

  const paymentCount = await get('SELECT COUNT(*) AS total FROM paiements WHERE eleve_id = $1', [studentId]);
  assert.equal(Number(paymentCount.total || 0), 0);
});

test('forecast helper ignores exempted students for inscription fees', () => {
  const forecast = computeInscriptionForecast([
    {
      name: 'Classe A',
      effectif: 10,
      free_effectif: 2,
      mensualite: 15000,
      frais_inscription: 8000,
    },
    {
      name: 'Classe B',
      effectif: 5,
      free_effectif: 0,
      mensualite: 12000,
      frais_inscription: 6000,
    },
  ]);

  assert.equal(forecast.totalMensuelPrevu, 210000);
  assert.equal(forecast.totalFraisInscriptionPrevu, 94000);
  assert.equal(forecast.totalCumulePrevu, 304000);
  assert.equal(forecast.rows[0].effectif_inscription, 8);
});

test('startup conflict report detects exempt students with inscription payments', () => {
  const report = buildInscriptionConflictReport(
    [
      { id: 1, matricule: 'ELV001', nom: 'Diallo', prenom: 'Awa', exonere_frais_inscription: 1 },
      { id: 2, matricule: 'ELV002', nom: 'Barry', prenom: 'Moussa', exonere_frais_inscription: 0 },
    ],
    [
      { eleve_id: 1, mois: 'inscription', montant: 10000 },
      { eleve_id: 2, mois: 'inscription', montant: 10000 },
    ]
  );

  assert.equal(report.conflictCount, 1);
  assert.equal(report.conflictingStudents[0].matricule, 'ELV001');
  assert.equal(report.conflictingStudents[0].inscriptionPayments, 1);
});

test('active subscription shows days when less than a month remains', () => {
  const status = buildSubscriptionAccessStatus(
    {
      status: 'active',
      billing_cycle: 'monthly',
      created_at: '2026-05-01',
      starts_at: '2026-05-01',
      expires_at: '2026-07-10',
      plan_code: 'basic',
    },
    new Date('2026-06-15T10:00:00Z')
  );

  assert.equal(status.remainingUnit, 'days');
  assert.equal(status.remainingValue, 25);
  assert.match(status.message, /25 jour\(s\)/);
});

test('active subscription shows months when at least one full month remains', () => {
  const status = buildSubscriptionAccessStatus(
    {
      status: 'active',
      billing_cycle: 'annual',
      created_at: '2026-01-01',
      starts_at: '2026-01-01',
      expires_at: '2026-09-15',
      plan_code: 'premium',
    },
    new Date('2026-06-15T10:00:00Z')
  );

  assert.equal(status.remainingUnit, 'months');
  assert.equal(status.remainingValue, 3);
  assert.match(status.message, /3 mois/);
});
