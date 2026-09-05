// 별 하나하나의 3D 좌표를 "결정적으로" 계산한다. Math.random()을 쓰지 않는 게 이 파일의 핵심 —
// 새로고침마다 별이 다른 자리로 가면 "왼쪽 위 저 별이 그때 그 발표 경험" 같은 공간 기억이
// 성립하지 않는다. PRD §8의 성공 기준에 "회상 가능성"이 있고 이 화면이 그걸 직접 겨냥한다.
// three.js를 import하지 않는다 — WebGL 없이 vitest로 검증할 수 있어야 한다.

export type ClusterId = 'neutral' | 'energizer' | 'drainer';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// 세 군집을 삼각 구도로 고정 배치한다. 어느 각도에서 봐도 세 덩어리로 읽히도록 z는 0으로 두고
// xy 평면에 벌려 놓았다 (별 자체는 각 중심 주위 구(球)에 흩어지므로 입체감은 거기서 나온다).
export const CLUSTER_CENTERS: Record<ClusterId, Vec3> = {
  neutral: { x: 0, y: 7, z: 0 },
  energizer: { x: -10, y: -5, z: 0 },
  drainer: { x: 10, y: -5, z: 0 },
};

export const CLUSTER_COLORS: Record<ClusterId, string> = {
  neutral: '#E8EAF2',
  energizer: '#F5B451',
  drainer: '#7C89A8',
};

export const CLUSTER_LABELS: Record<ClusterId, string> = {
  neutral: '전체 경험',
  energizer: '에너지를 얻는 순간',
  drainer: '소진되는 순간',
};

const BASE_RADIUS = 2.2;

// FNV-1a 32비트. 짧고 의존성이 없으며 비슷한 id(uuid는 앞부분이 겹치기 쉽다)도 잘 흩어준다.
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32 — seed 하나에서 서로 독립적인 난수 여러 개를 순서대로 뽑기 위한 것.
// 좌표 세 축에 같은 해시를 그대로 쓰면 별들이 대각선 위에 줄지어 선다.
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 별이 늘어도 군집 안 밀도가 일정하게 유지되도록 부피에 비례해 반경을 키운다(세제곱근).
export function clusterRadius(count: number): number {
  return BASE_RADIUS * Math.cbrt(Math.max(count, 1));
}

export function starPosition(entryId: string, cluster: ClusterId, clusterSize: number): Vec3 {
  // 군집을 시드에 섞어야 같은 기록이 다른 군집으로 옮겨갔을 때 자리도 따라 바뀐다.
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
