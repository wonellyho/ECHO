import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { RecordPage } from './pages/RecordPage';
import { EntriesPage } from './pages/EntriesPage';
import { EntryDetailPage } from './pages/EntryDetailPage';
import { InsightsPage } from './pages/InsightsPage';

function NavBar() {
  const location = useLocation();

  const linkClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <nav className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white p-2 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <Link
        to="/"
        className={linkClass(location.pathname === '/')}
        aria-current={location.pathname === '/' ? 'page' : undefined}
      >
        기록
      </Link>
      <Link
        to="/entries"
        className={linkClass(location.pathname.startsWith('/entries'))}
        aria-current={location.pathname.startsWith('/entries') ? 'page' : undefined}
      >
        내 경험
      </Link>
      <Link
        to="/insights"
        className={linkClass(location.pathname === '/insights')}
        aria-current={location.pathname === '/insights' ? 'page' : undefined}
      >
        패턴
      </Link>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="ml-auto rounded-md px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
      >
        로그아웃
      </button>
    </nav>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>불러오는 중...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
