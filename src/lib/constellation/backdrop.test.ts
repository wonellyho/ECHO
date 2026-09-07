import { describe, expect, it } from 'vitest';
import { backdropScale, generateBackdropStars } from './backdrop';

describe('generateBackdropStars', () => {
  it('요청한 개수만큼 좌표와 색을 만든다', () => {
    const layer = generateBackdropStars(50, 7, 80, 140);
    expect(layer.positions).toHaveLength(150);
    expect(layer.colors).toHaveLength(150);
  });

  it('같은 seed면 항상 같은 하늘이 나온다 (새로고침해도 별자리가 유지돼야 한다)', () => {
    const a = generateBackdropStars(20, 42, 80, 140);
    const b = generateBackdropStars(20, 42, 80, 140);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });

  it('seed가 다르면 다른 하늘이 나온다', () => {
    const a = generateBackdropStars(20, 1, 80, 140);
    const b = generateBackdropStars(20, 2, 80, 140);
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  it('모든 별이 지정한 구각 안에 있다', () => {
    const { positions } = generateBackdropStars(200, 3, 80, 140);
    for (let i = 0; i < positions.length; i += 3) {
      const radius = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
      expect(radius).toBeGreaterThanOrEqual(80 - 1e-3);
      expect(radius).toBeLessThanOrEqual(140 + 1e-3);
    }
  });

  it('색은 0~1 범위를 벗어나지 않는다', () => {
    const { colors } = generateBackdropStars(200, 5, 80, 140);
    for (const channel of colors) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it('개수가 0이거나 음수면 빈 배열을 만든다', () => {
    expect(generateBackdropStars(0, 1, 80, 140).positions).toHaveLength(0);
    expect(generateBackdropStars(-5, 1, 80, 140).positions).toHaveLength(0);
  });
});

describe('backdropScale', () => {
  it('여유 있는 기기에서는 그대로 그린다', () => {
    expect(backdropScale({ cores: 8, minViewport: 900, reduceMotion: false })).toBe(1);
  });

  it('코어가 적거나 화면이 작으면 줄인다', () => {
    expect(backdropScale({ cores: 4, minViewport: 900, reduceMotion: false })).toBe(0.6);
    expect(backdropScale({ cores: 8, minViewport: 390, reduceMotion: false })).toBe(0.6);
  });

  it('저사양 모바일이면 가장 많이 줄인다', () => {
    expect(backdropScale({ cores: 4, minViewport: 390, reduceMotion: false })).toBe(0.35);
  });

  it('모션 최소화 설정이면 사양과 무관하게 줄인다', () => {
    expect(backdropScale({ cores: 16, minViewport: 1400, reduceMotion: true })).toBe(0.5);
  });

  it('코어 정보를 모르면 저사양으로 단정하지 않는다', () => {
    expect(backdropScale({ minViewport: 900, reduceMotion: false })).toBe(1);
  });
});
