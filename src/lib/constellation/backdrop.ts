// 경험과 무관한 "배경 별" — 깊이감만 담당한다. 경험 별(StarNode)과 달리 의미가 없으므로
// 클릭 대상이 아니고, 개수만 기기 성능에 맞춰 줄인다.
// layout.ts와 같은 이유로 three.js를 import하지 않는다 (vitest로 검증 가능해야 한다).

import { mulberry32 } from './layout';

export interface BackdropLayer {
  positions: Float32Array;
  colors: Float32Array;
}

// 배경 별 색. 완전한 흰색만 쓰면 인쇄물처럼 납작해 보인다 — 푸른빛/미색을 아주 옅게 섞는다.
const TINTS: [number, number, number][] = [
  [1, 1, 1],
  [0.78, 0.85, 1],
  [1, 0.94, 0.85],
  [0.85, 0.92, 1],
];

/**
 * 반지름 [minRadius, maxRadius] 구각(shell)에 별을 결정적으로 흩뿌린다.
 * 경험 별과 마찬가지로 seed 기반이라 새로고침해도 하늘이 그대로다.
 */
export function generateBackdropStars(
  count: number,
  seed: number,
  minRadius: number,
  maxRadius: number,
): BackdropLayer {
  const safeCount = Math.max(0, Math.floor(count));
  const positions = new Float32Array(safeCount * 3);
  const colors = new Float32Array(safeCount * 3);
  const random = mulberry32(seed);

  for (let i = 0; i < safeCount; i += 1) {
    const theta = random() * Math.PI * 2;
    // acos(2v-1)이라야 구면에 고르게 퍼진다 (starPosition과 같은 이유).
    const phi = Math.acos(2 * random() - 1);
    const radius = minRadius + (maxRadius - minRadius) * random();

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    const tint = TINTS[Math.floor(random() * TINTS.length)] ?? TINTS[0];
    // 밝기를 별마다 다르게 줘야 "가까운 별 / 먼 별"이 구분된다.
    const brightness = 0.45 + random() * 0.55;
    colors[i * 3] = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;
  }

  return { positions, colors };
}

export interface DeviceProfile {
  /** navigator.hardwareConcurrency (없으면 undefined) */
  cores?: number;
  /** 화면 짧은 쪽 픽셀 수 — 모바일 판별용 */
  minViewport: number;
  reduceMotion: boolean;
}

/**
 * 기기 사양에 따라 배경 별 개수를 줄인다. 배경 별은 순수 장식이라 저사양 기기에서 가장 먼저
 * 깎아야 하는 대상이다(경험 별은 데이터라서 개수를 임의로 줄일 수 없다).
 */
/**
 * 배경 장식(은하수 겹, 먼지 띠, 천체)을 얼마나 그릴지. 개수(backdropScale)와 따로 두는 이유는
 * 이쪽 비용이 별 개수가 아니라 **큰 면적에 걸린 blur 레이어 수**에서 나오기 때문이다.
 * 모션 최소화는 여기에 영향을 주지 않는다 — 정지한 배경은 디테일이 많아도 부담이 아니다.
 */
export function backgroundDetail(profile: DeviceProfile): 'full' | 'lite' {
  const lowCore = profile.cores !== undefined && profile.cores <= 4;
  return lowCore || profile.minViewport < 480 ? 'lite' : 'full';
}

export function backdropScale(profile: DeviceProfile): number {
  if (profile.reduceMotion) return 0.5;
  const lowCore = profile.cores !== undefined && profile.cores <= 4;
  const smallScreen = profile.minViewport < 480;
  if (lowCore && smallScreen) return 0.35;
  if (lowCore || smallScreen) return 0.6;
  return 1;
}
