import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';
import SearchableSelect from '../components/SearchableSelect';

const initialForm = {
  nom_matiere: '',
  classe_id: '',
  enseignant_id: '',
};
const getClasseName = (classeId, classes) => {
  // Implémenter la logique pour récupérer le nom de la classe
  const classe = classes.find(c => c.id == classeId);
  return classe ? classe.name : 'Classe non trouvée';
};
function getClasseLabel(classe) {
  return classe?.name || classe?.nom || `Classe #${classe?.id ?? ''}`;
}

function getEnseignantLabel(enseignant) {
  const name = enseignant?.nomComplet || enseignant?.nom || 'Enseignant sans nom';
  return enseignant?.matricule ? `${name} (${enseignant.matricule})` : name;
}

export default function Affectation() {
  const [enseignants, setEnseignants] = useState([]); 
  const [matieres, setMatieres] = useState([]);
  const [classes, setClasses] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [enseignantsResponse, matieresResponse, classesResponse, affectationsResponse] =
        await Promise.all([
          api.get('/enseignants'),
          api.get('/matieres'),
          api.get('/classes'),
          api.get('/affectation'),
        ]);

      setEnseignants(enseignantsResponse.data || []);
      setMatieres(matieresResponse.data || []);
      setClasses(classesResponse.data || []);
      setAffectations(affectationsResponse.data || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        window.location.assign('/login');
        return;
      }

      console.error('Erreur chargement affectations:', err);
      setError("Erreur lors du chargement des donnees d'affectation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nom_matiere || !formData.classe_id || !formData.enseignant_id) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/affectation', formData);
      setFormData(initialForm);
      setSuccess('Affectation enregistree avec succes.');
      await loadData();
    } catch (err) {
      if (err?.response?.status === 401) {
        window.location.assign('/login');
        return;
      }

      console.error('Erreur creation affectation:', err);
      setError(err?.response?.data?.err || "Erreur lors de l'enregistrement de l'affectation.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Supprimer cette affectation ?');
    if (!confirmed) return;

    setDeletingId(id);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/affectation/${id}`);
      setSuccess('Affectation supprimee avec succes.');
      setAffectations((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      if (err?.response?.status === 401) {
        window.location.assign('/login');
        return;
      }

      console.error('Erreur suppression affectation:', err);
      setError(err?.response?.data?.error || 'Erreur lors de la suppression.');
    } finally {
      setDeletingId(null);
    }
  };

  if (showLoading && affectations.length === 0 && !error) {
    return (
      <PageLoadingState
        title="Chargement des affectations"
        message="Les classes, matieres et enseignants sont en cours de chargement."
      />
    );
  }

  if (!loading && error && affectations.length === 0) {
    return (
      <PageErrorState
        title="Affectations indisponibles"
        message={error}
        action={
          <button
            type="button"
            onClick={loadData}
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
      <PageBanner tone="error" title={error && affectations.length > 0 ? 'Action impossible' : ''} message={affectations.length > 0 ? error : ''} />
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Nouvelle affectation</h2>
            <p className="mt-1 text-sm text-slate-500">
              Attribuez une matiere, une classe et un enseignant comme dans l&apos;ancienne version du systeme.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
            {affectations.length} affectation(s)
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_2.6fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Formulaire</h3>
          <p className="mt-1 text-sm text-slate-500">
            Selectionnez la classe, la matiere et l&apos;enseignant puis enregistrez.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="classe_id" className="block text-sm font-medium text-slate-700">
                Classe
              </label>
              <select
                id="classe_id"
                name="classe_id"
                value={formData.classe_id}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Selectionner</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {getClasseLabel(classe)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="nom_matiere" className="block text-sm font-medium text-slate-700">
                Matiere
              </label>
              <select
                id="nom_matiere"
                name="nom_matiere"
                value={formData.nom_matiere}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Selectionner</option>
                {matieres.map((matiere) => (
                  <option key={matiere.id || matiere.nom} value={matiere.nom}>
                    {matiere.nom}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="enseignant_id" className="block text-sm font-medium text-slate-700">
                Enseignant
              </label>
              <SearchableSelect
                value={formData.enseignant_id}
                onChange={(nextValue) => setFormData((prev) => ({ ...prev, enseignant_id: nextValue }))}
                placeholder="Rechercher un enseignant"
                emptyLabel="Aucun enseignant trouve"
                options={enseignants.map((enseignant) => ({
                  value: enseignant.id,
                  label: getEnseignantLabel(enseignant),
                  keywords: `${enseignant.matricule || ''} ${enseignant.nomComplet || ''} ${enseignant.nom || ''}`,
                }))}
              />
            </div>

            <button
              className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={saving || loading}
            >
              {saving ? 'Enregistrement...' : 'Affecter'}
            </button>
          </form>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Affectations enregistrees</h3>
            <p className="text-sm text-slate-500">
              Vue centralisee des classes, matieres et enseignants affectes.
            </p>
          </div>

          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Classe</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Matiere</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Enseignant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Matricule</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Chargement des affectations...
                  </td>
                </tr>
              ) : affectations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Aucune affectation enregistree.
                  </td>
                </tr>
              ) : (
                affectations.map((affectation) => (
                  <tr key={affectation.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{ getClasseName(affectation.classe_id,classes)|| '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{affectation.nom_matiere || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{affectation.enseignant_nom || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{affectation.enseignant_matricule || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(affectation.id)}
                        disabled={deletingId === affectation.id}
                        className="inline-flex items-center rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === affectation.id ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
