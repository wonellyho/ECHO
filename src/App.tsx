import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { RecordPage } from './pages/RecordPage';
import { EntriesPage } from './pages/EntriesPage';
import { EntryDetailPage } from './pages/EntryDetailPage';

function NavBar() {
  const location = useLocation();

  return (
    <nav>
      <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined}>
        기록
      </Link>
      <Link
        to="/entries"
        aria-current={location.pathname.startsWith('/entries') ? 'page' : undefined}
      >
        내 경험
      </Link>
      <button type="button" onClick={() => supabase.auth.signOut()}>
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
    <div>
      <main>
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
