import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';
import SearchableSelect from '../components/SearchableSelect';

const initialForm = {
  eleve_matricule: '',
  montant: '',
  mois: '',
  date_payement: '',
  mode_payement: 'cash',
  annee_scolaire: '',
  description: '',
};

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
}

function toMonthKey(value) {
  return String(value || '').slice(0, 7);
}

function monthLabelFromKey(value) {
  if (!value) return '-';
  const [year, month] = String(value).split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function filterByPeriod(rows, activePeriod, activeMonth, dateKey = 'date_payement') {
  if (activePeriod !== 'monthly') return rows;
  return rows.filter((row) => toMonthKey(row[dateKey] || row.created_at || row.mois) === activeMonth || String(row.mois || '').startsWith(activeMonth));
}

function sumAmount(rows, key = 'montant') {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function Card({ title, value, tone, className = '' }) {
  return (
    <div className={`surface-card premium-card rounded-2xl border p-5 ${tone} ${className}`}>
      <p className="text-sm text-slate-600">{title}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Finances() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState(null);
  const [overview, setOverview] = useState(null);
  const [paiements, setPaiements] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [salaires, setSalaires] = useState([]);
  const [retraits, setRetraits] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const showLoading = usePageLoadingVisibility(loading);

  const activePeriod = searchParams.get('period') || 'annual';
  const activeMonth = searchParams.get('month') || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboardResponse, overviewResponse, paiementsResponse, depensesResponse, salairesResponse, retraitsResponse, elevesResponse, classesResponse] = await Promise.all([
        api.get('/system/dashboard/summary'),
        api.get('/system/finances/overview'),
        api.get('/system/paiements'),
        api.get('/system/depenses'),
        api.get('/system/salaires'),
        api.get('/system/retraits'),
        api.get('/eleves'),
        api.get('/classes'),
      ]);

      const dashboard = dashboardResponse.data || {};
      const monthOptions = dashboard.monthOptions || [];
      const resolvedMonth = activeMonth || dashboard.activeMonth || monthOptions[monthOptions.length - 1]?.value || '';

      if (!searchParams.get('month') && resolvedMonth) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('period', activePeriod);
          next.set('month', resolvedMonth);
          return next;
        }, { replace: true });
      }

      setContext(dashboard);
      setOverview(overviewResponse.data || {});
      setPaiements(paiementsResponse.data || []);
      setDepenses(depensesResponse.data || []);
      setSalaires(salairesResponse.data || []);
      setRetraits(retraitsResponse.data || []);
      setEleves(elevesResponse.data || []);
      setClasses(classesResponse.data || []);
      setFormData((prev) => ({
        ...prev,
        mois: prev.mois || resolvedMonth,
        annee_scolaire: dashboard.currentSchoolYear || '',
      }));
    } catch (err) {
      setError('Erreur lors du chargement des donnees financieres.');
    } finally {
      setLoading(false);
    }
  }, [activeMonth, activePeriod, searchParams, setSearchParams]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPaiements = useMemo(
    () => filterByPeriod(paiements, activePeriod, activeMonth || context?.activeMonth, 'date_payement'),
    [paiements, activePeriod, activeMonth, context]
  );
  const filteredDepenses = useMemo(
    () => filterByPeriod(depenses, activePeriod, activeMonth || context?.activeMonth, 'date_depenses'),
    [depenses, activePeriod, activeMonth, context]
  );
  const filteredSalaires = useMemo(
    () => filterByPeriod(salaires, activePeriod, activeMonth || context?.activeMonth, 'date_payement'),
    [salaires, activePeriod, activeMonth, context]
  );
  const filteredRetraits = useMemo(
    () => filterByPeriod(retraits, activePeriod, activeMonth || context?.activeMonth, 'date_retrait'),
    [retraits, activePeriod, activeMonth, context]
  );

  const summary = useMemo(() => {
    const paiementsTotal = sumAmount(filteredPaiements);
    const depensesTotal = sumAmount(filteredDepenses);
    const salairesTotal = sumAmount(filteredSalaires);
    const retraitsTotal = sumAmount(filteredRetraits);
    return {
      paiements: paiementsTotal,
      depenses: depensesTotal,
      salaires: salairesTotal,
      retraits: retraitsTotal,
      solde: paiementsTotal - depensesTotal - salairesTotal - retraitsTotal,
    };
  }, [filteredPaiements, filteredDepenses, filteredSalaires, filteredRetraits]);

  const tuitionForecast = useMemo(() => {
    const startDate = context?.forecast?.startDate || null;
    const moisEcoules = Number(context?.forecast?.moisEcoules || 0);
    const forecastTotals = context?.forecast || {};
    const classRows = classes.map((classe) => {
      const classPayments = paiements.filter((payment) => {
        const student = eleves.find((row) => row.id === payment.eleve_id);
        return student?.classe_actuelle_id === classe.id;
      });
      const classPaymentsHorsInscription = classPayments.filter((payment) => String(payment.mois || '').toLowerCase() !== 'inscription');
      const classPaymentsInscription = classPayments.filter((payment) => String(payment.mois || '').toLowerCase() === 'inscription');
      const payeCumule = sumAmount(classPayments);
      const payeCumuleHorsInscription = sumAmount(classPaymentsHorsInscription);
      const payeCumuleInscription = sumAmount(classPaymentsInscription);
      const freeInscriptionCount = eleves.filter((student) => (
        Number(student.classe_actuelle_id || 0) === Number(classe.id || 0)
        && Number(student.exonere_frais_inscription || 0) === 1
        && String(student.statut || 'actif').toLowerCase() === 'actif'
      )).length;
      const inscriptionableEffectif = Math.max(Number(classe.effectif || 0) - freeInscriptionCount, 0);
      const attenduMensuel = Number(classe.mensualite || 0) * Number(classe.effectif || 0);
      const attenduInscription = Number(classe.frais_inscription || 0) * inscriptionableEffectif;
      const attenduCumule = attenduMensuel * moisEcoules;
      return {
        id: classe.id,
        nom: classe.name,
        mensualite: Number(classe.mensualite || 0),
        frais_inscription: Number(classe.frais_inscription || 0),
        effectif: Number(classe.effectif || 0),
        effectif_inscription: inscriptionableEffectif,
        effectif_exonere_inscription: freeInscriptionCount,
        attendu_mensuel: attenduMensuel,
        attendu_inscription: attenduInscription,
        attendu_cumule: attenduCumule,
        paye_cumule: payeCumule,
        paye_cumule_hors_inscription: payeCumuleHorsInscription,
        paye_cumule_inscription: payeCumuleInscription,
        reste_cumule: Math.max(attenduCumule + attenduInscription - payeCumule, 0),
      };
    });

    const totalMensuelPrevu = classRows.reduce((sum, row) => sum + row.attendu_mensuel, 0);
    const totalFraisInscriptionPrevu = classRows.reduce((sum, row) => sum + row.attendu_inscription, 0);
    const totalCumulePrevu = classRows.reduce((sum, row) => sum + row.attendu_cumule + row.attendu_inscription, 0);
    const totalPayeCumule = classRows.reduce((sum, row) => sum + row.paye_cumule, 0);
    const totalResteCumule = classRows.reduce((sum, row) => sum + row.reste_cumule, 0);
    const netMensuelPrevu = totalMensuelPrevu - (Number(overview?.totalSalaires || 0) + Number(overview?.totalDepensesDirectes || 0) + Number(overview?.totalRetraits || 0));

    return {
      startDate,
      moisEcoules,
      totalMensuelPrevu: Number(forecastTotals.totalMensuelPrevu || totalMensuelPrevu),
      totalFraisInscriptionPrevu: Number(forecastTotals.totalFraisInscriptionPrevu || totalFraisInscriptionPrevu),
      totalCumulePrevu: Number(forecastTotals.totalCumulePrevu || totalCumulePrevu),
      totalPayeCumule: Number(forecastTotals.totalPayeCumule || totalPayeCumule),
      totalResteCumule: Number(forecastTotals.totalResteCumule || totalResteCumule),
      netMensuelPrevu,
      classes: classRows,
    };
  }, [classes, paiements, eleves, context, overview]);
  const averageDepenses6M = Number(context?.forecast?.moyenneDepenses6M || 0);
  const sortieMensuelleSalaires = Number(context?.forecast?.sortieMensuelleSalaires || 0);
  const sortieMensuellePrevue = Number(context?.forecast?.sortieMensuellePrevue || 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const student = eleves.find((row) => String(row.matricule || '').trim().toLowerCase() === String(formData.eleve_matricule || '').trim().toLowerCase());
      if (!student) {
        throw new Error('Matricule eleve introuvable');
      }

      await api.post('/system/paiements', {
        eleve_id: student.id,
        montant: formData.montant,
        mois: formData.mois,
        date_payement: formData.date_payement,
        mode_payement: formData.mode_payement,
        description: formData.description,
      });

      setFormData((prev) => ({
        ...initialForm,
        mois: prev.mois || context?.activeMonth || '',
        annee_scolaire: context?.currentSchoolYear || '',
      }));
      await load();
      setSuccess('Paiement enregistre avec succes.');
    } catch (err) {
      setError(err.message || err.response?.data?.error || "Erreur lors de l'ajout du paiement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      setError('');
      setSuccess('');
      await api.post(`/system/paiements/${id}/annuler`);
      await load();
      setSuccess('Paiement annule avec succes.');
    } catch (err) {
      setError(err?.response?.data?.error || "Erreur lors de l'annulation du paiement.");
    }
  }

  if (showLoading) {
    return <PageLoadingState title="Chargement des finances" message="Les donnees financieres sont en cours de chargement." />;
  }

  if (error && !overview && !context) {
    return (
      <PageErrorState
        title="Module finances indisponible"
        message={error}
        action={<button type="button" onClick={load} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Reessayer</button>}
      />
    );
  }

  const monthOptions = context?.monthOptions || [];
  const resolvedMonth = activeMonth || context?.activeMonth || '';

  return (
    <section className="app-page space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error && (overview || context) ? 'Action impossible' : ''} message={overview || context ? error : ''} />

      <div className="surface-card premium-card rounded-2xl p-5">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Periode</label>
            <select
              className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              value={activePeriod}
              onChange={(event) => setSearchParams({ period: event.target.value, month: resolvedMonth })}
            >
              <option value="annual">Annuelle</option>
              <option value="monthly">Mensuelle</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mois</label>
            <select
              className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              value={resolvedMonth}
              onChange={(event) => setSearchParams({ period: activePeriod, month: event.target.value })}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button type="button" className="premium-action rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:self-end" onClick={load}>
            Appliquer
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="animate-cascade-1" title={`Paiements ${activePeriod === 'monthly' ? '(mois)' : '(annuel)'}`} value={formatMoney(summary.paiements)} tone="border-emerald-200 bg-emerald-50/60" />
        <Card className="animate-cascade-2" title={`Depenses ${activePeriod === 'monthly' ? '(mois)' : '(annuel)'}`} value={formatMoney(summary.depenses)} tone="border-rose-200 bg-rose-50/60" />
        <Card className="animate-cascade-3" title={`Salaires ${activePeriod === 'monthly' ? '(mois)' : '(annuel)'}`} value={formatMoney(summary.salaires)} tone="border-sky-200 bg-sky-50/60" />
        <Card className="animate-cascade-4" title={`Solde ${activePeriod === 'monthly' ? '(mois)' : '(annuel)'}`} value={formatMoney(summary.solde)} tone="border-indigo-200 bg-indigo-50/60" />
        <Card className="animate-cascade-5" title="Moyenne depenses (6 mois)" value={formatMoney(averageDepenses6M)} tone="border-amber-200 bg-amber-50/60" />
      </div>

      <div className="surface-card premium-card space-y-4 rounded-2xl p-5">
        <h2 className="text-base font-semibold">Prevision revenus par classe</h2>
        <p className="text-xs text-slate-500">
          Date rentree: <strong>{tuitionForecast.startDate || '-'}</strong> | Mois ecoules: <strong>{tuitionForecast.moisEcoules || 0}</strong>
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm">Mensualites prevues: <strong>{formatMoney(tuitionForecast.totalMensuelPrevu)}</strong></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">Frais inscription prevus: <strong>{formatMoney(tuitionForecast.totalFraisInscriptionPrevu)}</strong></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">Total previsionnel global: <strong>{formatMoney(tuitionForecast.totalCumulePrevu)}</strong></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">Cumule paye: <strong>{formatMoney(tuitionForecast.totalPayeCumule)}</strong></div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm">Reste cumule: <strong>{formatMoney(tuitionForecast.totalResteCumule)}</strong></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm">Salaires mensuels prevus: <strong>{formatMoney(sortieMensuelleSalaires)}</strong></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">Moyenne depenses 6 mois: <strong>{formatMoney(averageDepenses6M)}</strong></div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm">Sortie mensuelle prevue: <strong>{formatMoney(sortieMensuellePrevue)}</strong></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 text-left">Classe</th>
                <th className="px-3 py-2 text-left">Mensualite</th>
                <th className="px-3 py-2 text-left">Effectif</th>
                <th className="px-3 py-2 text-left">Attendu mensuel</th>
                <th className="px-3 py-2 text-left">Attendu cumule</th>
                <th className="px-3 py-2 text-left">Paye cumule</th>
                <th className="px-3 py-2 text-left">Reste</th>
              </tr>
            </thead>
            <tbody>
              {tuitionForecast.classes.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{row.nom}</td>
                  <td className="px-3 py-2">{formatMoney(row.mensualite)}</td>
                  <td className="px-3 py-2">{row.effectif}</td>
                  <td className="px-3 py-2">{formatMoney(row.attendu_mensuel)}</td>
                  <td className="px-3 py-2">{formatMoney(row.attendu_cumule)}</td>
                  <td className="px-3 py-2">{formatMoney(row.paye_cumule)}</td>
                  <td className="px-3 py-2 font-medium">{formatMoney(row.reste_cumule)}</td>
                </tr>
              ))}
              {!tuitionForecast.classes.length ? (
                <tr>
                  <td colSpan="7" className="px-3 py-8 text-center text-slate-400">Aucune classe disponible.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card premium-card rounded-2xl p-5">
        <h2 className="text-base font-semibold">Ajouter un paiement</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Matricule eleve</label>
            <SearchableSelect
              value={formData.eleve_matricule}
              onChange={(nextValue, option) =>
                setFormData((prev) => ({
                  ...prev,
                  eleve_matricule: option?.matricule || nextValue || '',
                }))
              }
              placeholder="Rechercher un eleve"
              emptyLabel="Aucun eleve trouve"
              options={eleves.map((eleve) => ({
                value: eleve.matricule || eleve.id,
                label: `${eleve.nom} ${eleve.prenom} (${eleve.matricule || 'sans matricule'})`,
                keywords: `${eleve.matricule || ''} ${eleve.nom || ''} ${eleve.prenom || ''}`,
                matricule: eleve.matricule || '',
              }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Montant</label>
            <input className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" type="number" required value={formData.montant} onChange={(event) => setFormData((prev) => ({ ...prev, montant: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mois</label>
            <select className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={formData.mois} onChange={(event) => setFormData((prev) => ({ ...prev, mois: event.target.value }))} required>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date paiement</label>
            <input className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" type="date" value={formData.date_payement} onChange={(event) => setFormData((prev) => ({ ...prev, date_payement: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mode</label>
            <input className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={formData.mode_payement} onChange={(event) => setFormData((prev) => ({ ...prev, mode_payement: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Annee scolaire</label>
            <input className="premium-control w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2" value={context?.currentSchoolYear || ''} readOnly />
          </div>
          <div className="sm:col-span-2 xl:col-span-6">
            <button className="premium-action rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer paiement'}
            </button>
          </div>
        </form>
      </div>

      <div className="surface-card premium-card overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Paiements recents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left">Matricule</th>
                <th className="px-4 py-3 text-left">Mois</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Montant</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paiements.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">{row.eleve_matricule || '-'}</td>
                  <td className="px-4 py-3">{monthLabelFromKey(row.mois)}</td>
                  <td className="px-4 py-3">{row.mode_payement || '-'}</td>
                  <td className="px-4 py-3">{row.description || '-'}</td>
                  <td className="px-4 py-3 font-medium">{formatMoney(row.montant)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="premium-action rounded-2xl bg-rose-600 px-3 py-1 text-xs text-white hover:bg-rose-700" onClick={() => handleDelete(row.id)}>
                      Annuler
                    </button>
                  </td>
                </tr>
              ))}
              {!paiements.length ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-400">Aucun paiement enregistre.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Finances;
