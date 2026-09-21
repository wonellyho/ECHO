// 별 하나하나의 3D 좌표를 "결정적으로" 계산한다. Math.random()을 쓰지 않는 게 이 파일의 핵심 —
// 새로고침마다 별이 다른 자리로 가면 "왼쪽 위 저 별이 그때 그 발표 경험" 같은 공간 기억이
// 성립하지 않는다. PRD §8의 성공 기준에 "회상 가능성"이 있고 이 화면이 그걸 직접 겨냥한다.
// three.js를 import하지 않는다 — WebGL 없이 vitest로 검증할 수 있어야 한다.
//
// 군집(별무리)은 에너지원/소진요인이 아니라 **태그**로 나눈다 — "패턴 탭을 태그별로 경험을
// 묶는 걸로 하자"는 요청. 태그가 6종 고정이라 그 6개 + 태그가 하나도 없는 기록을 위한
// "미분류" 1개, 총 7개의 별무리를 쓴다.

import type { ExperienceTag } from '../../types';
import { hashString, mulberry32 } from '../rng';
import { ALL_TAGS, TAG_HEX } from '../tagColors';

export type ClusterId = ExperienceTag | 'unassigned';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// 화면에 항상 나타나는 순서 — 태그 필터 칩(ALL_TAGS)과 같은 순서를 쓰고, 태그 없는 기록은
// 맨 끝에 둔다.
export const CLUSTER_ORDER: ClusterId[] = [...ALL_TAGS, 'unassigned'];

// 일곱 군집을 큰 원 위에 고르게 벌려 놓는다. 인접 군집 중심 간 거리는 RING_RADIUS·2·sin(π/7).
// "기본 거리를 좁혀 달라" 요청으로 처음(24, 간격 ~21)보다 줄였다 — 그래도 군집 최대 반경
// (MAX_CLUSTER_RADIUS 6.5)의 2배(13)는 넘어야 옆 군집과 겹쳐 보이지 않는다. z를 홀짝으로
// 살짝 어긋내 완전한 평면에 나열되지 않게 해 입체감을 준다.
const RING_RADIUS = 22;
const Z_STAGGER = 4;

export const CLUSTER_CENTERS: Record<ClusterId, Vec3> = Object.fromEntries(
  CLUSTER_ORDER.map((id, i) => {
    const angle = (i / CLUSTER_ORDER.length) * Math.PI * 2;
    return [
      id,
      {
        x: Math.cos(angle) * RING_RADIUS,
        y: Math.sin(angle) * RING_RADIUS * 0.62,
        z: i % 2 === 0 ? Z_STAGGER : -Z_STAGGER,
      },
    ];
  }),
) as Record<ClusterId, Vec3>;

// 별 색은 태그 칩·필터와 같은 기준색(TAG_HEX)을 그대로 쓴다 — "별 색깔도 태그별 색깔에
// 맞게" 요청. 화면마다 같은 태그가 다른 색으로 보이면 안 된다.
export const CLUSTER_COLORS: Record<ClusterId, string> = {
  ...TAG_HEX,
  unassigned: '#8892B0',
};

export const CLUSTER_LABELS: Record<ClusterId, string> = {
  협업: '협업',
  갈등: '갈등',
  주도성: '주도성',
  실패: '실패',
  성취: '성취',
  문제해결: '문제해결',
  unassigned: '태그 없음',
};

// BASE_RADIUS = 2.2는 대략 수십~수백 개(실사용 범위) 기록에서 밀도가 자연스럽도록 튜닝한 값이다.
const BASE_RADIUS = 2.2;

// 군집 중심 간 거리(~21)의 30% 정도로 반경 상한을 둔다. 이 클램프가 없으면 기록이 많아질 때
// 군집 반경이 중심 간 거리를 넘어서서 옆 군집과 시각적으로 겹쳐버린다.
export const MAX_CLUSTER_RADIUS = 6.5;

// 해시·난수는 우주 배경(cosmic/starfield)과 공유한다 — lib/rng.ts 참고.
export const hashId = hashString;

// 별이 늘어도 군집 안 밀도가 일정하게 유지되도록 부피에 비례해 반경을 키운다(세제곱근).
export function clusterRadius(count: number): number {
  return Math.min(BASE_RADIUS * Math.cbrt(Math.max(count, 1)), MAX_CLUSTER_RADIUS);
}

export function starPosition(entryId: string, cluster: ClusterId, clusterSize: number): Vec3 {
  // 군집을 시드에 섞어야 같은 기록이 다른 군집으로 옮겨갔을 때 자리도 따라 바뀐다. 한 기록이
  // 여러 태그 군집에 중복으로 나타날 때도 이 시드 덕분에 군집마다 다른 자리를 갖는다.
  const random = mulberry32(hashId(`${cluster}:${entryId}`));
  const theta = random() * Math.PI * 2;
  // acos(2v-1)로 φ를 뽑아야 구 표면에 고르게 퍼진다(그냥 v*π를 쓰면 양극에 몰린다).
  const phi = Math.acos(2 * random() - 1);
  // 세제곱근을 씌워야 구 "부피"에 고르게 퍼진다(안 씌우면 중심에 뭉친다).
  const radius = clusterRadius(clusterSize) * Math.cbrt(random());
  const center = CLUSTER_CENTERS[cluster];

  return {
    x: center.x + radius * Math.sin(phi) * Math.cos(theta),
    y: center.y + radius * Math.sin(phi) * Math.sin(theta),
    z: center.z + radius * Math.cos(phi),
  };
}
