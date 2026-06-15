import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
}

function toMonthKey(value) {
  return String(value || '').slice(0, 7);
}

function filterByPeriod(rows, activePeriod, activeMonth, dateKey) {
  if (activePeriod !== 'monthly') return rows;
  return rows.filter((row) => toMonthKey(row[dateKey] || row.created_at || row.mois) === activeMonth || String(row.mois || '').startsWith(activeMonth));
}

function sumAmount(rows, key = 'montant') {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function Card({ title, value, tone }) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${tone}`}>
      <p className="text-sm text-slate-600">{title}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function toPersonnelForecastRow(row, source) {
  const salary = Number(row.salaire || row.salaire_base || 0);
  const hourly = Number(row.tauxHoraire || row.taux_horaire || 0);
  return {
    source,
    matricule: row.matricule || '-',
    nom: row.nomComplet || row.full_name || '-',
    poste: row.poste || row.role || row.matiere || '-',
    type_payement: row.typePayement || row.type_payement || (salary > 0 ? 'salaire' : 'tauxHoraire'),
    montant_prevu: salary > 0 ? salary : hourly,
    statut: row.statut || 'actif',
  };
}

function Tresorerie() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [overview, setOverview] = useState(null);
  const [depenses, setDepenses] = useState([]);
  const [salaires, setSalaires] = useState([]);
  const [retraits, setRetraits] = useState([]);
  const [personnels, setPersonnels] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const showLoading = usePageLoadingVisibility(loading);

  const activePeriod = searchParams.get('period') || 'annual';
  const activeMonth = searchParams.get('month') || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboardResponse, tresorerieResponse, depensesResponse, salairesResponse, retraitsResponse, personnelsResponse, enseignantsResponse] = await Promise.all([
        api.get('/system/dashboard/summary'),
        api.get('/system/tresorerie'),
        api.get('/system/depenses'),
        api.get('/system/salaires'),
        api.get('/system/retraits'),
        api.get('/personnels'),
        api.get('/enseignants'),
      ]);

      const dashboardData = dashboardResponse.data || {};
      const monthOptions = dashboardData.monthOptions || [];
      const resolvedMonth = activeMonth || dashboardData.activeMonth || monthOptions[monthOptions.length - 1]?.value || '';

      if (!searchParams.get('month') && resolvedMonth) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('period', activePeriod);
          next.set('month', resolvedMonth);
          return next;
        }, { replace: true });
      }

      setDashboard(dashboardData);
      setOverview(tresorerieResponse.data || {});
      setDepenses(depensesResponse.data || []);
      setSalaires(salairesResponse.data || []);
      setRetraits(retraitsResponse.data || []);
      setPersonnels(personnelsResponse.data || []);
      setEnseignants(enseignantsResponse.data || []);
    } catch (err) {
      setError('Impossible de charger la tresorerie.');
    } finally {
      setLoading(false);
    }
  }, [activeMonth, activePeriod, searchParams, setSearchParams]);

  useEffect(() => {
    load();
  }, [load]);

  const resolvedMonth = activeMonth || dashboard?.activeMonth || '';
  const filteredDepenses = useMemo(() => filterByPeriod(depenses, activePeriod, resolvedMonth, 'date_depenses'), [depenses, activePeriod, resolvedMonth]);
  const filteredSalaires = useMemo(() => filterByPeriod(salaires, activePeriod, resolvedMonth, 'date_payement'), [salaires, activePeriod, resolvedMonth]);
  const filteredRetraits = useMemo(() => filterByPeriod(retraits, activePeriod, resolvedMonth, 'date_retrait'), [retraits, activePeriod, resolvedMonth]);
  const filteredPaiements = useMemo(() => {
    const tx = overview?.transactions || [];
    if (activePeriod !== 'monthly') return tx.filter((row) => row.type === 'revenu');
    return tx.filter((row) => row.type === 'revenu' && toMonthKey(row.date || row.created_at) === resolvedMonth);
  }, [overview, activePeriod, resolvedMonth]);

  const summary = useMemo(() => {
    const paiementsTotal = sumAmount(filteredPaiements, 'amount');
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

  const activeTimeline = useMemo(
    () => dashboard?.timeline?.find((row) => row.key === resolvedMonth) || dashboard?.timeline?.[dashboard?.timeline?.length - 1] || {},
    [dashboard, resolvedMonth]
  );

  const forecastDetails = useMemo(() => {
    const staffRows = [
      ...personnels.map((row) => toPersonnelForecastRow(row, 'Personnel')),
      ...enseignants.map((row) => toPersonnelForecastRow(row, 'Enseignant')),
    ].filter((row) => row.statut !== 'suspendu' && row.matricule !== '-');

    const salairesFixes = Number(activeTimeline.salaires_fixes || 0);
    const salairesHoraires = Number(activeTimeline.salaires_horaires || 0);
    const depensesExactes = Number(activeTimeline.depenses || 0);
    const retraitsExacts = Number(activeTimeline.retraits || 0);
    const totalSortiesExactes = salairesFixes + salairesHoraires + depensesExactes + retraitsExacts;

    return {
      totalActifs: staffRows.length,
      salairesFixes,
      salairesHoraires,
      depensesExactes,
      retraitsExacts,
      totalSortiesExactes,
      details: staffRows,
    };
  }, [personnels, enseignants, activeTimeline]);

  const tuitionForecast = useMemo(() => {
    const forecast = dashboard?.forecast || {};
    return {
      totalMensuelPrevu: Number(forecast.totalMensuelPrevu || 0),
      totalFraisInscriptionPrevu: Number(forecast.totalFraisInscriptionPrevu || 0),
      sortieMensuelleSalaires: Number(forecast.sortieMensuelleSalaires || 0),
      sortieMensuellePrevue: Number(forecast.sortieMensuellePrevue || 0),
      moyenneDepenses6M: Number(forecast.moyenneDepenses6M || 0),
      totalCumulePrevu: Number(forecast.totalCumulePrevu || 0),
      totalResteCumule: Number(forecast.totalResteCumule || 0),
      netMensuelPrevu: Number(activeTimeline.revenus || 0) - forecastDetails.totalSortiesExactes,
    };
  }, [dashboard, forecastDetails, activeTimeline]);

  const mouvements = useMemo(() => overview?.transactions || [], [overview]);

  if (showLoading) {
    return <PageLoadingState title="Chargement de la tresorerie" message="Les mouvements de tresorerie sont en cours de chargement." />;
  }

  if (error && !overview) {
    return <PageErrorState title="Tresorerie indisponible" message={error} action={<button type="button" onClick={load} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Reessayer</button>} />;
  }

  const periodLabel = activePeriod === 'monthly' ? '(mois)' : '(annuel)';
  const monthOptions = dashboard?.monthOptions || [];

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Pilotage de tresorerie</h2>
            <p className="mt-1 text-sm text-slate-500">Suivez le solde, les sorties et les previsions de charge en temps reel.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Solde {periodLabel}: <strong className="text-slate-800">{formatMoney(summary.solde)}</strong>
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Periode</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={activePeriod} onChange={(event) => setSearchParams({ period: event.target.value, month: resolvedMonth })}>
              <option value="annual">Annuelle</option>
              <option value="monthly">Mensuelle</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mois</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={resolvedMonth} onChange={(event) => setSearchParams({ period: activePeriod, month: event.target.value })}>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button type="button" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:self-end" onClick={load}>
            Appliquer
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card title={`Entrees ${periodLabel}`} value={formatMoney(summary.paiements)} tone="border-emerald-200 bg-emerald-50/60" />
        <Card title={`Depenses ${periodLabel}`} value={formatMoney(summary.depenses)} tone="border-rose-200 bg-rose-50/60" />
        <Card title={`Salaires ${periodLabel}`} value={formatMoney(summary.salaires)} tone="border-sky-200 bg-sky-50/60" />
        <Card title={`Retraits ${periodLabel}`} value={formatMoney(summary.retraits)} tone="border-amber-200 bg-amber-50/60" />
        <Card title={`Solde ${periodLabel}`} value={formatMoney(summary.solde)} tone="border-indigo-200 bg-indigo-50/60" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Charges du mois actif (valeurs exactes)</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Actifs: <strong>{forecastDetails.totalActifs}</strong></span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Salaires fixes: <strong>{formatMoney(forecastDetails.salairesFixes)}</strong></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Salaires horaires: <strong>{formatMoney(forecastDetails.salairesHoraires)}</strong></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Depenses: <strong>{formatMoney(forecastDetails.depensesExactes)}</strong></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm xl:col-span-2">Retraits: <strong>{formatMoney(forecastDetails.retraitsExacts)}</strong></div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
          Sorties exactes du mois: <strong>{formatMoney(forecastDetails.totalSortiesExactes)}</strong>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Matricule</th>
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Poste</th>
                <th className="px-3 py-2 text-left">Type paiement</th>
                <th className="px-3 py-2 text-left">Montant prevu</th>
              </tr>
            </thead>
            <tbody>
              {forecastDetails.details.map((row, index) => (
                <tr key={`${row.source}-${row.matricule}-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-2">{row.source}</td>
                  <td className="px-3 py-2">{row.matricule}</td>
                  <td className="px-3 py-2">{row.nom}</td>
                  <td className="px-3 py-2">{row.poste}</td>
                  <td className="px-3 py-2">{row.type_payement}</td>
                  <td className="px-3 py-2 font-medium">{formatMoney(row.montant_prevu)}</td>
                </tr>
              ))}
              {!forecastDetails.details.length ? (
                <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-400">Aucune prevision detaillee disponible.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-base font-semibold">Prevision revenus classes</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">Mensualites prevues: <strong>{formatMoney(tuitionForecast.totalMensuelPrevu)}</strong></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Frais inscription prevus: <strong>{formatMoney(tuitionForecast.totalFraisInscriptionPrevu)}</strong></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">Total previsionnel global: <strong>{formatMoney(tuitionForecast.totalCumulePrevu)}</strong></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">Cumule paye: <strong>{formatMoney(tuitionForecast.totalPayeCumule)}</strong></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">Reste cumule: <strong>{formatMoney(tuitionForecast.totalResteCumule)}</strong></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">Net mensuel exact: <strong>{formatMoney(tuitionForecast.netMensuelPrevu)}</strong></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">Salaires prevus: <strong>{formatMoney(tuitionForecast.sortieMensuelleSalaires)}</strong></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Moyenne des depenses sur 6 mois: <strong>{formatMoney(tuitionForecast.moyenneDepenses6M)}</strong></div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">Sortie mensuelle prevue: <strong>{formatMoney(tuitionForecast.sortieMensuellePrevue)}</strong></div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold">Derniers mouvements</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Montant</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mouvements.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-3">{row.type}</td>
                  <td className="px-5 py-3 font-medium">{formatMoney(row.amount)}</td>
                  <td className="px-5 py-3">{row.date || row.created_at || '-'}</td>
                </tr>
              ))}
              {!mouvements.length ? (
                <tr><td colSpan="3" className="px-5 py-10 text-center text-slate-400">Aucun mouvement recent.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Tresorerie;
