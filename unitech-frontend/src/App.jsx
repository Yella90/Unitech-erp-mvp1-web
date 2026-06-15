import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import { clearStoredAuth, getLoginPortal } from './services/auth';
import { getDefaultRouteForRole } from './utils/roles.js';
import Login from './pages/Login.jsx';
import StaffLogin from './pages/StaffLogin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';
import ElevesListe from './pages/ElevesListe.jsx';
import Finances from './pages/Finances.jsx';
import Enseignants from './pages/enseignants.jsx';
import Personnels from './pages/personnels.jsx';
import Matriere from './pages/Matriere.jsx';
import Tresorerie from './pages/Tresorerie.jsx';
import TrimestresCharges from './pages/TrimestresCharges.jsx';
import HistoriqueActions from './pages/HistoriqueActions.jsx';
import BulletinEleve from './pages/BulletinEleve.jsx';
import Affestation from './pages/affestation.jsx';
import Inscription from './pages/inscription.jsx';
import Notes from './pages/Notes.jsx';

function ProtectedLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header
        onLogoutRequest={() => window.location.assign('/logout')}
        onMenuToggle={() => {}}
      />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    const portal = getLoginPortal();
    return <Navigate to={portal === 'staff' ? '/connexion-personnel' : '/login'} replace state={{ from: location }} />;
  }

  return children;
}

function RootRedirect() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultRouteForRole(localStorage.getItem('role'))} replace />;
}

function LogoutRoute() {
  clearStoredAuth();
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/connexion-personnel" element={<StaffLogin />} />
      <Route path="/auth/register-school" element={<Inscription />} />
      <Route path="/logout" element={<LogoutRoute />} />

      <Route
        element={(
          <RequireAuth>
            <ProtectedLayout />
          </RequireAuth>
        )}
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
        <Route path="/eleves" element={<ElevesListe />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/enseignants" element={<Enseignants />} />
        <Route path="/personnels" element={<Personnels />} />
        <Route path="/matieres" element={<Matriere />} />
        <Route path="/tresorerie" element={<Tresorerie />} />
        <Route path="/trimestres" element={<TrimestresCharges />} />
        <Route path="/historique-actions" element={<HistoriqueActions />} />
        <Route path="/bulletin/:id" element={<BulletinEleve />} />
        <Route path="/affestation" element={<Affestation />} />
        <Route path="/notes" element={<Notes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
