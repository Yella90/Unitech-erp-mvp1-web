import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function badgeClasses(type) {
  if (type === 'connexion') return 'bg-emerald-100 text-emerald-700';
  return 'bg-sky-100 text-sky-700';
}

function HistoriqueActions() {
  const [payload, setPayload] = useState({
    logs: [],
    filters: { users: [], actions: [], schoolYears: [] },
    summary: { total: 0, connections: 0, operations: 0 },
  });
  const [form, setForm] = useState({
    q: '',
    action: '',
    actor_user_id: '',
    schoolYear: '',
    type: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/system/activity-logs', {
        params: {
          q: form.q || undefined,
          action: form.action || undefined,
          actor_user_id: form.actor_user_id || undefined,
          type: form.type || undefined,
          limit: 300,
        },
      });
      setPayload(response.data || {
        logs: [],
        filters: { users: [], actions: [], schoolYears: [] },
        summary: { total: 0, connections: 0, operations: 0 },
      });
    } catch (err) {
      setError(err.response?.data?.error || "Impossible de charger l'historique des actions.");
    } finally {
      setLoading(false);
    }
  }, [form.q, form.action, form.actor_user_id, form.type]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleLogs = useMemo(() => {
    const selectedYear = normalizeText(form.schoolYear);
    if (!selectedYear) return payload.logs;
    return payload.logs.filter((item) => normalizeText(item.schoolYearLabel) === selectedYear);
  }, [payload.logs, form.schoolYear]);

  const visibleSummary = useMemo(() => ({
    total: visibleLogs.length,
    connections: visibleLogs.filter((item) => item.actionType === 'connexion').length,
    operations: visibleLogs.filter((item) => item.actionType === 'operation').length,
  }), [visibleLogs]);

  if (showLoading) {
    return <PageLoadingState title="Chargement de l'historique" message="Les actions des utilisateurs sont en cours de recuperation." />;
  }

  if (error && payload.logs.length === 0) {
    return (
      <PageErrorState
        title="Historique indisponible"
        message={error}
        action={(
          <button type="button" onClick={load} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Reessayer
          </button>
        )}
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageBanner
        tone="error"
        title={error && payload.logs.length > 0 ? 'Chargement partiel' : ''}
        message={payload.logs.length > 0 ? error : ''}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Suivi des utilisateurs</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Historique des actions</h1>
            <p className="mt-1 text-sm text-slate-500">
              Le directeur et le promoteur peuvent suivre les operations effectuees, y compris les connexions et deconnexions.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Actualiser
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Rechercher un utilisateur, poste, tel..."
            value={form.q}
            onChange={(e) => setForm((prev) => ({ ...prev, q: e.target.value }))}
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={form.actor_user_id}
            onChange={(e) => setForm((prev) => ({ ...prev, actor_user_id: e.target.value }))}
          >
            <option value="">Tous les utilisateurs</option>
            {payload.filters.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.role}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={form.action}
            onChange={(e) => setForm((prev) => ({ ...prev, action: e.target.value }))}
          >
            <option value="">Toutes les actions</option>
            {payload.filters.actions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
          >
            <option value="">Tous les types</option>
            <option value="connexion">Connexions</option>
            <option value="operation">Operations</option>
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={form.schoolYear}
            onChange={(e) => setForm((prev) => ({ ...prev, schoolYear: e.target.value }))}
          >
            <option value="">Toutes les annees scolaires</option>
            {payload.filters.schoolYears.map((year) => (
              <option key={year.id} value={year.label}>
                {year.label}{year.is_active ? ' - active' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Actions affichees</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{visibleSummary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Connexions</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-700">{visibleSummary.connections}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Operations metier</p>
          <p className="mt-3 text-3xl font-semibold text-sky-700">{visibleSummary.operations}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Nom complet</th>
                <th className="px-4 py-3">Telephone</th>
                <th className="px-4 py-3">Poste</th>
                <th className="px-4 py-3">Annee scolaire</th>
                <th className="px-4 py-3">Etablissement</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLogs.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses(item.actionType)}`}>
                      {item.actionType === 'connexion' ? 'Connexion' : 'Operation'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.actionLabel}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.actor.fullName}</div>
                    <div className="text-xs text-slate-500">{item.actor.email || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.actor.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800">{item.actor.occupiedPost || '-'}</div>
                    <div className="text-xs text-slate-500">{item.actor.roleLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.schoolYearLabel || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.schoolName || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.detailsText || '-'}</td>
                </tr>
              ))}
              {visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    Aucune action ne correspond aux filtres actuels.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default HistoriqueActions;
