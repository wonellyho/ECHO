import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { BottomNav } from './components/BottomNav';
import { LoginPage } from './pages/LoginPage';
import { RecordPage } from './pages/RecordPage';
import { EntriesPage } from './pages/EntriesPage';
import { EntryDetailPage } from './pages/EntryDetailPage';
import { InsightsPage } from './pages/InsightsPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-space-black text-ink-dim">
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
    <div className="min-h-[100dvh] bg-space-black">
      {/* 각 화면은 자기 안에서 하단 네비게이션 높이만큼 여백을 두거나(스크롤형) 높이를
          빼서(전체화면형) 쓴다. 여기서는 네비게이션 자체만 얹는다. */}
      <main>
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
