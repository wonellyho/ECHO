import { describe, expect, it } from 'vitest';
import { buildCloudScene, type CloudLayer } from './clouds';

const MILKY: CloudLayer = {
  kind: 'milkyway',
  angle: -30,
  offsetY: 0.3,
  thickness: 0.4,
  density: 1,
  brightness: 1,
};

describe('buildCloudScene', () => {
  it('같은 seed면 항상 같은 하늘이 나온다 (화면을 오가도 성운이 바뀌면 안 된다)', () => {
    expect(buildCloudScene([MILKY], 'login')).toEqual(buildCloudScene([MILKY], 'login'));
  });

  it('seed가 다르면 다른 하늘이 나온다 (화면마다 다른 우주 영역)', () => {
    expect(buildCloudScene([MILKY], 'login')).not.toEqual(buildCloudScene([MILKY], 'pattern'));
  });

  it('은하수는 빛·암흑성운·잔별을 모두 만든다', () => {
    const scene = buildCloudScene([MILKY], 's');
    expect(scene.glow.length).toBeGreaterThan(50);
    // 암흑성운이 없으면 균일한 얼룩으로 보인다 — 반드시 있어야 한다.
    expect(scene.dark.length).toBeGreaterThan(10);
    // 잔별이 없으면 그냥 안개다.
    expect(scene.stars.length).toBeGreaterThan(100);
  });

  it('density를 낮추면 도형 수가 함께 줄어든다 (저사양 대응)', () => {
    const full = buildCloudScene([MILKY], 's');
    const lite = buildCloudScene([{ ...MILKY, density: 0.4 }], 's');
    expect(lite.glow.length).toBeLessThan(full.glow.length);
    expect(lite.stars.length).toBeLessThan(full.stars.length);
  });

  it('brightness는 알파에만 영향을 준다 (모양은 그대로)', () => {
    const a = buildCloudScene([MILKY], 's');
    const b = buildCloudScene([{ ...MILKY, brightness: 0.5 }], 's');
    expect(b.glow.map((g) => g.x)).toEqual(a.glow.map((g) => g.x));
    expect(b.glow[0].alpha).toBeCloseTo(a.glow[0].alpha * 0.5);
  });

  it('성단은 link가 켜졌을 때만 별을 잇는다', () => {
    const base = { kind: 'cluster', x: 0.5, y: 0.5, radius: 0.1, count: 12, brightness: 1 } as const;
    expect(buildCloudScene([base], 's').links).toHaveLength(0);
    expect(buildCloudScene([{ ...base, link: true }], 's').links).toHaveLength(4);
  });

  it('여러 레이어를 합쳐도 link가 자기 레이어의 별을 가리킨다', () => {
    const cluster = {
      kind: 'cluster' as const,
      x: 0.5,
      y: 0.5,
      radius: 0.1,
      count: 10,
      brightness: 1,
      link: true,
    };
    const scene = buildCloudScene([MILKY, cluster], 's');
    const milkyStars = buildCloudScene([MILKY], 's').stars.length;
    // 은하수 잔별 다음부터가 성단 별이다.
    expect(scene.links[0].from).toBe(milkyStars);
    for (const link of scene.links) {
      expect(scene.stars[link.from]).toBeDefined();
      expect(scene.stars[link.to]).toBeDefined();
    }
  });

  it('알파는 0~1 범위를 벗어나지 않는다', () => {
    const scene = buildCloudScene(
      [
        MILKY,
        { kind: 'nebula', x: 0.3, y: 0.6, radius: 0.3, color: '120, 90, 200', brightness: 1 },
        { kind: 'galaxy', x: 0.8, y: 0.2, size: 0.1, angle: 20, brightness: 1 },
        { kind: 'cluster', x: 0.2, y: 0.8, radius: 0.12, count: 20, brightness: 1, link: true },
      ],
      's',
    );
    for (const blob of [...scene.glow, ...scene.dark]) {
      expect(blob.alpha).toBeGreaterThan(0);
      expect(blob.alpha).toBeLessThanOrEqual(1);
    }
    for (const star of scene.stars) {
      expect(star.alpha).toBeGreaterThan(0);
      expect(star.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('레이어가 없으면 빈 장면', () => {
    expect(buildCloudScene([], 's')).toEqual({ glow: [], dark: [], stars: [], links: [] });
  });
});
