import { describe, expect, it } from 'vitest';
import { backgroundDetail, generateStars, starfieldBudget } from './starfield';

describe('generateStars', () => {
  it('요청한 개수만큼 만든다', () => {
    expect(generateStars({ count: 120, seed: 'login' })).toHaveLength(120);
  });

  it('같은 seed면 항상 같은 하늘이 나온다 (화면을 오가도 별이 재배치되면 안 된다)', () => {
    const a = generateStars({ count: 40, seed: 'record' });
    const b = generateStars({ count: 40, seed: 'record' });
    expect(a).toEqual(b);
  });

  it('seed가 다르면 다른 하늘이 나온다 (화면마다 다른 우주 영역)', () => {
    const a = generateStars({ count: 40, seed: 'login' });
    const b = generateStars({ count: 40, seed: 'pattern' });
    expect(a).not.toEqual(b);
  });

  it('좌표는 0~1, alpha는 0~1 범위 안에 있다', () => {
    for (const star of generateStars({ count: 300, seed: 'x' })) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(1);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(1);
      expect(star.alpha).toBeGreaterThan(0);
      expect(star.alpha).toBeLessThanOrEqual(1);
      expect([0, 1, 2]).toContain(star.tint);
    }
  });

  it('twinkleRatio가 0이면 반짝이는 별이 하나도 없다', () => {
    const stars = generateStars({ count: 200, seed: 'x', twinkleRatio: 0 });
    expect(stars.every((star) => star.phase === -1)).toBe(true);
  });

  it('twinkleRatio가 1이면 전부 반짝인다', () => {
    const stars = generateStars({ count: 200, seed: 'x', twinkleRatio: 1 });
    expect(stars.every((star) => star.phase >= 0)).toBe(true);
  });

  it('scale은 반지름에만 곱해진다', () => {
    const base = generateStars({ count: 10, seed: 'x' });
    const doubled = generateStars({ count: 10, seed: 'x', scale: 2 });
    doubled.forEach((star, i) => {
      expect(star.radius).toBeCloseTo(base[i].radius * 2);
      expect(star.x).toBe(base[i].x);
    });
  });

  it('개수가 0이거나 음수면 빈 배열', () => {
    expect(generateStars({ count: 0, seed: 'x' })).toHaveLength(0);
    expect(generateStars({ count: -3, seed: 'x' })).toHaveLength(0);
  });
});

describe('starfieldBudget', () => {
  it('여유 있는 기기에서는 그대로 그린다', () => {
    expect(starfieldBudget({ base: 200, viewportWidth: 1200, cores: 8, reduceMotion: false })).toEqual({
      count: 200,
      twinkle: true,
    });
  });

  it('코어가 적거나 화면이 좁으면 줄인다', () => {
    expect(starfieldBudget({ base: 200, viewportWidth: 390, cores: 8, reduceMotion: false }).count).toBe(140);
    expect(starfieldBudget({ base: 200, viewportWidth: 1200, cores: 4, reduceMotion: false }).count).toBe(140);
  });

  it('저사양 모바일이면 가장 많이 줄인다', () => {
    expect(starfieldBudget({ base: 200, viewportWidth: 390, cores: 4, reduceMotion: false }).count).toBe(90);
  });

  it('모션 최소화면 반짝임을 끈다 (rAF 루프 자체가 필요 없어진다)', () => {
    expect(starfieldBudget({ base: 200, viewportWidth: 1200, cores: 8, reduceMotion: true }).twinkle).toBe(false);
  });

  it('코어 정보를 모르면 저사양으로 단정하지 않는다', () => {
    expect(starfieldBudget({ base: 200, viewportWidth: 1200, reduceMotion: false }).count).toBe(200);
  });
});

describe('backgroundDetail', () => {
  it('여유 있는 기기에서는 배경 장식을 다 그린다', () => {
    expect(backgroundDetail({ cores: 8, minViewport: 900 })).toBe('full');
  });

  it('모바일 폭이거나 코어가 적으면 장식 겹 수를 줄인다', () => {
    expect(backgroundDetail({ cores: 8, minViewport: 390 })).toBe('lite');
    expect(backgroundDetail({ cores: 4, minViewport: 900 })).toBe('lite');
  });

  it('코어 정보를 모르면 저사양으로 단정하지 않는다', () => {
    expect(backgroundDetail({ minViewport: 900 })).toBe('full');
  });
});
