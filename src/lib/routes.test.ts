import { describe, expect, it } from 'vitest';
import { ROUTES, ctaTargets, resolveRedirectTarget } from './routes';

describe('resolveRedirectTarget', () => {
  it('원래 가려던 앱 경로로 돌려보낸다', () => {
    expect(resolveRedirectTarget('/app/insights')).toBe('/app/insights');
    expect(resolveRedirectTarget('/app/entries/abc-123')).toBe('/app/entries/abc-123');
    expect(resolveRedirectTarget('/app')).toBe('/app');
    expect(resolveRedirectTarget('/app?tab=1')).toBe('/app?tab=1');
  });

  it('값이 없으면 앱 첫 화면으로 보낸다', () => {
    expect(resolveRedirectTarget(undefined)).toBe(ROUTES.app);
    expect(resolveRedirectTarget(null)).toBe(ROUTES.app);
    expect(resolveRedirectTarget(123)).toBe(ROUTES.app);
    expect(resolveRedirectTarget({ from: '/app' })).toBe(ROUTES.app);
  });

  it('로그인 화면으로 되돌아가지 않는다 — 그러면 로그인이 끝나지 않는다', () => {
    expect(resolveRedirectTarget('/login')).toBe(ROUTES.app);
    expect(resolveRedirectTarget('/signup')).toBe(ROUTES.app);
  });

  it('랜딩이나 옛 경로도 앱 첫 화면으로 보낸다', () => {
    expect(resolveRedirectTarget('/')).toBe(ROUTES.app);
    expect(resolveRedirectTarget('/entries')).toBe(ROUTES.app);
  });

  it('외부로 나가는 값은 받지 않는다', () => {
    // history state는 사용자가 조작할 수 있다. "//" 로 시작하면 브라우저가 외부 사이트로 본다.
    expect(resolveRedirectTarget('//evil.example.com')).toBe(ROUTES.app);
    expect(resolveRedirectTarget('https://evil.example.com/app')).toBe(ROUTES.app);
    // "/appendix"는 "/app"으로 시작하지만 앱 경로가 아니다.
    expect(resolveRedirectTarget('/appendix')).toBe(ROUTES.app);
  });
});

describe('ctaTargets', () => {
  it('비로그인: 시작하기는 회원가입, 앱 이용하기는 로그인', () => {
    expect(ctaTargets(false)).toEqual({
      start: ROUTES.signup,
      enterApp: ROUTES.login,
      login: ROUTES.login,
    });
  });

  it('로그인 상태에서는 모든 CTA가 앱으로 간다', () => {
    expect(ctaTargets(true)).toEqual({
      start: ROUTES.app,
      enterApp: ROUTES.app,
      login: ROUTES.app,
    });
  });
});
