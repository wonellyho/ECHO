// 사용자별 호출 제한.
//
// 인증(auth.ts)이 익명 공격을 막고 나면 남는 위험은 "가입한 사람이 반복해서 태우는 것"이다.
// 그 사람은 이메일로 가입을 거쳐야 하므로 문턱이 훨씬 높지만, 그래도 한 계정이 무한정
// 호출할 수 있어서는 안 된다.
//
// ── 이 구현의 한계를 분명히 해둔다 ────────────────────────────────────────
// 카운터를 메모리에 둔다. 서버리스 함수는 인스턴스가 여러 개 뜰 수 있으므로, 이 제한은
// **인스턴스 단위**다 — 인스턴스가 3개면 실질 허용량도 3배가 된다. 즉 이것은 "폭주를
// 늦추는 장치"이지 정확한 쿼터가 아니다.
//
// 그럼에도 메모리로 둔 이유: DB 기반 쿼터는 테이블 추가(= Supabase SQL 실행)가 필요한데,
// 그건 배포 직전에 넣을 변경이 아니다. Vercel Fluid Compute는 인스턴스를 재사용하므로
// 한 사람이 몰아치는 전형적인 패턴은 이것만으로도 상당 부분 걸린다.
//
// **금액의 진짜 상한은 코드가 아니라 Anthropic Console의 지출 한도(spend limit)다.**
// 그쪽을 반드시 함께 걸어둘 것. 정확한 쿼터가 필요해지면 Supabase 테이블 기반으로 옮긴다.

interface Window {
  /** 이 창이 끝나는 시각 (epoch ms) */
  resetAt: number;
  count: number;
}

const buckets = new Map<string, Window>();

/** 메모리가 무한정 늘지 않도록, 만료된 창은 접근할 때마다 조금씩 걷어낸다. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitRule {
  /** 창 길이 (ms) */
  windowMs: number;
  /** 창 안에서 허용할 횟수 */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** 막혔을 때, 몇 초 뒤에 다시 시도할 수 있는지 */
  retryAfterSeconds: number;
}

/**
 * 같은 key(보통 `${사용자ID}:${엔드포인트}`)에 대해 여러 규칙을 동시에 적용한다.
 * 분당 제한은 폭주를, 일일 제한은 총량을 막는다 — 둘 중 하나라도 걸리면 거부한다.
 */
export function checkRateLimit(key: string, rules: RateLimitRule[]): RateLimitResult {
  const now = Date.now();
  sweep(now);

  // 먼저 모든 규칙을 확인하고, 하나라도 막히면 **아무 카운터도 올리지 않는다.**
  // 거부된 요청까지 카운트에 넣으면, 계속 두드리는 클라이언트가 자기 차단 시간을
  // 무한히 연장시키게 된다.
  for (const rule of rules) {
    const window = buckets.get(`${key}|${rule.windowMs}`);
    if (window && window.resetAt > now && window.count >= rule.max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
      };
    }
  }

  for (const rule of rules) {
    const bucketKey = `${key}|${rule.windowMs}`;
    const window = buckets.get(bucketKey);
    if (!window || window.resetAt <= now) {
      buckets.set(bucketKey, { resetAt: now + rule.windowMs, count: 1 });
    } else {
      window.count += 1;
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * LLM 호출 엔드포인트의 기본 제한.
 *
 * 사람이 실제로 기록을 남기는 속도를 생각하면 분당 6회도 넉넉하다 — 한 번 기록할 때마다
 * 구조화 1회가 돌고, 실패 시 재시도가 몇 번 더 붙는 정도다. 일일 60회면 하루에 경험
 * 수십 개를 기록해도 남는다.
 */
export const LLM_RATE_LIMIT: RateLimitRule[] = [
  { windowMs: MINUTE, max: 6 },
  { windowMs: DAY, max: 60 },
];

/** 테스트에서 상태를 비우기 위한 것. 운영 경로에서는 쓰지 않는다. */
export function resetRateLimitsForTest() {
  buckets.clear();
}
