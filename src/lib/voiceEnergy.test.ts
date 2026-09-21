import { describe, expect, it } from 'vitest';
import { bandEnergies, breathe, envelopeCoefficient, followEnvelope } from './voiceEnergy';

function spectrum(length: number, fill: (index: number) => number): Uint8Array {
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) arr[i] = fill(i);
  return arr;
}

describe('bandEnergies', () => {
  it('무음(전부 0)이면 모든 대역이 0', () => {
    const result = bandEnergies(spectrum(512, () => 0));
    expect(result).toEqual({ low: 0, mid: 0, high: 0 });
  });

  it('최대치(전부 255)면 모든 대역이 1', () => {
    const result = bandEnergies(spectrum(512, () => 255));
    expect(result.low).toBeCloseTo(1);
    expect(result.mid).toBeCloseTo(1);
    expect(result.high).toBeCloseTo(1);
  });

  it('저역에만 에너지가 있으면 low만 올라간다', () => {
    // bin 2~20 (전체 512의 0.4%~4%) = low 구간에만 값을 넣는다.
    const result = bandEnergies(spectrum(512, (i) => (i >= 2 && i < 20 ? 255 : 0)));
    expect(result.low).toBeGreaterThan(0.5);
    expect(result.mid).toBe(0);
    expect(result.high).toBe(0);
  });

  it('고역에만 에너지가 있으면 high만 올라간다', () => {
    // bin 100~190 (전체 512의 19.5%~37%) = high 구간.
    const result = bandEnergies(spectrum(512, (i) => (i >= 100 && i < 190 ? 255 : 0)));
    expect(result.high).toBeGreaterThan(0.3);
    expect(result.low).toBe(0);
    expect(result.mid).toBe(0);
  });

  it('bin 개수가 달라져도 비율 기준이라 동작한다', () => {
    const result = bandEnergies(spectrum(128, () => 128));
    expect(result.low).toBeGreaterThan(0);
    expect(result.mid).toBeGreaterThan(0);
    expect(result.high).toBeGreaterThan(0);
  });

  it('노이즈 플로어 아래의 잔여 잡음은 0으로 잘라낸다', () => {
    // 0.06(=15/255) 이하만 잘라낸다. 무음 차단의 주된 장치는 useMicAnalyser의 minDecibels이고,
    // 여기서는 남은 잔여분만 다듬는다 — 크게 자르면 조용한 마이크의 실제 발화까지 먹는다.
    const result = bandEnergies(spectrum(512, () => 12));
    expect(result.low).toBe(0);
    expect(result.mid).toBe(0);
    expect(result.high).toBe(0);
  });

  it('플로어 바로 위는 0에서 다시 펴진다 (계단이 생기지 않게)', () => {
    const quiet = bandEnergies(spectrum(512, () => 20)).low;
    const loud = bandEnergies(spectrum(512, () => 200)).low;
    expect(quiet).toBeGreaterThan(0);
    expect(quiet).toBeLessThan(0.1);
    expect(loud).toBeGreaterThan(0.7);
  });

  it('입력이 작은 마이크의 보통 발화도 충분히 반응한다', () => {
    // 노트북 내장 마이크 수준(눈금의 40% 언저리)에서도 시각화가 눈에 띄게 움직여야 한다.
    expect(bandEnergies(spectrum(512, () => 102)).low).toBeGreaterThan(0.3);
  });
});

describe('envelopeCoefficient', () => {
  it('60fps(약 16.7ms)에서는 원래 계수를 거의 그대로 쓴다', () => {
    expect(envelopeCoefficient(0.14, 1 / 60)).toBeCloseTo(0.14, 6);
  });

  it('120fps에서는 계수가 절반 가까이로 줄어 같은 속도를 유지한다', () => {
    const at120 = envelopeCoefficient(0.14, 1 / 120);
    expect(at120).toBeGreaterThan(0.06);
    expect(at120).toBeLessThan(0.08);
  });

  it('30fps에서는 계수가 커져 같은 속도를 유지한다', () => {
    const at30 = envelopeCoefficient(0.14, 1 / 30);
    expect(at30).toBeGreaterThan(0.25);
    expect(at30).toBeLessThan(0.27);
  });

  it('두 프레임에 걸친 결과가 한 번에 두 배 간격으로 간 것과 같다', () => {
    const step = envelopeCoefficient(0.14, 1 / 60);
    const twice = 1 - (1 - step) * (1 - step);
    expect(twice).toBeCloseTo(envelopeCoefficient(0.14, 2 / 60), 10);
  });

  it('프레임이 오래 비어도 상한 때문에 한 번에 튀지 않는다', () => {
    expect(envelopeCoefficient(0.14, 5)).toBe(envelopeCoefficient(0.14, 0.1));
    expect(envelopeCoefficient(0.14, 5)).toBeLessThan(1);
  });

  it('음수 간격도 안전하게 처리한다', () => {
    expect(envelopeCoefficient(0.14, -1)).toBe(0);
  });
});

describe('followEnvelope', () => {
  it('올라갈 때는 attack 계수를 쓴다', () => {
    expect(followEnvelope(0, 1, 0.5, 0.1)).toBeCloseTo(0.5);
  });

  it('내려갈 때는 release 계수를 쓴다', () => {
    expect(followEnvelope(1, 0, 0.5, 0.1)).toBeCloseTo(0.9);
  });

  it('목표에 도달하면 더 움직이지 않는다', () => {
    expect(followEnvelope(0.4, 0.4, 0.5, 0.1)).toBeCloseTo(0.4);
  });

  it('반복하면 목표값으로 수렴한다', () => {
    let value = 0;
    for (let i = 0; i < 200; i += 1) value = followEnvelope(value, 0.8, 0.2, 0.05);
    expect(value).toBeCloseTo(0.8, 3);
  });

  it('release가 attack보다 느리면 상승이 하강보다 빠르다', () => {
    const rise = followEnvelope(0.5, 1, 0.2, 0.05) - 0.5;
    const fall = 0.5 - followEnvelope(0.5, 0, 0.2, 0.05);
    expect(rise).toBeGreaterThan(fall);
  });
});

describe('breathe', () => {
  it('항상 0~1 범위 안에 있다', () => {
    for (let t = 0; t < 120; t += 0.37) {
      const value = breathe(t, 9.1, 1.3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('한 주기가 지나도 값이 그대로 반복되지 않는다 (패턴이 눈에 띄지 않도록)', () => {
    const period = 9.1;
    expect(breathe(0, period, 0)).not.toBeCloseTo(breathe(period, period, 0), 3);
  });

  it('위상이 다르면 같은 시각에 다른 값을 낸다', () => {
    expect(breathe(3, 9.1, 0)).not.toBeCloseTo(breathe(3, 9.1, 2.4), 3);
  });
});
