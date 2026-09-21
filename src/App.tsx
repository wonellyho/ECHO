import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { APP_CHILD_PATHS, ROUTES, resolveRedirectTarget } from './lib/routes';
import { BottomNav } from './components/BottomNav';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';

// 앱 화면은 지연 로딩한다.
//
// 별자리 탭이 three.js(약 1MB)를 끌고 오는데, 이걸 정적으로 import하면 **서비스 소개만 보러
// 온 사람도 three.js를 통째로 내려받는다.** "/"가 공개 랜딩이 된 지금은 그 비용이 그대로
// 첫인상이 되므로, 로그인한 사용자가 앱에 들어갈 때만 받도록 분리한다.
const RecordPage = lazy(() => import('./pages/RecordPage').then((m) => ({ default: m.RecordPage })));
const EntriesPage = lazy(() => import('./pages/EntriesPage').then((m) => ({ default: m.EntriesPage })));
const EntryDetailPage = lazy(() =>
  import('./pages/EntryDetailPage').then((m) => ({ default: m.EntryDetailPage })),
);
const InsightsPage = lazy(() => import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));

/**
 * 라우팅 구조
 *
 *   /                 랜딩(서비스 소개) — 항상 공개
 *   /login, /signup   로그인·회원가입. 이미 로그인 상태면 앱으로 보낸다.
 *   /app/*            실제 ECHO 앱. 비로그인이면 /login으로 보내고 원래 가려던 경로를 기억한다.
 *   /entries 등       랜딩 도입 이전의 옛 경로 — 북마크가 깨지지 않게 /app/... 으로 넘긴다.
 */

/** 로그인 후 어디로 돌려보낼지. RequireApp이 넣어준 state를 읽는다(판단 규칙은 routes.ts). */
function useRedirectTarget(): string {
  const location = useLocation();
  return resolveRedirectTarget((location.state as { from?: unknown } | null)?.from);
}

/** 지연 로딩한 앱 화면이 도착하기 전까지의 화면. 앱의 최초 로딩 화면과 같은 모양으로 둔다. */
function AppLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-space-black text-ink-dim">
      불러오는 중...
    </div>
  );
}

/** 앱 셸 — 하단 네비게이션을 얹고 그 안에 앱 화면들을 중첩 라우팅으로 건다. */
function AppShell() {
  return (
    <div className="min-h-[100dvh] bg-space-black">
      {/* 각 화면은 자기 안에서 하단 네비게이션 높이만큼 여백을 두거나(스크롤형) 높이를
          빼서(전체화면형) 쓴다. 여기서는 네비게이션 자체만 얹는다. */}
      <main>
        <Suspense fallback={<AppLoading />}>
          <Routes>
            <Route path={APP_CHILD_PATHS.record} element={<RecordPage />} />
            <Route path={APP_CHILD_PATHS.entries} element={<EntriesPage />} />
            <Route path={APP_CHILD_PATHS.entryDetail} element={<EntryDetailPage />} />
            <Route path={APP_CHILD_PATHS.insights} element={<InsightsPage />} />
            <Route path={APP_CHILD_PATHS.profile} element={<ProfilePage />} />
            <Route path="*" element={<Navigate to={ROUTES.app} replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

/** 옛 경로(/entries/:id)를 새 경로(/app/entries/:id)로 넘긴다. */
function LegacyEntryRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? ROUTES.entry(id) : ROUTES.entries} replace />;
}

function LoginRoute({ initialMode }: { initialMode: 'login' | 'signup' }) {
  const { user, loading } = useAuth();
  const target = useRedirectTarget();

  // 세션을 아직 모르는 동안에는 아무 판단도 하지 않는다. 여기서 성급히 로그인 화면을 그리면,
  // 잠시 뒤 세션이 도착해 곧바로 /app으로 튕기면서 화면이 한 번 깜빡인다.
  if (loading) return <AppLoading />;

  // 로그인에 성공하면 useAuth의 onAuthStateChange가 세션을 갱신하고, 그 리렌더에서 이 분기가
  // 참이 되어 앱으로 넘어간다 — LoginPage 안에 별도의 이동 로직을 두지 않는다.
  if (user) return <Navigate to={target} replace />;

  return <LoginPage initialMode={initialMode} />;
}

function RequireApp() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // loading 중에 리다이렉트하지 않는 것이 핵심이다. "아직 모름"을 "비로그인"으로 단정하면
  // 로그인한 사용자를 로그인 화면으로 보내고, 그 화면이 다시 앱으로 돌려보내면서 두 경로가
  // 무한히 서로를 튕겨낸다 (useAuth.ts 주석 참고).
  if (loading) return <AppLoading />;

  if (!user) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <AppShell />;
}

export default function App() {
  // 여기서 세션 조회가 끝날 때까지 기다리지 않는다. "/"는 누구나 보는 공개 랜딩인데, 전체를
  // 막아두면 처음 온 사람이 Supabase 왕복이 끝날 때까지 "불러오는 중..."만 보게 된다.
  // 세션이 필요한 것은 /app과 /login뿐이고, 그 둘은 각자 loading을 직접 처리한다.
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<LandingPage />} />

      <Route path={ROUTES.login} element={<LoginRoute initialMode="login" />} />
      <Route path={ROUTES.signup} element={<LoginRoute initialMode="signup" />} />

      {/* 아래 "*"가 있어야 AppShell 안의 중첩 <Routes>가 동작한다. */}
      <Route path="/app/*" element={<RequireApp />} />

      {/* 랜딩 도입 이전의 경로들 */}
      <Route path="/entries" element={<Navigate to={ROUTES.entries} replace />} />
      <Route path="/entries/:id" element={<LegacyEntryRedirect />} />
      <Route path="/insights" element={<Navigate to={ROUTES.insights} replace />} />
      <Route path="/profile" element={<Navigate to={ROUTES.profile} replace />} />

      <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
    </Routes>
  );
}
