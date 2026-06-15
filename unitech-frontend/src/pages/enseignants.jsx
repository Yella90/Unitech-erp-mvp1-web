import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

const initialFormData = {
  nomComplet: '',
  email: '',
  telephone: '',
  matiere: '',
  typePayement: 'salaire',
  statut: 'actif',
  salaire: '',
  tauxHoraire: '',
};

function formatMontant(enseignant) {
  if (enseignant.typePayement === 'tauxHoraire') {
    return enseignant.tauxHoraire ? `${enseignant.tauxHoraire} F / h` : '-';
  }
  return enseignant.salaire ? `${Number(enseignant.salaire).toLocaleString('fr-FR')} F` : '-';
}

function Enseignants() {
  const [enseignants, setEnseignants] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedAccount, setGeneratedAccount] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const showLoading = usePageLoadingVisibility(loading);

  const loadPageData = async () => {
    setLoading(true);
    setError('');

    try {
      const [enseignantsResponse, matieresResponse] = await Promise.all([
        api.get('/enseignants'),
        api.get('/matieres'),
      ]);
      setEnseignants(enseignantsResponse.data || []);
      setMatieres(matieresResponse.data || []);
    } catch (err) {
      console.error('Erreur chargement enseignants:', err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      setError('Erreur lors du chargement des enseignants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredEnseignants = enseignants.filter((enseignant) => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return true;
    const haystack = `${enseignant.nomComplet || ''} ${enseignant.matricule || ''}`.toLowerCase();
    return haystack.includes(needle);
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'typePayement') {
        if (value === 'salaire') next.tauxHoraire = '';
        if (value === 'tauxHoraire') next.salaire = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setGeneratedAccount(null);

    if (!formData.nomComplet || !formData.email || !formData.telephone || !formData.matiere) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.typePayement === 'salaire' && !formData.salaire) {
      setError('Le salaire est obligatoire pour un enseignant paye au salaire.');
      return;
    }

    if (formData.typePayement === 'tauxHoraire' && !formData.tauxHoraire) {
      setError("Le taux horaire est obligatoire pour un enseignant paye a l'heure.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        salaire: formData.typePayement === 'salaire' ? Number(formData.salaire) : null,
        tauxHoraire: formData.typePayement === 'tauxHoraire' ? Number(formData.tauxHoraire) : null,
      };

      const response = await api.post('/enseignants', payload);
      setSuccess('Enseignant ajoute avec succes.');
      setGeneratedAccount(response.data?.compte || null);
      setFormData(initialFormData);
      await loadPageData();
    } catch (err) {
      console.error('Erreur ajout enseignant:', err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      setError(err?.response?.data?.error || "Erreur lors de l'ajout de l'enseignant.");
      setGeneratedAccount(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (enseignantId) => {
    const confirmed = window.confirm('Supprimer cet enseignant ?');
    if (!confirmed) return;

    setDeletingId(enseignantId);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/enseignants/${enseignantId}`);
      setEnseignants((prev) => prev.filter((enseignant) => enseignant.id !== enseignantId));
      setSuccess('Enseignant supprime avec succes.');
    } catch (err) {
      console.error('Erreur suppression enseignant:', err);
      if (err?.response?.status === 401) {
        window.location.assign('/login');
        return;
      }
      setError(err?.response?.data?.error || "Erreur lors de la suppression de l'enseignant.");
    } finally {
      setDeletingId(null);
    }
  };

  if (showLoading) {
    return <PageLoadingState title="Chargement des enseignants" message="Les enseignants et les matieres sont en cours de chargement." />;
  }

  if (error && enseignants.length === 0) {
    return (
      <PageErrorState
        title="Liste des enseignants indisponible"
        message={error}
        action={
          <button
            type="button"
            onClick={loadPageData}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reessayer
          </button>
        }
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error && enseignants.length > 0 ? 'Action impossible' : ''} message={enseignants.length > 0 ? error : ''} />
      {generatedAccount ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Compte de connexion cree.</p>
          <p className="mt-1">Email: {generatedAccount.email}</p>
          <p>Role: {generatedAccount.role}</p>
          <p>Mot de passe genere: {generatedAccount.mot_de_passe_genere}</p>
        </div>
      ) : null}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Nouvel enseignant</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Le matricule est genere automatiquement lors de la creation.
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom complet</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="nomComplet"
              value={formData.nomComplet}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Telephone</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="telephone"
              value={formData.telephone}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Matiere</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="matiere"
              value={formData.matiere}
              onChange={handleChange}
              required
              disabled={!matieres.length}
            >
              <option value="">Selectionner une matiere</option>
              {matieres.map((matiere) => (
                <option key={matiere.id || matiere.nom} value={matiere.nom}>
                  {matiere.nom}
                </option>
              ))}
            </select>
            {!matieres.length ? (
              <p className="mt-1 text-xs text-amber-700">
                Aucune matiere disponible. Ajoutez d&apos;abord une matiere dans la section Matieres.
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type paiement</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="typePayement"
              value={formData.typePayement}
              onChange={handleChange}
            >
              <option value="salaire">Salaire mensuel</option>
              <option value="tauxHoraire">Taux horaire</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Salaire base</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              type="number"
              name="salaire"
              value={formData.salaire}
              onChange={handleChange}
              min="0"
              disabled={formData.typePayement !== 'salaire'}
              required={formData.typePayement === 'salaire'}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Taux horaire</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              type="number"
              name="tauxHoraire"
              value={formData.tauxHoraire}
              onChange={handleChange}
              min="0"
              disabled={formData.typePayement !== 'tauxHoraire'}
              required={formData.typePayement === 'tauxHoraire'}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="statut"
              value={formData.statut}
              onChange={handleChange}
            >
              <option value="actif">Actif</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <button
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="submit"
              disabled={saving || !matieres.length}
            >
              {saving ? 'Ajout en cours...' : 'Ajouter enseignant'}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Liste des enseignants</h2>
          <input
            type="text"
            placeholder="Rechercher par nom ou matricule"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-80"
          />
        </div>
        <table className="mt-4 w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Matricule</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Matiere</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Paiement</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Montant prevu</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Telephone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEnseignants.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Aucun enseignant trouve.
                </td>
              </tr>
            ) : (
              filteredEnseignants.map((enseignant) => (
                <tr key={enseignant.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{enseignant.matricule || enseignant.id}</td>
                  <td className="px-4 py-3 text-slate-700">{enseignant.nomComplet}</td>
                  <td className="px-4 py-3 text-slate-700">{enseignant.matiere}</td>
                  <td className="px-4 py-3 text-slate-700">{enseignant.typePayement}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMontant(enseignant)}</td>
                  <td className="px-4 py-3 text-slate-700">{enseignant.telephone || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{enseignant.statut}</td>
                  <td className="px-4 py-3">
                    <NavLink
                      className="mr-2 inline-block rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                      to={`/personnelProfil/enseignant/${enseignant.id}`}
                    >
                      Profil
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => handleDelete(enseignant.id)}
                      disabled={deletingId === enseignant.id}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === enseignant.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Enseignants;
