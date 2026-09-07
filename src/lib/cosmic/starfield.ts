// 배경 별의 배치를 계산한다. 캔버스도 DOM도 모르는 순수 계산이라 vitest로 검증된다
// (이 프로젝트에는 jsdom이 없어 렌더 코드는 단위 테스트할 수 없다 — design.md 참고).

import { hashString, mulberry32 } from '../rng';

export interface Star {
  /** 0~1 정규 좌표. 화면 크기가 바뀌어도 별의 상대 위치는 유지된다. */
  x: number;
  y: number;
  /** CSS px 기준 반지름 */
  radius: number;
  alpha: number;
  /** 0=흰색, 1=푸른빛, 2=미색 — 색을 세 종류로만 나눠 스프라이트를 재사용한다 */
  tint: 0 | 1 | 2;
  /** 반짝임 위상. twinkle 대상이 아닌 별은 -1 */
  phase: number;
  /** 시차(parallax) 깊이. 0=가장 멀다(거의 안 움직임), 1=가장 가깝다 */
  depth: number;
}

export interface StarfieldOptions {
  count: number;
  seed: string;
  /** 반짝이는 별의 비율 (0~1). 전부 반짝이면 화면이 지직거린다. */
  twinkleRatio?: number;
  /** 별 반지름 배수 */
  scale?: number;
}

export function generateStars({
  count,
  seed,
  twinkleRatio = 0.16,
  scale = 1,
}: StarfieldOptions): Star[] {
  const random = mulberry32(hashString(seed));
  const stars: Star[] = [];

  for (let i = 0; i < Math.max(0, Math.floor(count)); i += 1) {
    // depth를 제곱해서 뽑으면 먼 별이 많고 가까운 별이 드물어진다 — 실제 하늘의 인상에 가깝다.
    const depth = random() ** 2;
    const twinkles = random() < twinkleRatio;
    stars.push({
      x: random(),
      y: random(),
      radius: (0.35 + depth * 1.15) * scale,
      alpha: 0.28 + depth * 0.62,
      tint: (Math.floor(random() * 3) as 0 | 1 | 2),
      phase: twinkles ? random() * Math.PI * 2 : -1,
      depth,
    });
  }

  return stars;
}

export interface StarfieldBudget {
  /** 실제로 그릴 별 개수 */
  count: number;
  /** 반짝임을 켤지 */
  twinkle: boolean;
}

/**
 * 기기 사양과 화면 크기로 별 예산을 정한다.
 * 별 개수는 매 프레임 비용이 아니라 "정적 버퍼를 한 번 그리는" 비용이지만, 반짝이는 별만은
 * 매 프레임 다시 그리므로 개수가 늘면 그대로 프레임 비용이 된다.
 */
export function starfieldBudget(options: {
  base: number;
  viewportWidth: number;
  cores?: number;
  reduceMotion: boolean;
}): StarfieldBudget {
  const lowCore = options.cores !== undefined && options.cores <= 4;
  const small = options.viewportWidth < 480;
  let factor = 1;
  if (lowCore && small) factor = 0.45;
  else if (lowCore || small) factor = 0.7;

  return {
    count: Math.round(options.base * factor),
    // 모션 최소화 설정이면 반짝임을 끄고 정지 화면으로 둔다 — 그러면 rAF 루프 자체가 필요 없다.
    twinkle: !options.reduceMotion,
  };
}
