import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function formatMoney(value) {
  return `${Number(value || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;
}

function formatHours(value) {
  return `${Number(value || 0).toFixed(2)} h`;
}

function formatSlots(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

const emptyTrimestreForm = {
  code: 'T1',
  label: '',
  start_date: '',
  end_date: '',
};

const emptyCalendarForm = {
  date_value: '',
  label: '',
  type: 'holiday',
};

function normalizePhoneNumber(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

const emptyTransitionForm = {
  label: '',
  start_date: '',
  end_date: '',
  copy_trimestres: true,
  update_student_school_year: true,
  update_teacher_school_year: true,
  update_staff_school_year: true,
  checklist: {
    confirm_trimestres_ready: false,
    confirm_students_reviewed: false,
    confirm_schedules_reviewed: false,
    confirm_pricing_reviewed: false,
  },
};

function createEmptyTransitionForm() {
  return {
    ...emptyTransitionForm,
    checklist: { ...emptyTransitionForm.checklist },
  };
}

function TrimestresCharges() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [trimestres, setTrimestres] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedTrimestreId, setSelectedTrimestreId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [workloads, setWorkloads] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [calendarDays, setCalendarDays] = useState([]);
  const [transitionContext, setTransitionContext] = useState(null);
  const [transitionForm, setTransitionForm] = useState(createEmptyTransitionForm);
  const [trimestreForm, setTrimestreForm] = useState(emptyTrimestreForm);
  const [calendarForm, setCalendarForm] = useState(emptyCalendarForm);
  const [rowDrafts, setRowDrafts] = useState({});
  const [sendingBulletins, setSendingBulletins] = useState(false);
  const showLoading = usePageLoadingVisibility(loading);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [trimestresResponse, classesResponse, teachersResponse, calendarResponse, transitionContextResponse] = await Promise.all([
        api.get('/system/trimestres'),
        api.get('/classes'),
        api.get('/enseignants'),
        api.get('/system/calendar-days'),
        api.get('/system/school-years/transition-context'),
      ]);
      const trimestreRows = trimestresResponse.data || [];
      const transitionData = transitionContextResponse.data || null;
      setTrimestres(trimestreRows);
      setClasses(classesResponse.data || []);
      setTeachers(teachersResponse.data || []);
      setCalendarDays(calendarResponse.data || []);
      setTransitionContext(transitionData);
      setTransitionForm((prev) => ({
        ...prev,
        label: prev.label || '',
        start_date: prev.start_date || '',
        end_date: prev.end_date || '',
      }));
      // Initialize with first trimestre if none selected
      if (trimestreRows[0]?.id) {
        setSelectedTrimestreId(String(trimestreRows[0].id));
      }
      if (classesResponse.data?.[0]?.id) {
        setSelectedClassId((prev) => prev || String(classesResponse.data[0].id));
      }
    } catch (error) {
      console.error('Erreur chargement trimestres:', error);
      setPageError(error.response?.data?.error || 'Impossible de charger la gestion des trimestres.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkloads = useCallback(async (trimestreId) => {
    if (!trimestreId) {
      setWorkloads([]);
      setRowDrafts({});
      return;
    }
    try {
      const response = await api.get(`/system/trimestres/${trimestreId}/workloads`);
      const rows = response.data || [];
      setWorkloads(rows);
      setRowDrafts(
        rows.reduce((acc, row) => {
          acc[row.id] = {
            adjusted_hours: row.adjusted_hours,
            adjusted_slots: row.adjusted_slots,
            adjusted_enseignant_id: row.adjusted_enseignant_id || row.enseignant_id || '',
            adjustment_reason: row.adjustment_reason || '',
          };
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Erreur chargement charges trimestre:', error);
      setPageError(error.response?.data?.error || 'Impossible de charger les volumes du trimestre.');
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    loadWorkloads(selectedTrimestreId);
  }, [selectedTrimestreId, loadWorkloads]);

  useEffect(() => {
    const currentLabel = transitionContext?.activeYear?.label || '';
    const match = currentLabel.match(/^(\d{4})\s*-\s*(\d{4})$/);
    const currentStart = transitionContext?.activeYear?.start_date || '';
    const currentEnd = transitionContext?.activeYear?.end_date || '';
    if (!match) return;

    setTransitionForm((prev) => {
      if (prev.label && prev.start_date && prev.end_date) return prev;
      const startYear = Number(match[1]) + 1;
      const endYear = Number(match[2]) + 1;
      const nextStart = currentStart ? `${startYear}${currentStart.slice(4)}` : `${startYear}-09-01`;
      const nextEnd = currentEnd ? `${endYear}${currentEnd.slice(4)}` : `${endYear}-06-30`;
      return {
        ...prev,
        label: prev.label || `${startYear}-${endYear}`,
        start_date: prev.start_date || nextStart,
        end_date: prev.end_date || nextEnd,
      };
    });
  }, [transitionContext]);

  const selectedTrimestre = useMemo(
    () => trimestres.find((item) => String(item.id) === String(selectedTrimestreId)) || null,
    [trimestres, selectedTrimestreId]
  );

  const summaries = useMemo(() => {
    const byTeacher = new Map();
    const byClasse = new Map();
    let totalHours = 0;
    let totalSlots = 0;
    let totalForecast = 0;

    workloads.forEach((row) => {
      totalHours += Number(row.adjusted_hours || 0);
      totalSlots += Number(row.adjusted_slots || 0);
      totalForecast += Number(row.forecast_amount || 0);

      const teacherKey = row.adjusted_enseignant_nom || row.enseignant_nom || 'Non assigne';
      if (!byTeacher.has(teacherKey)) {
        byTeacher.set(teacherKey, { name: teacherKey, hours: 0, slots: 0, amount: 0 });
      }
      const teacherEntry = byTeacher.get(teacherKey);
      teacherEntry.hours += Number(row.adjusted_hours || 0);
      teacherEntry.slots += Number(row.adjusted_slots || 0);
      teacherEntry.amount += Number(row.forecast_amount || 0);

      const classeKey = row.classe_nom || 'Classe non definie';
      if (!byClasse.has(classeKey)) {
        byClasse.set(classeKey, { name: classeKey, hours: 0, slots: 0 });
      }
      const classeEntry = byClasse.get(classeKey);
      classeEntry.hours += Number(row.adjusted_hours || 0);
      classeEntry.slots += Number(row.adjusted_slots || 0);
    });

    return {
      totalHours,
      totalSlots,
      totalForecast,
      byTeacher: Array.from(byTeacher.values()).sort((a, b) => b.hours - a.hours),
      byClasse: Array.from(byClasse.values()).sort((a, b) => b.hours - a.hours),
    };
  }, [workloads]);

  const transitionChecklistComplete = useMemo(
    () => Object.values(transitionForm.checklist).every((value) => value === true),
    [transitionForm.checklist]
  );

  async function handleTransitionSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/system/school-years/transition', transitionForm);
      setTransitionContext(response.data?.context || null);
      setTransitionForm(createEmptyTransitionForm());
      setSelectedTrimestreId('');
      setWorkloads([]);
      await loadBase();
      toast.success('La transition d annee a ete effectuee. Vous pouvez maintenant recreer les plannings et verifier les parametres de la nouvelle annee.');
    } catch (error) {
      console.error('Erreur transition annee:', error);
      toast.error(error.response?.data?.error || "Impossible d'effectuer la transition d'annee.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTrimestre(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/system/trimestres', trimestreForm);
      const nextRows = [...trimestres, response.data].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      setTrimestres(nextRows);
      setSelectedTrimestreId(String(response.data.id));
      setTrimestreForm(emptyTrimestreForm);
      toast.success('Trimestre enregistre avec succes.');
    } catch (error) {
      console.error('Erreur creation trimestre:', error);
      toast.error(error.response?.data?.error || 'Impossible de creer le trimestre.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCalendarDay(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/system/calendar-days', calendarForm);
      setCalendarDays(response.data || []);
      setCalendarForm(emptyCalendarForm);
      toast.success('Jour non ouvre ajoute avec succes.');
    } catch (error) {
      console.error('Erreur creation jour non ouvre:', error);
      toast.error(error.response?.data?.error || "Impossible d'ajouter ce jour non ouvre.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCalendarDay(id) {
    try {
      await api.delete(`/system/calendar-days/${id}`);
      setCalendarDays((prev) => prev.filter((item) => item.id !== id));
      toast.success('Jour non ouvre supprime.');
    } catch (error) {
      console.error('Erreur suppression jour non ouvre:', error);
      toast.error(error.response?.data?.error || 'Suppression impossible.');
    }
  }

  async function handleRecompute() {
    if (!selectedTrimestreId) return;
    setSaving(true);
    try {
      const response = await api.post(`/system/trimestres/${selectedTrimestreId}/recompute`);
      const rows = response.data || [];
      setWorkloads(rows);
      setRowDrafts(
        rows.reduce((acc, row) => {
          acc[row.id] = {
            adjusted_hours: row.adjusted_hours,
            adjusted_slots: row.adjusted_slots,
            adjusted_enseignant_id: row.adjusted_enseignant_id || row.enseignant_id || '',
            adjustment_reason: row.adjustment_reason || '',
          };
          return acc;
        }, {})
      );
      toast.success('Volumes trimestriels recalcules.');
    } catch (error) {
      console.error('Erreur recalcul trimestre:', error);
      toast.error(error.response?.data?.error || 'Recalcul impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!selectedTrimestreId) return;
    setSaving(true);
    try {
      const response = await api.post(`/system/trimestres/${selectedTrimestreId}/validate`);
      setTrimestres((prev) => prev.map((item) => (String(item.id) === String(response.data.id) ? response.data : item)));
      setWorkloads((prev) => prev.map((row) => ({ ...row, is_validated: 1 })));
      toast.success('Trimestre valide. Les volumes deviennent la base de reference.');
    } catch (error) {
      console.error('Erreur validation trimestre:', error);
      toast.error(error.response?.data?.error || 'Validation impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRow(workloadId) {
    const draft = rowDrafts[workloadId];
    if (!draft || !selectedTrimestreId) return;
    try {
      const response = await api.put(`/system/trimestres/${selectedTrimestreId}/workloads/${workloadId}`, draft);
      setWorkloads((prev) => prev.map((row) => (row.id === workloadId ? response.data : row)));
      setRowDrafts((prev) => ({
        ...prev,
        [workloadId]: {
          adjusted_hours: response.data.adjusted_hours,
          adjusted_slots: response.data.adjusted_slots,
          adjusted_enseignant_id: response.data.adjusted_enseignant_id || response.data.enseignant_id || '',
          adjustment_reason: response.data.adjustment_reason || '',
        },
      }));
      toast.success('Ajustement enregistre.');
    } catch (error) {
      console.error('Erreur enregistrement charge trimestre:', error);
      toast.error(error.response?.data?.error || "Impossible d'enregistrer cet ajustement.");
    }
  }

  async function handleSendBulletinsWhatsapp() {
    toast('Fonctionnalite non disponible pour l instant. En cours de developpement.');
  }

  if (showLoading) {
    return (
      <div className="p-6">
        <PageLoadingState
          title="Chargement des trimestres"
          message="La configuration des periodes et des charges est en cours de preparation."
        />
      </div>
    );
  }

  if (pageError && !trimestres.length && !calendarDays.length) {
    return (
      <div className="p-6">
        <PageErrorState
          title="Module indisponible"
          message={pageError}
          action={(
            <button
              type="button"
              onClick={loadBase}
                className="premium-action rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Reessayer
            </button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="app-page min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="surface-card premium-card rounded-3xl px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Pilotage academique</p>
              <h1 className="text-2xl font-bold text-slate-900">Trimestres et charges horaires</h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Configurez les trimestres, excluez les jours non travailles, calculez les heures et creneaux par classe, matiere et enseignant,
                puis validez les volumes servant de base au suivi et au paiement des personnels partiels.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                onClick={handleRecompute}
                disabled={!selectedTrimestreId || saving}
                className="premium-action rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? 'Traitement...' : 'Recalculer le trimestre'}
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={!selectedTrimestreId || saving}
                className="premium-action rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Valider les volumes
              </button>
            </div>
          </div>
        </div>

        <div className="surface-card premium-card rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Transition d annee</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Cloturer l annee active et ouvrir la suivante</h2>
              <p className="mt-2 text-sm text-slate-600">
                L historique est conserve. Les nouvelles saisies basculeront sur la nouvelle annee active, tandis que les trimestres valides,
                notes, paiements et autres donnees existantes restent consultables dans les archives.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="premium-card rounded-2xl border border-amber-200 bg-white/90 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Annee active</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{transitionContext?.activeYear?.label || '-'}</p>
              </div>
              <div className="premium-card rounded-2xl border border-amber-200 bg-white/90 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Trimestres valides</p>
                <p className="mt-2 text-lg font-bold text-emerald-700">
                  {transitionContext?.stats?.trimestres?.validated || 0}/{transitionContext?.stats?.trimestres?.total || 0}
                </p>
              </div>
              <div className="premium-card rounded-2xl border border-amber-200 bg-white/90 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Eleves actifs</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{transitionContext?.stats?.eleves?.actifs || 0}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleTransitionSubmit}>
              <input
                className="premium-control rounded-2xl border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Libelle (ex: 2026-2027)"
                value={transitionForm.label}
                onChange={(e) => setTransitionForm((prev) => ({ ...prev, label: e.target.value }))}
              />
              <label className="premium-card flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={transitionForm.copy_trimestres}
                  onChange={(e) => setTransitionForm((prev) => ({ ...prev, copy_trimestres: e.target.checked }))}
                />
                Copier les trimestres en decalant les dates
              </label>
              <input
                className="premium-control rounded-2xl border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                type="date"
                value={transitionForm.start_date}
                onChange={(e) => setTransitionForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
              <input
                className="premium-control rounded-2xl border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                type="date"
                value={transitionForm.end_date}
                onChange={(e) => setTransitionForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
              <label className="premium-card flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={transitionForm.update_student_school_year}
                  onChange={(e) => setTransitionForm((prev) => ({ ...prev, update_student_school_year: e.target.checked }))}
                />
                Mettre a jour l annee scolaire des eleves actifs
              </label>
              <label className="premium-card flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={transitionForm.update_teacher_school_year}
                  onChange={(e) => setTransitionForm((prev) => ({ ...prev, update_teacher_school_year: e.target.checked }))}
                />
                Mettre a jour l annee scolaire des enseignants actifs
              </label>
              <label className="premium-card flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={transitionForm.update_staff_school_year}
                  onChange={(e) => setTransitionForm((prev) => ({ ...prev, update_staff_school_year: e.target.checked }))}
                />
                Mettre a jour l annee scolaire des personnels actifs
              </label>

              <div className="premium-card rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                <p className="text-sm font-semibold text-slate-900">Checklist de verification</p>
                <div className="mt-3 grid gap-3">
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={transitionForm.checklist.confirm_trimestres_ready}
                      onChange={(e) => setTransitionForm((prev) => ({ ...prev, checklist: { ...prev.checklist, confirm_trimestres_ready: e.target.checked } }))}
                    />
                    <span>Le dernier trimestre est valide et aucune saisie academique critique n est encore en attente.</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={transitionForm.checklist.confirm_students_reviewed}
                      onChange={(e) => setTransitionForm((prev) => ({ ...prev, checklist: { ...prev.checklist, confirm_students_reviewed: e.target.checked } }))}
                    />
                    <span>La promotion, le redoublement ou le depart des eleves sera verifie apres ouverture de la nouvelle annee.</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={transitionForm.checklist.confirm_schedules_reviewed}
                      onChange={(e) => setTransitionForm((prev) => ({ ...prev, checklist: { ...prev.checklist, confirm_schedules_reviewed: e.target.checked } }))}
                    />
                    <span>Les emplois du temps et previsions de charge seront recrees ou recalcules pour la nouvelle annee.</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={transitionForm.checklist.confirm_pricing_reviewed}
                      onChange={(e) => setTransitionForm((prev) => ({ ...prev, checklist: { ...prev.checklist, confirm_pricing_reviewed: e.target.checked } }))}
                    />
                    <span>Les frais de scolarite, taux horaires et autres tarifs seront verifies avant les nouvelles saisies.</span>
                  </label>
                </div>
              </div>

              <button
                className="premium-action rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:col-span-2"
                type="submit"
                disabled={saving || !transitionChecklistComplete}
              >
                {saving ? 'Transition en cours...' : "Cloturer l annee et activer la suivante"}
              </button>
            </form>

            <div className="space-y-4">
              <div className="surface-card premium-card rounded-2xl p-5">
                <h3 className="text-base font-semibold text-slate-900">Resume de l annee en cours</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="premium-card rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">Trimestres non valides</p>
                    <p className="mt-1 text-xl font-bold text-rose-600">{transitionContext?.stats?.trimestres?.unvalidated || 0}</p>
                  </div>
                  <div className="premium-card rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">Notes de l annee</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{transitionContext?.stats?.notes?.total || 0}</p>
                  </div>
                  <div className="premium-card rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">Paiements de l annee</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{transitionContext?.stats?.paiements?.total || 0}</p>
                  </div>
                  <div className="premium-card rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">Emplois rattaches</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{transitionContext?.stats?.emplois?.total || 0}</p>
                  </div>
                </div>
              </div>

              <div className="surface-card premium-card rounded-2xl p-5">
                <h3 className="text-base font-semibold text-slate-900">Points a traiter manuellement</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>Creer ou ajuster les nouveaux trimestres si vous ne les copiez pas automatiquement.</p>
                  <p>Recreer ou importer les emplois du temps de la nouvelle annee.</p>
                  <p>Promouvoir, maintenir ou desactiver les eleves selon les decisions de fin d annee.</p>
                  <p>Verifier les affectations classes matieres et les tarifs avant les nouvelles operations.</p>
                </div>
              </div>

              {transitionContext?.warnings?.length ? (
                <div className="premium-card rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <h3 className="text-base font-semibold text-rose-700">Alertes avant transition</h3>
                  <div className="mt-3 space-y-2 text-sm text-rose-700">
                    {transitionContext.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="surface-card premium-card rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Creer un trimestre</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Annee scolaire active: {transitionContext?.activeYear?.label || 'Non definie'}
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {transitionContext?.activeYear?.label || 'Annee active'}
                </span>
              </div>
              <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateTrimestre}>
                <select className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={trimestreForm.code} onChange={(e) => setTrimestreForm((prev) => ({ ...prev, code: e.target.value }))}>
                  <option value="T1">T1</option>
                  <option value="T2">T2</option>
                  <option value="T3">T3</option>
                </select>
                <input className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Libelle (ex: Premier trimestre)" value={trimestreForm.label} onChange={(e) => setTrimestreForm((prev) => ({ ...prev, label: e.target.value }))} />
                <input className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" type="date" value={trimestreForm.start_date} onChange={(e) => setTrimestreForm((prev) => ({ ...prev, start_date: e.target.value }))} />
                <input className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" type="date" value={trimestreForm.end_date} onChange={(e) => setTrimestreForm((prev) => ({ ...prev, end_date: e.target.value }))} />
                <button className="premium-action rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 md:col-span-2" type="submit" disabled={saving}>
                  Enregistrer le trimestre
                </button>
              </form>
            </div>

            <div className="surface-card premium-card rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Jours feries et vacances</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{calendarDays.length} jour(s)</span>
              </div>
              <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3" onSubmit={handleCreateCalendarDay}>
                <input className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" type="date" value={calendarForm.date_value} onChange={(e) => setCalendarForm((prev) => ({ ...prev, date_value: e.target.value }))} />
                <input className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Libelle" value={calendarForm.label} onChange={(e) => setCalendarForm((prev) => ({ ...prev, label: e.target.value }))} />
                <select className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={calendarForm.type} onChange={(e) => setCalendarForm((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="holiday">Jour ferie</option>
                  <option value="vacation">Vacances</option>
                  <option value="closure">Fermeture</option>
                </select>
                <button className="premium-action rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 md:col-span-3" type="submit" disabled={saving}>
                  Ajouter au calendrier
                </button>
              </form>
              <div className="mt-4 space-y-2">
                {calendarDays.length === 0 ? <p className="text-sm text-slate-500">Aucun jour non ouvre enregistre.</p> : null}
                {calendarDays.map((item) => (
                  <div key={item.id} className="premium-card flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.date_value} • {item.type}</p>
                    </div>
                    <button type="button" onClick={() => handleDeleteCalendarDay(item.id)} className="text-sm font-medium text-rose-600 hover:text-rose-700">
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card premium-card rounded-2xl p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Trimestre actif</h2>
                  <p className="text-sm text-slate-500">Selectionnez la periode a calculer et a suivre.</p>
                </div>
                <select
                  className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  value={selectedTrimestreId}
                  onChange={(e) => setSelectedTrimestreId(e.target.value)}
                >
                  <option value="">Selectionner un trimestre</option>
                  {trimestres.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.label} ({item.start_date} au {item.end_date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
                <select
                  className="premium-control rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="">Selectionner une classe</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSendBulletinsWhatsapp}
                  disabled={!selectedTrimestreId || !selectedClassId || sendingBulletins}
                  className="premium-action rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {sendingBulletins ? 'Preparation...' : 'Envoyer les bulletins WhatsApp'}
                </button>
              </div>

              {selectedTrimestre ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="premium-card rounded-2xl bg-indigo-50 p-4">
                    <p className="text-sm text-slate-600">Heures prevues</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-700">{formatHours(summaries.totalHours)}</p>
                  </div>
                  <div className="premium-card rounded-2xl bg-amber-50 p-4">
                    <p className="text-sm text-slate-600">Creneaux prevus</p>
                    <p className="mt-1 text-2xl font-bold text-amber-700">{formatSlots(summaries.totalSlots)}</p>
                  </div>
                  <div className="premium-card rounded-2xl bg-emerald-50 p-4">
                    <p className="text-sm text-slate-600">Impact financier partiels</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoney(summaries.totalForecast)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Creez puis selectionnez un trimestre pour lancer le calcul.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="surface-card premium-card rounded-2xl p-5">
                <h3 className="text-base font-semibold text-slate-900">Synthese par enseignant</h3>
                <div className="mt-4 space-y-3">
                  {summaries.byTeacher.length === 0 ? <p className="text-sm text-slate-500">Aucune charge calculee.</p> : null}
                  {summaries.byTeacher.slice(0, 6).map((item) => (
                    <div key={item.name} className="premium-card rounded-2xl border border-slate-200 bg-white/70 px-3 py-3">
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatHours(item.hours)} • {item.slots} creneau(x) • {formatMoney(item.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="surface-card premium-card rounded-2xl p-5">
                <h3 className="text-base font-semibold text-slate-900">Synthese par classe</h3>
                <div className="mt-4 space-y-3">
                  {summaries.byClasse.length === 0 ? <p className="text-sm text-slate-500">Aucune charge calculee.</p> : null}
                  {summaries.byClasse.slice(0, 6).map((item) => (
                    <div key={item.name} className="premium-card rounded-2xl border border-slate-200 bg-white/70 px-3 py-3">
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatHours(item.hours)} • {item.slots} creneau(x)
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card premium-card rounded-2xl p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tableau des volumes par classe, matiere et enseignant</h2>
              <p className="text-sm text-slate-500">Vous pouvez ajuster les heures, les creneaux, l'enseignant responsable et justifier la modification.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {workloads.length} ligne(s)
            </span>
          </div>

          {!workloads.length ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
              Aucun volume calcule pour ce trimestre. Lancez d'abord le recalcul.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Classe</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Matiere</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Enseignant</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Heures calculees</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Creneaux</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Regle paiement</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Prevision</th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-700">Ajustements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workloads.map((row) => {
                    const draft = rowDrafts[row.id] || {};
                    return (
                      <tr key={row.id} className="align-top">
                        <td className="px-3 py-3 text-slate-700">{row.classe_nom || '-'}</td>
                        <td className="px-3 py-3 text-slate-700">{row.matiere || '-'}</td>
                        <td className="px-3 py-3 text-slate-700">{row.adjusted_enseignant_nom || row.enseignant_nom || '-'}</td>
                        <td className="px-3 py-3 text-slate-700">
                          {formatHours(row.source_hours)}<br />
                          <span className="text-xs text-slate-500">Ajuste: {formatHours(row.adjusted_hours)}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {formatSlots(row.source_slots)}<br />
                          <span className="text-xs text-slate-500">Ajuste: {formatSlots(row.adjusted_slots)}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{row.payment_rule || 'suivi'}</span>
                        </td>
                        <td className="px-3 py-3 font-medium text-emerald-700">{formatMoney(row.forecast_amount)}</td>
                        <td className="px-3 py-3">
                          <div className="grid min-w-[320px] grid-cols-1 gap-2">
                            <input
                              className="premium-control rounded-2xl border border-slate-300 px-3 py-2"
                              type="number"
                              step="0.25"
                              value={draft.adjusted_hours ?? ''}
                              onChange={(e) => setRowDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], adjusted_hours: e.target.value } }))}
                              placeholder="Heures ajustees"
                            />
                            <input
                              className="premium-control rounded-2xl border border-slate-300 px-3 py-2"
                              type="number"
                              value={draft.adjusted_slots ?? ''}
                              onChange={(e) => setRowDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], adjusted_slots: e.target.value } }))}
                              placeholder="Creneaux ajustes"
                            />
                            <select
                              className="premium-control rounded-2xl border border-slate-300 px-3 py-2"
                              value={draft.adjusted_enseignant_id ?? ''}
                              onChange={(e) => setRowDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], adjusted_enseignant_id: e.target.value } }))}
                            >
                              <option value="">Selectionner un enseignant</option>
                              {teachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {teacher.nomComplet || teacher.full_name || teacher.matricule || `Enseignant ${teacher.id}`}
                                </option>
                              ))}
                            </select>
                            <textarea
                              className="premium-control rounded-2xl border border-slate-300 px-3 py-2"
                              rows={2}
                              value={draft.adjustment_reason ?? ''}
                              onChange={(e) => setRowDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], adjustment_reason: e.target.value } }))}
                              placeholder="Justification: sortie pedagogique, heure supplementaire..."
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRow(row.id)}
                              className="premium-action rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                              Enregistrer l'ajustement
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrimestresCharges;
