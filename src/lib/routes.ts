// 앱 라우트 경로를 한 곳에서만 정의한다.
//
// 랜딩페이지가 "/"를 가져가면서 앱 전체가 "/app" 아래로 내려갔다. 경로 문자열이 화면마다
// 흩어져 있으면 한 곳만 빠뜨려도 조용히 깨지고(링크는 눌리는데 랜딩으로 튕김) 원인을 찾기
// 어렵다 — 그래서 앱 내부 이동은 전부 이 상수를 거친다.

export const ROUTES = {
  /** 서비스 소개 랜딩 (비로그인/로그인 무관하게 항상 공개) */
  landing: '/',
  login: '/login',
  signup: '/signup',

  /** 앱 진입점 = 기록 탭 */
  app: '/app',
  entries: '/app/entries',
  entry: (id: string) => `/app/entries/${id}`,
  insights: '/app/insights',
  profile: '/app/profile',
} as const;

/**
 * 로그인에 성공한 뒤 어디로 돌려보낼지 정한다.
 *
 * `from`은 RequireApp이 "비로그인이라 로그인 화면으로 보냅니다" 하면서 넘겨준, 원래 가려던
 * 경로다. 하지만 이 값은 history state라 사용자가 조작할 수도 있고 오래된 값이 남을 수도
 * 있으므로 그대로 믿지 않는다. 앱 내부 경로(/app…)일 때만 쓰고, 그 밖에는 앱 첫 화면으로
 * 보낸다 — 특히 /login이나 외부 URL이 들어오면 로그인 → 로그인으로 도는 고리가 된다.
 */
export function resolveRedirectTarget(from: unknown): string {
  if (typeof from !== 'string') return ROUTES.app;
  // "//evil.com"은 브라우저가 프로토콜 상대 URL(외부 사이트)로 해석한다.
  if (from.startsWith('//')) return ROUTES.app;
  if (from !== ROUTES.app && !from.startsWith(`${ROUTES.app}/`) && !from.startsWith(`${ROUTES.app}?`)) {
    return ROUTES.app;
  }
  return from;
}

/**
 * 랜딩의 모든 CTA가 공유하는 목적지 규칙.
 *
 *   시작하기    → 로그인 상태면 앱, 아니면 회원가입
 *   앱 이용하기 → 로그인 상태면 앱, 아니면 로그인
 *
 * 규칙이 컴포넌트마다 흩어지면 "어떤 버튼은 로그인했는데도 로그인 화면으로 간다" 같은
 * 버그가 생기기 때문에 여기 한 곳에 모은다.
 */
export function ctaTargets(isAuthed: boolean) {
  return {
    start: isAuthed ? ROUTES.app : ROUTES.signup,
    enterApp: isAuthed ? ROUTES.app : ROUTES.login,
    login: isAuthed ? ROUTES.app : ROUTES.login,
  };
}

/**
 * "/app" 아래에 중첩 라우팅으로 달릴 때 쓰는 상대 경로.
 * ROUTES와 짝이 어긋나면 안 되므로 여기 함께 둔다.
 */
export const APP_CHILD_PATHS = {
  record: '/',
  entries: 'entries',
  entryDetail: 'entries/:id',
  insights: 'insights',
  profile: 'profile',
} as const;
