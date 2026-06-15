import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDefaultRouteForRole } from '../utils/roles.js';
import { clearStoredAuth, setLoginPortal } from '../services/auth';
import { apiUrl } from '../config/runtime';

function StaffLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoginPortal('staff');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const identifier = email.trim();
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Erreur de connexion');
        return;
      }

      clearStoredAuth();
      setLoginPortal('staff');
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('schoolId', data.school_id);

      try {
        const meResponse = await fetch(apiUrl('/auth/me'), {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        });
        if (meResponse.ok) {
          const meData = await meResponse.json();
          if (meData?.name) {
            localStorage.setItem('etablissement', meData.name);
          }
        }
      } catch {
        // La connexion reste valide meme si le contexte d'etablissement ne remonte pas tout de suite.
      }

      navigate(data.default_route || getDefaultRouteForRole(data.role), { replace: true });
    } catch {
      setError('Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#dbeafe_45%,_#eef2ff_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative overflow-hidden bg-slate-900 px-8 py-10 text-white sm:px-12 sm:py-14">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,197,94,0.18),transparent_40%,rgba(59,130,246,0.25))]" />
            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-300">Espace Staff</p>
              <h1 className="mt-4 max-w-md text-4xl font-black leading-tight sm:text-5xl">
                Connexion du personnel et des enseignants
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">
                Chaque compte est cree a l'ajout du membre dans l'ecole. Connectez-vous avec l'email enregistre et le mot de passe genere.
              </p>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-emerald-300">Redirection intelligente</p>
                  <p className="mt-2 text-sm text-slate-200">Le directeur, le comptable, le censeur ou l'enseignant arrivent directement sur leur espace de travail.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-sky-300">Compte individuel</p>
                  <p className="mt-2 text-sm text-slate-200">Le mot de passe est genere a partir de l'ecole, du profil et du matricule pour rester unique.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white px-6 py-10 sm:px-10 sm:py-14">
            <div className="mx-auto max-w-md">
              <h2 className="text-3xl font-bold text-slate-900">Se connecter</h2>
              <p className="mt-2 text-sm text-slate-500">Accedez a vos taches quotidiennes selon votre role.</p>

              {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email ou matricule</label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    placeholder="nom@ecole.com ou ENS1234"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Connexion en cours...' : 'Ouvrir mon espace'}
                </button>
              </form>

              <div className="mt-6 text-sm text-slate-600">
                <button type="button" onClick={() => navigate('/login')} className="font-semibold text-sky-700 hover:underline">
                  Revenir a la connexion administration
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default StaffLogin;
