import { useState, useEffect } from 'react';
import api from '../services/api';
import { getLoginRouteForCurrentPath } from '../services/auth';
import { isSuperAdminRole, normalizeRole } from '../utils/roles.js';
import { Bars3Icon } from '@heroicons/react/24/outline';

function formatRoleLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'directeur') return 'Directeur';
  if (normalized === 'promoteur') return 'Promoteur';
  if (normalized === 'comptable') return 'Comptable';
  if (normalized === 'secretaire') return 'Secretaire';
  if (normalized === 'censeur') return 'Censeur';
  if (normalized === 'surveillant') return 'Surveillant';
  if (normalized === 'enseignant') return 'Enseignant';
  if (normalized === 'personnel') return 'Personnel';
  return normalized || 'Utilisateur';
}

function Header({ onLogoutRequest, onMenuToggle }) {
  const role = localStorage.getItem('role');
  const isSuperAdmin = isSuperAdminRole(role);
  const [schoolName, setSchoolName] = useState('');
  const [userName, setUserName] = useState('');
  const [occupiedPost, setOccupiedPost] = useState('');
  const [activeSchoolYear, setActiveSchoolYear] = useState('');
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    if (isSuperAdmin) {
      localStorage.setItem('etablissement', 'Super Admin');
      return undefined;
    }

    Promise.all([
      api.get('/auth/me'),
      api.get('/system/dashboard/summary'),
    ]).then(([authResponse, dashboardResponse]) => {
      setSchoolName(authResponse.data.name);
      setUserName(authResponse.data.user?.display_name || authResponse.data.user?.name || '');
      setOccupiedPost(authResponse.data.user?.occupied_post || formatRoleLabel(authResponse.data.user?.role));
      setActiveSchoolYear(dashboardResponse.data?.currentSchoolYear || '');
      localStorage.setItem('etablissement', authResponse.data.name || '');
    }).catch(() => {
      window.location.href = getLoginRouteForCurrentPath();
    });
  }, [isSuperAdmin]);

  const displaySchoolName = isSuperAdmin ? 'Super Admin' : schoolName;
  const displayUserName = isSuperAdmin ? 'Super Admin' : userName;
  const displayOccupiedPost = isSuperAdmin ? 'Administration generale' : occupiedPost;
  const displaySchoolYear = isSuperAdmin ? '' : activeSchoolYear;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const handleBack = () => {
    window.history.back();
  };

  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(dateTime);

  const formattedTime = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(dateTime);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex min-h-[52px] items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onMenuToggle}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:px-3"
            >
              <span aria-hidden="true">&larr;</span>
              <span className="hidden sm:inline">Retour</span>
            </button>
            <h1 className="truncate text-sm font-bold text-[#1E3A8A] sm:text-base">UNITECH ERP</h1>
          </div>

          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Utilisateur</p>
              <p className="truncate text-xs font-semibold text-slate-700">{displayUserName || 'Chargement...'}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Poste</p>
              <p className="truncate text-xs font-semibold text-slate-700">{displayOccupiedPost || 'Non renseigne'}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Etablissement</p>
              <p className="truncate text-xs font-semibold text-slate-700">{displaySchoolName || 'Chargement...'}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Annee scolaire</p>
              <p className="truncate text-xs font-semibold text-slate-700">{displaySchoolYear || 'Non definie'}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Date</p>
              <p className="truncate text-xs font-semibold capitalize text-slate-700">{formattedDate}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Heure</p>
              <p className="truncate text-xs font-semibold text-slate-700">{formattedTime}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="grid gap-1 lg:hidden">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
              <p className="truncate text-[11px] font-semibold text-slate-700">{displayUserName || 'Chargement...'}</p>
              <p className="truncate text-[10px] text-slate-500">{displaySchoolName || 'Etablissement'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogoutRequest}
            className="inline-flex shrink-0 items-center rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 sm:px-3"
          >
            Deconnexion
          </button>
        </div>
      </div>

    </header>
  );
}
export default Header;
