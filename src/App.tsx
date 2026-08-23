import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { RecordPage } from './pages/RecordPage';
import { EntriesPage } from './pages/EntriesPage';
import { EntryDetailPage } from './pages/EntryDetailPage';

function NavBar() {
  const location = useLocation();

  const linkClass = (active: boolean) =>
    `text-sm font-medium ${active ? 'text-violet-700' : 'text-slate-400'}`;

  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[480px] items-center justify-around border-t border-slate-200 bg-white px-2 py-3">
      <Link to="/" className={linkClass(location.pathname === '/')}>
        기록
      </Link>
      <Link to="/entries" className={linkClass(location.pathname.startsWith('/entries'))}>
        내 경험
      </Link>
      <button
        type="button"
        className="text-sm text-slate-400"
        onClick={() => supabase.auth.signOut()}
      >
        로그아웃
      </button>
    </nav>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        불러오는 중...
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-white">
      <main className="flex-1 px-4 pt-6 pb-24">
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  );
}
