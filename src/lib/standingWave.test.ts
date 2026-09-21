import { describe, expect, it } from 'vitest';
import { WAVE_POINTS, wavePeaks } from './standingWave';

// 이 파형의 요구사항은 "얇은 선 위로 솟는 봉우리가, 흐르지 않고 제자리에서 일렁인다"이다.
// 아래 테스트들이 그 성질을 고정한다 — 이력을 밀어내는(흐르는) 구현으로 되돌아가면 깨진다.
describe('wavePeaks', () => {
  it('양 끝은 언제나 선에 붙어 있다 (봉우리 높이 0)', () => {
    for (const seconds of [0, 0.7, 3.3, 12.9, 60]) {
      const peaks = wavePeaks(seconds, 1, 1, 0);
      expect(peaks[0]).toBeCloseTo(0, 10);
      expect(peaks[peaks.length - 1]).toBeCloseTo(0, 10);
    }
  });

  it('소리가 없으면(drive 0) 봉우리 없이 완전히 평평하다', () => {
    for (const peak of wavePeaks(4.2, 0, 1, 0)) {
      expect(peak).toBe(0);
    }
  });

  it('봉우리는 항상 선 위쪽이다 — 음수가 나오지 않는다', () => {
    for (const seconds of [0, 1.3, 4.8, 11.2]) {
      for (const peak of wavePeaks(seconds, 1, 1, 0)) {
        expect(peak).toBeGreaterThanOrEqual(0);
        expect(peak).toBeLessThanOrEqual(1);
      }
    }
  });

  it('소리가 있으면 가운데가 확실히 솟는다', () => {
    // 시간에 따라 진폭이 오르내리므로 여러 시각 중 하나에서는 확실히 솟아야 한다.
    const middle = Math.floor(WAVE_POINTS / 2);
    const heights = [0, 0.5, 1, 1.5, 2, 2.5, 3].map((t) => wavePeaks(t, 1, 1, 0)[middle]);
    expect(Math.max(...heights)).toBeGreaterThan(0.05);
  });

  it('봉우리가 좁다 — 폭 절반 이상을 통째로 채우지 않는다', () => {
    // Figma 형태는 좁은 스파이크다. 넓은 산맥이 되면 "네모박스"처럼 보인다.
    const peaks = wavePeaks(0.4, 1, 1, 0);
    const max = Math.max(...peaks);
    const raised = peaks.filter((p) => p > max * 0.5).length;
    expect(raised).toBeLessThan(WAVE_POINTS * 0.5);
  });

  it('패턴이 옆으로 밀려가지 않는다 — 흐르는 파형과 구분되는 핵심 성질', () => {
    // 이력을 밀어내는 구현이라면 잠시 뒤의 파형은 "지금 파형을 옆으로 이동시킨 것"과 같아진다.
    // 정상파는 제자리에서 진폭만 오르내리므로, 가장 잘 겹치는 이동량이 항상 0이어야 한다.
    const bestShift = (seconds: number, delta: number) => {
      const a = wavePeaks(seconds, 0.5, 1, 0);
      const b = wavePeaks(seconds + delta, 0.5, 1, 0);
      let best = 0;
      let bestScore = -Infinity;
      for (let shift = -10; shift <= 10; shift += 1) {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i += 1) {
          const j = i + shift;
          if (j < 0 || j >= b.length) continue;
          dot += a[i] * b[j];
          normA += a[i] * a[i];
          normB += b[j] * b[j];
        }
        const score = dot / Math.sqrt(normA * normB || 1);
        if (score > bestScore) {
          bestScore = score;
          best = shift;
        }
      }
      return best;
    };

    for (let seconds = 0; seconds < 40; seconds += 0.37) {
      expect(bestShift(seconds, 0.1)).toBe(0);
    }
  });

  it('진폭 배율이 작을수록 낮게 솟는다', () => {
    const peakOf = (amplitude: number) => Math.max(...wavePeaks(0.4, 1, amplitude, 0));
    expect(peakOf(0.44)).toBeLessThan(peakOf(1));
  });
});
