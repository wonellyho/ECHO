import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, resetRateLimitsForTest, type RateLimitRule } from './rateLimit.js';

// 호출 제한은 요금이 걸린 로직이라 동작을 못 박아둔다. 시간에 의존하므로 가짜 타이머를 쓴다.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

beforeEach(() => {
  resetRateLimitsForTest();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-22T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const perMinute = (max: number): RateLimitRule[] => [{ windowMs: MINUTE, max }];

describe('checkRateLimit', () => {
  it('한도까지는 통과시키고 그 다음부터 막는다', () => {
    const rules = perMinute(3);
    expect(checkRateLimit('user-a', rules).allowed).toBe(true);
    expect(checkRateLimit('user-a', rules).allowed).toBe(true);
    expect(checkRateLimit('user-a', rules).allowed).toBe(true);
    expect(checkRateLimit('user-a', rules).allowed).toBe(false);
  });

  it('사용자마다 따로 센다 — 한 사람이 막혀도 다른 사람은 영향받지 않는다', () => {
    const rules = perMinute(1);
    expect(checkRateLimit('user-a', rules).allowed).toBe(true);
    expect(checkRateLimit('user-a', rules).allowed).toBe(false);
    expect(checkRateLimit('user-b', rules).allowed).toBe(true);
  });

  it('창이 지나면 다시 열린다', () => {
    const rules = perMinute(1);
    expect(checkRateLimit('user-a', rules).allowed).toBe(true);
    expect(checkRateLimit('user-a', rules).allowed).toBe(false);

    vi.advanceTimersByTime(MINUTE + 1);
    expect(checkRateLimit('user-a', rules).allowed).toBe(true);
  });

  it('막혔을 때 남은 시간을 초 단위로 알려준다', () => {
    const rules = perMinute(1);
    checkRateLimit('user-a', rules);

    vi.advanceTimersByTime(20 * 1000);
    const result = checkRateLimit('user-a', rules);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(40);
  });

  it('거부된 요청은 카운터를 올리지 않는다 — 계속 두드려도 차단이 연장되지 않는다', () => {
    const rules = perMinute(1);
    checkRateLimit('user-a', rules);

    // 창이 끝나기 직전까지 계속 두드린다.
    for (let i = 0; i < 50; i += 1) {
      vi.advanceTimersByTime(1000);
      expect(checkRateLimit('user-a', rules).allowed).toBe(false);
    }

    // 원래 창이 끝나면 곧바로 풀려야 한다 (두드린 만큼 밀리지 않는다).
    vi.advanceTimersByTime(11 * 1000);
    expect(checkRateLimit('user-a', rules).allowed).toBe(true);
  });

  it('규칙이 여러 개면 가장 먼저 걸리는 쪽이 막는다', () => {
    // 분당 5회 / 하루 6회 — 두 번째 분에서 일일 한도에 먼저 걸린다.
    const rules: RateLimitRule[] = [
      { windowMs: MINUTE, max: 5 },
      { windowMs: DAY, max: 6 },
    ];

    for (let i = 0; i < 5; i += 1) {
      expect(checkRateLimit('user-a', rules).allowed).toBe(true);
    }
    expect(checkRateLimit('user-a', rules).allowed).toBe(false); // 분당 한도

    vi.advanceTimersByTime(MINUTE + 1); // 분당 창은 리셋, 일일 창은 유지
    expect(checkRateLimit('user-a', rules).allowed).toBe(true); // 6번째
    const blocked = checkRateLimit('user-a', rules);
    expect(blocked.allowed).toBe(false); // 일일 한도
    // 남은 시간이 하루 단위로 나와야 한다 — 분당 창이 아니라 일일 창이 막은 것이다.
    expect(blocked.retryAfterSeconds).toBeGreaterThan(MINUTE / 1000);
  });

  it('같은 사용자라도 엔드포인트가 다르면 따로 센다', () => {
    const rules = perMinute(1);
    expect(checkRateLimit('user-a:structure', rules).allowed).toBe(true);
    expect(checkRateLimit('user-a:structure', rules).allowed).toBe(false);
    expect(checkRateLimit('user-a:starwl', rules).allowed).toBe(true);
  });
});
