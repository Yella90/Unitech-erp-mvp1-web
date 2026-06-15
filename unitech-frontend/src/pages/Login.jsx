import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, SparklesIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { getDefaultRouteForRole } from '../utils/roles.js';
import { setLoginPortal } from '../services/auth';
import { apiUrl } from '../config/runtime';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoginPortal('admin');

    try {
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        setLoginPortal('admin');
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('schoolId', data.school_id);
        navigate(data.default_route || getDefaultRouteForRole(data.role));
        return;
      }

      setError(data.error || 'Erreur de connexion');
    } catch {
      setError('Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.25),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_26%),linear-gradient(135deg,_#0f172a_0%,_#1e293b_45%,_#0f172a_100%)]" />
      <div className="absolute left-10 top-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute bottom-12 right-10 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <aside className="glass-card flex flex-col justify-between rounded-[28px] p-6 sm:p-8 lg:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
                <SparklesIcon className="h-5 w-5 text-cyan-300" />
                UniTech ERP
              </div>

              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.25em] text-white/55">Gestion scolaire unifiee</p>
                <h1 className="max-w-xl text-4xl font-bold leading-tight text-white sm:text-5xl">
                  Un espace plus lisible, plus rapide, plus mobile.
                </h1>
                <p className="max-w-lg text-base leading-7 text-white/75 sm:text-lg">
                  Pilotage des eleves, classes, finances et salaires dans une interface plus claire, avec des animations discrètes et un affichage adapte au telephone.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                'Navigation simplifiee',
                'Paiements centralises',
                'Responsive natif',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 backdrop-blur">
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <section className="surface-card rounded-[28px] p-6 text-slate-900 shadow-2xl sm:p-8 lg:p-10">
            <div className="mb-8 space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                <ShieldCheckIcon className="h-4 w-4" />
                Connexion securisee
              </p>
              <h2 className="text-3xl font-bold text-slate-900">Acceder a votre tableau de bord</h2>
              <p className="text-sm leading-6 text-slate-500">
                Entrez vos identifiants pour ouvrir votre espace et continuer la gestion de l&apos;etablissement.
              </p>
            </div>

            {error ? (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  placeholder="vous@etablissement.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  placeholder="Votre mot de passe"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 px-4 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </form>

            <div className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate('/auth/register-school')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="block font-semibold text-slate-800">Creer un etablissement</span>
                <span className="block text-xs text-slate-500">Demarrer une nouvelle installation.</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/connexion-personnel')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
              >
                <span className="block font-semibold text-slate-800">Espace personnel</span>
                <span className="block text-xs text-slate-500">Acceder avec votre role operationnel.</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Login;
