import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

const initialFormData = {
  nomComplet: '',
  matricule: '',
  poste: '',
  type_personnel: '',
  typePayement: 'salaire',
  salaire: '',
  tauxHoraire: '',
  date_embauche: '',
  statut: 'actif',
  email: '',
  telephone: '',
};

function formatPaiement(personnel) {
  if (personnel.typePayement === 'tauxHoraire') {
    return personnel.tauxHoraire ? `${personnel.tauxHoraire} F / h` : '-';
  }
  return personnel.salaire ? `${Number(personnel.salaire).toLocaleString('fr-FR')} F` : '-';
}

function Personnels() {
  const [personnels, setPersonnels] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedAccount, setGeneratedAccount] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const showLoading = usePageLoadingVisibility(loading);

  const loadPersonnels = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/personnels');
      setPersonnels(response.data || []);
    } catch (err) {
      console.error('Erreur chargement personnels:', err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      setError('Erreur lors du chargement des personnels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonnels();
  }, []);

  const filteredPersonnels = personnels.filter((personnel) => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return true;
    const haystack = `${personnel.nomComplet || ''} ${personnel.matricule || ''}`.toLowerCase();
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

    if (!formData.nomComplet || !formData.poste || !formData.email || !formData.telephone) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.typePayement === 'salaire' && !formData.salaire) {
      setError('Le salaire est obligatoire pour un personnel paye au salaire.');
      return;
    }

    if (formData.typePayement === 'tauxHoraire' && !formData.tauxHoraire) {
      setError("Le taux horaire est obligatoire pour un personnel paye a l'heure.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        salaire: formData.typePayement === 'salaire' ? Number(formData.salaire) : null,
        tauxHoraire: formData.typePayement === 'tauxHoraire' ? Number(formData.tauxHoraire) : null,
      };

      const response = await api.post('/personnels', payload);
      setSuccess('Personnel ajoute avec succes.');
      setGeneratedAccount(response.data?.compte || null);
      setFormData(initialFormData);
      await loadPersonnels();
    } catch (err) {
      console.error('Erreur ajout personnel:', err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      setError(err?.response?.data?.error || "Erreur lors de l'ajout du personnel.");
      setGeneratedAccount(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (personnelId) => {
    const confirmed = window.confirm('Supprimer ce personnel ?');
    if (!confirmed) return;

    setDeletingId(personnelId);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/personnels/${personnelId}`);
      setPersonnels((prev) => prev.filter((personnel) => personnel.id !== personnelId));
      setSuccess('Personnel supprime avec succes.');
    } catch (err) {
      console.error('Erreur suppression personnel:', err);
      if (err?.response?.status === 401) {
        window.location.assign('/login');
        return;
      }
      setError(err?.response?.data?.error || 'Erreur lors de la suppression du personnel.');
    } finally {
      setDeletingId(null);
    }
  };

  if (showLoading) {
    return <PageLoadingState title="Chargement des personnels" message="Les fiches du personnel sont en cours de chargement." />;
  }

  if (error && personnels.length === 0) {
    return (
      <PageErrorState
        title="Liste du personnel indisponible"
        message={error}
        action={
          <button
            type="button"
            onClick={loadPersonnels}
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
      <PageBanner tone="error" title={error && personnels.length > 0 ? 'Action impossible' : ''} message={personnels.length > 0 ? error : ''} />
      {generatedAccount ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Compte de connexion cree.</p>
          <p className="mt-1">Email: {generatedAccount.email}</p>
          <p>Role: {generatedAccount.role}</p>
          <p>Mot de passe genere: {generatedAccount.mot_de_passe_genere}</p>
        </div>
      ) : null}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Nouveau personnel</h2>
        <p className="mt-1 text-sm text-slate-500">
          Le matricule peut etre saisi manuellement ou sera genere automatiquement a la creation.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Matricule</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="matricule"
              value={formData.matricule}
              onChange={handleChange}
              placeholder="Auto si vide"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role / Poste</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="poste"
              value={formData.poste}
              onChange={handleChange}
              required
            >
              <option value="">Selectionner</option>
              <option value="Directeur">Directeur</option>
              <option value="Comptable">Comptable</option>
              <option value="Surveillant">Surveillant</option>
              <option value="Secretaire">Secretaire</option>
              <option value="Censeur">Censeur</option>
              <option value="Bibliothecaire">Bibliothecaire</option>
              <option value="Agent d'entretien">Agent d'entretien</option>
              <option value="Agent de securite">Agent de securite</option>
              <option value="Infirmerie">Infirmerie</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type personnel</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="type_personnel"
              value={formData.type_personnel}
              onChange={handleChange}
            >
              <option value="">Selectionner</option>
              <option value="administratif">Administratif</option>
              <option value="pedagogique">Pedagogique</option>
              <option value="technique">Technique</option>
              <option value="autre">Autre</option>
            </select>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Salaire de base</label>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Date embauche</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="date"
              name="date_embauche"
              value={formData.date_embauche}
              onChange={handleChange}
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

          <div className="md:col-span-4">
            <button
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Ajout en cours...' : 'Ajouter personnel'}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Personnel de l'etablissement</h2>
          <input
            type="text"
            placeholder="Rechercher par nom ou matricule"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-80"
          />
        </div>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Matricule</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Poste</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Paiement</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPersonnels.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Aucun personnel trouve.
                </td>
              </tr>
            ) : (
              filteredPersonnels.map((personnel) => (
                <tr key={personnel.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{personnel.matricule || personnel.id}</td>
                  <td className="px-4 py-3 text-slate-700">{personnel.nomComplet || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{personnel.poste || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{personnel.type_personnel || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{formatPaiement(personnel)}</td>
                  <td className="px-4 py-3 text-slate-700">{personnel.statut || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{personnel.email || personnel.telephone || '-'}</td>
                  <td className="px-4 py-3">
                    <NavLink
                      className="mr-2 inline-block rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                      to={`/personnelProfil/personnel/${personnel.id}`}
                    >
                      Profil
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => handleDelete(personnel.id)}
                      disabled={deletingId === personnel.id}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === personnel.id ? 'Suppression...' : 'Supprimer'}
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

export default Personnels;
