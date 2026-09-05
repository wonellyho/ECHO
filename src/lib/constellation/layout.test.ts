import { describe, expect, test } from 'vitest';
import {
  CLUSTER_CENTERS,
  CLUSTER_COLORS,
  CLUSTER_LABELS,
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
