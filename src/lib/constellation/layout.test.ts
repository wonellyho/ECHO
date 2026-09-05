import { describe, expect, test } from 'vitest';
import {
  CLUSTER_CENTERS,
  CLUSTER_COLORS,
  CLUSTER_LABELS,
  MAX_CLUSTER_RADIUS,
  clusterRadius,
  hashId,
  starPosition,
} from './layout';

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe('hashId', () => {
  test('같은 문자열은 항상 같은 값', () => {
    expect(hashId('entry-abc')).toBe(hashId('entry-abc'));
  });

  test('다른 문자열은 다른 값', () => {
    expect(hashId('entry-abc')).not.toBe(hashId('entry-abd'));
  });

  test('빈 문자열도 유한한 정수를 낸다', () => {
    const h = hashId('');
    expect(Number.isFinite(h)).toBe(true);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe('clusterRadius', () => {
  test('별이 많아질수록 반경이 커진다', () => {
    expect(clusterRadius(20)).toBeGreaterThan(clusterRadius(3));
  });

  test('별이 0개여도 0이 아닌 반경을 낸다 (0으로 나누기 방지)', () => {
    expect(clusterRadius(0)).toBeGreaterThan(0);
  });

  test('작은 범위에서는 여전히 개수에 따라 커진다 (상한에 걸리기 전)', () => {
    expect(clusterRadius(10)).toBeGreaterThan(clusterRadius(1));
    expect(clusterRadius(10)).toBeLessThan(MAX_CLUSTER_RADIUS);
  });

  test('아주 많은 기록에서도 상한을 넘지 않는다 — 군집끼리 겹쳐서 한 덩어리로 보이면 안 된다', () => {
    expect(clusterRadius(100000)).toBe(MAX_CLUSTER_RADIUS);
    expect(clusterRadius(1000)).toBeLessThanOrEqual(MAX_CLUSTER_RADIUS);
  });
});

describe('starPosition', () => {
  test('같은 입력이면 항상 같은 좌표 — 새로고침해도 별이 같은 자리에 있어야 한다', () => {
    const a = starPosition('entry-1', 'neutral', 10);
    const b = starPosition('entry-1', 'neutral', 10);
    expect(a).toEqual(b);
  });

  test('다른 기록은 다른 자리에 놓인다', () => {
    const a = starPosition('entry-1', 'neutral', 10);
    const b = starPosition('entry-2', 'neutral', 10);
    expect(distance(a, b)).toBeGreaterThan(0);
  });

  test('같은 id라도 군집이 다르면 그 군집 중심 근처로 간다', () => {
    const e = starPosition('entry-1', 'energizer', 10);
    const d = starPosition('entry-1', 'drainer', 10);
    expect(distance(e, CLUSTER_CENTERS.energizer)).toBeLessThanOrEqual(clusterRadius(10) + 1e-9);
    expect(distance(d, CLUSTER_CENTERS.drainer)).toBeLessThanOrEqual(clusterRadius(10) + 1e-9);
  });

  test('어떤 id를 넣어도 군집 반경을 벗어나지 않는다', () => {
    const radius = clusterRadius(50);
    for (let i = 0; i < 200; i += 1) {
      const pos = starPosition(`entry-${i}`, 'neutral', 50);
      expect(distance(pos, CLUSTER_CENTERS.neutral)).toBeLessThanOrEqual(radius + 1e-9);
    }
  });

  test('좌표에 NaN이 없다', () => {
    const pos = starPosition('한글-아이디-😀', 'drainer', 7);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    expect(Number.isFinite(pos.z)).toBe(true);
  });

  test('군집이 아주 커져도 클램프된 반경 안에 머문다', () => {
    const radius = clusterRadius(100000);
    for (let i = 0; i < 50; i += 1) {
      const pos = starPosition(`entry-${i}`, 'energizer', 100000);
      expect(distance(pos, CLUSTER_CENTERS.energizer)).toBeLessThanOrEqual(radius + 1e-9);
    }
  });
});

describe('군집 상수', () => {
  test('세 군집이 서로 다른 자리에 있다', () => {
    expect(distance(CLUSTER_CENTERS.neutral, CLUSTER_CENTERS.energizer)).toBeGreaterThan(5);
    expect(distance(CLUSTER_CENTERS.energizer, CLUSTER_CENTERS.drainer)).toBeGreaterThan(5);
  });

  test('세 군집 모두 색과 이름을 갖는다', () => {
    for (const key of ['neutral', 'energizer', 'drainer'] as const) {
      expect(CLUSTER_COLORS[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(CLUSTER_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});
