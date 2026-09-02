import { describe, expect, it } from 'vitest';
import {
  circularRange,
  MIN_ITEMS_FOR_LOOP,
  recenterShift,
  shortestWrappedStep,
  toRealIndex,
  fadeFalloff,
} from './circularStack';

describe('circularRange', () => {
  it('항목이 너무 적으면 순환하지 않는다', () => {
    // 2개까지는 순환해도 보이는 카드가 늘지 않아 의미가 없다 (MIN_ITEMS_FOR_LOOP 주석 참고).
    expect(circularRange(0).loop).toBe(false);
    expect(circularRange(1).loop).toBe(false);
    expect(circularRange(2).loop).toBe(false);
  });

  it('최소 개수부터 순환한다', () => {
    expect(circularRange(MIN_ITEMS_FOR_LOOP).loop).toBe(true);
  });

  it('가상 슬롯이 충분히 많아 끝에 닿을 일이 없다', () => {
    for (const count of [3, 7, 50]) {
      expect(circularRange(count).virtualCount).toBeGreaterThanOrEqual(600);
    }
  });

  it('항목이 아주 많으면 불필요하게 반복하지 않는다', () => {
    const range = circularRange(1000);
    expect(range.loops).toBe(3);
  });

  it('기준점에서 시작하면 첫 항목이 중앙에 온다', () => {
    for (const count of [3, 5, 7, 40]) {
      const range = circularRange(count);
      expect(toRealIndex(range.baseOffset, count)).toBe(0);
    }
  });
});

describe('fadeFalloff', () => {
  it('반대편 사본이 놓이는 자리에서 정확히 투명해진다', () => {
    // 순환 중 같은 항목은 중앙에서 ±itemCount/2 떨어진 자리에도 배치된다.
    // 그 지점의 불투명도가 0 이하여야 같은 카드가 두 번 보이지 않는다.
    for (const count of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const falloff = fadeFalloff(count, true);
      expect(1 - falloff * (count / 2)).toBeLessThanOrEqual(0);
    }
  });

  it('보이는 카드 수가 항목 수를 넘지 않는다', () => {
    // 기록이 3개면 가운데 1 + 위 1 + 아래 1 = 3개만 보여야 한다.
    for (const count of [3, 5, 7]) {
      const falloff = fadeFalloff(count, true);
      let visible = 0;
      for (let d = -10; d <= 10; d += 1) {
        if (1 - falloff * Math.abs(d) > 0) visible += 1;
      }
      expect(visible).toBeLessThanOrEqual(count);
    }
  });

  it('렌더 창 경계에서는 이미 투명하다 — 카드가 DOM에 들고날 때 튀지 않는 이유', () => {
    // CardStackCarousel의 RENDER_WINDOW. 이 값과 페이드 계수가 묶여 있다(그쪽 주석 참고).
    const RENDER_WINDOW = 5;
    for (const count of [3, 5, 8, 9, 10, 11, 40, 1000]) {
      const falloff = fadeFalloff(count, true);
      expect(1 - falloff * RENDER_WINDOW).toBeLessThanOrEqual(0);
    }
    expect(1 - fadeFalloff(0, false) * RENDER_WINDOW).toBeLessThanOrEqual(0);
  });

  it('항목이 많으면 기본 페이드를 그대로 쓴다', () => {
    expect(fadeFalloff(40, true)).toBe(0.22);
    expect(fadeFalloff(1000, true)).toBe(0.22);
  });

  it('순환하지 않으면 기본 페이드', () => {
    expect(fadeFalloff(1, false)).toBe(0.22);
    expect(fadeFalloff(0, false)).toBe(0.22);
  });
});

describe('shortestWrappedStep', () => {
  it('앞으로 가는 게 가까우면 양수', () => {
    expect(shortestWrappedStep(300, 2, 10)).toBe(2);
  });

  it('뒤로 도는 게 가까우면 음수', () => {
    // 0 → 9는 앞으로 9칸이지만 뒤로는 1칸이다.
    expect(shortestWrappedStep(300, 9, 10)).toBe(-1);
  });

  it('제자리면 0', () => {
    expect(shortestWrappedStep(305, 5, 10)).toBe(0);
  });

  it('어떤 경우에도 목표 항목에 정확히 도착하고, 그게 최단 경로다', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 11, 12]) {
      for (let from = 100; from < 100 + count; from += 1) {
        for (let to = 0; to < count; to += 1) {
          const step = shortestWrappedStep(from, to, count);
          expect(toRealIndex(from + step, count)).toBe(to);
          expect(Math.abs(step)).toBeLessThanOrEqual(Math.floor(count / 2));
        }
      }
    }
  });

  it('항목이 없으면 움직이지 않는다', () => {
    expect(shortestWrappedStep(5, 0, 0)).toBe(0);
  });
});

describe('toRealIndex', () => {
  it('범위 안의 인덱스는 그대로', () => {
    expect(toRealIndex(0, 5)).toBe(0);
    expect(toRealIndex(4, 5)).toBe(4);
  });

  it('범위를 넘으면 처음으로 돌아온다', () => {
    expect(toRealIndex(5, 5)).toBe(0);
    expect(toRealIndex(7, 5)).toBe(2);
  });

  it('음수도 뒤에서부터 세어 올바르게 접힌다', () => {
    // 첫 카드(0) 바로 위(-1)는 마지막 카드여야 한다 — Figma 메모의 핵심 요구.
    expect(toRealIndex(-1, 5)).toBe(4);
    expect(toRealIndex(-6, 5)).toBe(4);
  });

  it('항목이 없으면 0', () => {
    expect(toRealIndex(3, 0)).toBe(0);
  });
});

describe('recenterShift', () => {
  const count = 10;
  const range = circularRange(count);

  it('기준점 근처에서는 움직이지 않는다', () => {
    expect(recenterShift(range.baseOffset, range, count)).toBe(0);
    expect(recenterShift(range.baseOffset + count, range, count)).toBe(0);
  });

  it('멀어지면 항목 수의 배수만큼 되돌린다', () => {
    const shift = recenterShift(range.baseOffset + count * 4, range, count);
    expect(shift).toBe(-count * 4);
    // 배수여야 화면에 보이는 카드가 바뀌지 않는다 (-0도 배수이므로 절댓값으로 본다).
    expect(Math.abs(shift % count)).toBe(0);
  });

  it('반대 방향도 대칭으로 되돌린다', () => {
    expect(recenterShift(range.baseOffset - count * 4, range, count)).toBe(count * 4);
  });

  it('되돌려도 중앙에 있던 카드는 그대로다 — 이게 되돌리기가 보이지 않는 이유', () => {
    // 정확한 배수가 아닌 위치에서도 성립해야 한다 (기준점으로 딱 돌아오는 것과는 다른 성질).
    for (const offset of [count * 3, count * 3 + 2, count * 7 - 1, -count * 4 + 3]) {
      const current = range.baseOffset + offset;
      const shifted = current + recenterShift(current, range, count);
      expect(toRealIndex(shifted, count)).toBe(toRealIndex(current, count));
    }
  });

  it('임계값 바로 아래에서는 움직이지 않고, 도달하면 움직인다', () => {
    const below = range.baseOffset + count * 3 - 1;
    const at = range.baseOffset + count * 3;
    expect(recenterShift(below, range, count)).toBe(0);
    expect(recenterShift(at, range, count)).not.toBe(0);
  });

  it('순환하지 않는 스택은 되돌리지 않는다', () => {
    const single = circularRange(1);
    expect(recenterShift(999, single, 1)).toBe(0);
  });
});
