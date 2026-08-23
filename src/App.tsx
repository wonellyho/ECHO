import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { RecordPage } from './pages/RecordPage';
import { EntriesPage } from './pages/EntriesPage';
import { EntryDetailPage } from './pages/EntryDetailPage';
import { InsightsPage } from './pages/InsightsPage';
import './App.css';

function NavBar() {
  const location = useLocation();
  return (
    <nav className="nav-bar">
      <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
        기록
      </Link>
      <Link to="/entries" className={location.pathname.startsWith('/entries') ? 'active' : ''}>
        내 경험
      </Link>
      <Link to="/insights" className={location.pathname === '/insights' ? 'active' : ''}>
        패턴
      </Link>
      <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
        로그아웃
      </button>
    </nav>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="center">불러오는 중...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <main>
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  );
}
