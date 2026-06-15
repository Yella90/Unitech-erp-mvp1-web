import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../config/runtime';

function RegisterSchool() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    ecoleName: '',
    ecoleEmail: '',
    ecolePhone: '',
    ecoleAddress: '',
    plan: 'basic',
    billing: 'monthly',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      console.log('Reponse du serveur:', data);

      if (response?.ok) {
        setSuccessPayload({
          schoolName: formData.ecoleName,
          adminEmail: formData.adminEmail,
          plan: formData.plan,
        });
      } else {
        setError(data.error || "Erreur lors de l'inscription");
        console.error('Erreur API:', data.error || 'Unknown error');
      }
    } catch (err) {
      setError('Impossible de contacter le serveur');
      console.error('Erreur API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (successPayload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#e0f2fe,_#eef2ff_45%,_#f8fafc_100%)] p-4">
        <div className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-2xl backdrop-blur-xl">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500 px-8 py-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">Inscription terminee</p>
            <h1 className="mt-3 text-3xl font-bold">Votre espace est pret</h1>
            <p className="mt-3 max-w-2xl text-sm text-emerald-50">
              L'etablissement <strong>{successPayload.schoolName}</strong> et le compte administrateur ont ete crees avec succes.
            </p>
          </div>

          <div className="grid gap-6 px-8 py-8 md:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Recapitulatif</h2>
              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Administrateur</p>
                  <p className="mt-1 font-semibold text-slate-900">{successPayload.adminEmail}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Formule choisie</p>
                  <p className="mt-1 font-semibold capitalize text-slate-900">{successPayload.plan}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Prochaine etape</p>
                  <p className="mt-1 font-semibold text-slate-900">Connexion a votre espace</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Guide de demarrage</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="font-semibold text-emerald-800">1. Connectez-vous avec le compte administrateur</p>
                  <p className="mt-1">Utilisez l'email admin et le mot de passe saisi pendant l'inscription.</p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                  <p className="font-semibold text-sky-800">2. Configurez l'annee scolaire et les classes</p>
                  <p className="mt-1">Commencez par l'annee active, les classes, les matieres et les utilisateurs.</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="font-semibold text-amber-800">3. Lancez vos premiers modules</p>
                  <p className="mt-1">Ajoutez les eleves, preparez les trimestres, puis activez notes, finances et emplois du temps.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-6 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                OK, aller a la connexion
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 p-4 font-sans sm:items-center">
      <div className="w-full max-w-5xl animate-fadeInUp">
        <div className="rounded-3xl border border-white/40 bg-white/30 p-1 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col overflow-hidden rounded-2xl md:flex-row">
            <div className="flex flex-col justify-between bg-gradient-to-br from-purple-800 to-indigo-900 p-7 text-white md:w-2/5 md:p-12">
              <div>
                <h1 className="mb-4 text-4xl font-bold tracking-tight">UniTech ERP</h1>
                <p className="text-lg text-indigo-200">Inscription de votre etablissement</p>
              </div>
              <div className="my-6">
                <h2 className="mb-4 text-2xl font-semibold">Pret a digitaliser votre ecole ?</h2>
                <p className="leading-relaxed text-indigo-200">
                  Creez votre espace en quelques minutes. Gerez les eleves, les notes, les paiements et bien plus, le tout en local ou en ligne et securise.
                </p>
              </div>
              <div className="mt-4 border-t border-white/20 pt-6">
                <p className="flex items-center gap-2 text-sm text-indigo-200">
                  <span className="text-xl">*</span> La solution de gestion scolaire au Mali
                </p>
              </div>
            </div>

            <div className="bg-white/90 p-6 backdrop-blur-sm md:w-3/5 md:p-12">
              <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold text-gray-800">Creer mon espace</h3>
                <p className="text-gray-500">Remplissez tous les champs ci-dessous</p>
              </div>
              {error ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600">{error}</div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="mb-2 border-b border-gray-200 pb-3">
                  <h4 className="text-md font-semibold text-gray-700">Informations de l'ecole</h4>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nom de l'ecole *</label>
                    <input
                      type="text"
                      name="ecoleName"
                      value={formData.ecoleName}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Email de l'ecole *</label>
                    <input
                      type="email"
                      name="ecoleEmail"
                      value={formData.ecoleEmail}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Telephone</label>
                    <input
                      type="text"
                      name="ecolePhone"
                      value={formData.ecolePhone}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Adresse</label>
                    <input
                      type="text"
                      name="ecoleAddress"
                      value={formData.ecoleAddress}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Formule *</label>
                    <select
                      name="plan"
                      value={formData.plan}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="basic">Basic - 15 000 FCFA/mois (153 000 FCFA/an)</option>
                      <option value="pro">Smart - 30 000 FCFA/mois (306 000 FCFA/an)</option>
                      <option value="premium">Premium - 60 000 FCFA/mois (612 000 FCFA/an)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Facturation *</label>
                    <select
                      name="billing"
                      value={formData.billing}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="monthly">Mensuelle</option>
                      <option value="annual">Annuelle (avec reduction)</option>
                    </select>
                  </div>
                </div>

                <div className="mb-2 mt-4 border-b border-gray-200 pb-3">
                  <h4 className="text-md font-semibold text-gray-700">Compte administrateur</h4>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nom complet *</label>
                    <input
                      type="text"
                      name="adminName"
                      value={formData.adminName}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Email admin *</label>
                    <input
                      type="email"
                      name="adminEmail"
                      value={formData.adminEmail}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe (min. 8 caracteres) *</label>
                    <input
                      type="password"
                      name="adminPassword"
                      value={formData.adminPassword}
                      onChange={handleChange}
                      minLength="8"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? 'Creation en cours...' : 'Creer mon espace'}
                </button>

                <p className="pt-4 text-center text-sm text-gray-600">
                  Vous avez deja un compte ?{' '}
                  <button type="button" onClick={() => navigate('/login')} className="font-semibold text-indigo-600 transition hover:underline">
                    Se connecter
                  </button>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterSchool;
