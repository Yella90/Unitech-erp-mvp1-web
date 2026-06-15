import { useState,useEffect } from "react";
import api from "../services/api"

export default function Matriere() {
  const [formData, setFormData] = useState({
    nom: '',
    coefficient: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]); // Pour stocker les classes récupérées
const [matieres, setMatieres] = useState([]); // Pour stocker les matières récupérées

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Efface l'erreur du champ quand l'utilisateur tape
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };
  const onsubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    try {      
      await api.post('/matieres', formData);
      setSuccess('Matière ajoutée avec succès !');
        // Réinitialiser le formulaire
        setFormData({   
        nom: '',
        coefficient: '',
        description: '',
        });
        // attendre un court instant pour que le backend ait le temps de traiter l'ajout avant de recharger les matières    
        await new Promise((resolve) => setTimeout(resolve, 1000));
        window.location.reload(); // Recharger la page pour afficher la nouvelle matière (option rapide)
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur serveur' });
    } finally {
      setLoading(false);
    }
    };
useEffect( ()=>{
  
    setLoading(true)
    const Fechmatiere= async ()=>{
      try{
    
    const reponse= await api.get("/matieres/"); 
    setMatieres(reponse.data);
    console.log(reponse.data)
  }catch(err){
    if(err.response && err.response.status === 401){
      console.error('Erreur API:', err.response.data);
            // Rediriger vers la page de connexion
            window.location.href = '/login';
            return;
    }else{
      setErrors("echec du cahgement des matiere")
    }
  }
  finally{
    setLoading(false)
  };
  } ;
  Fechmatiere()

},[])

    return (
      <section className="space-y-5">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">Bibliothèque des matières</h2>
              <p className="text-sm text-slate-600">
                Ajoutez et maintenez les matières utilisées pour les affectations, les emplois du temps et les notes.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total matières</p>
              <p className="text-2xl font-bold text-slate-900">{matieres.length}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_1.9fr]">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Nouvelle matière</h3>
            <p className="mt-1 text-xs text-slate-500">Le coefficient sera appliqué automatiquement dans les calculs de moyenne.</p>

            {success && <div className="mt-4 bg-green-100 text-green-700 p-2 rounded">{success}</div>}
            {errors.submit && <div className="mt-4 bg-red-100 text-red-700 p-2 rounded">{errors.submit}</div>}

            <form onSubmit={onsubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="nom">Nom de la matière</label>
                <input
                  id="nom"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  name="nom"
                  placeholder="Ex: Mathématiques"
                  value={formData.nom}
                  onChange={handleChange}
                  required
                />
                {errors.nom && <p className="mt-1 text-sm text-red-600">{errors.nom}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="coefficient">Coefficient</label>
                <input
                  id="coefficient"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  type="number"
                  step="0.1"
                  min="0.1"
                  name="coefficient"
                  placeholder="Ex: 2"
                  value={formData.coefficient}
                  onChange={handleChange}
                  required
                />
                {errors.coefficient && <p className="mt-1 text-sm text-red-600">{errors.coefficient}</p>}
              </div>
              <button
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 w-full sm:w-auto"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Ajout en cours...' : 'Ajouter la matière'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Liste des matières</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{matieres.length} élément(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">#</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Matière</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Coefficient</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matieres.map((m, index) => (
                    <tr key={m.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{m.nom}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{Number(m.coefficient || 0)}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-xs">Supprimer</button>
                      </td>
                    </tr>
                  ))}

                  {matieres.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-12 text-center">
                        <p className="text-sm font-medium text-slate-600">Aucune matière enregistrée.</p>
                        <p className="mt-1 text-xs text-slate-500">Ajoutez votre première matière via le formulaire à gauche.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    );
}
