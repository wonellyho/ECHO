import { describe, expect, test } from 'vitest';
import { pagerDots } from './pagerDots';

describe('pagerDots', () => {
  test('returns nothing for an empty list', () => {
    expect(pagerDots(0, 0)).toEqual([]);
  });

  test('shows every dot when total is within the cap', () => {
    const dots = pagerDots(5, 2, 7);
    expect(dots.map((d) => d.index)).toEqual([0, 1, 2, 3, 4]);
    expect(dots.find((d) => d.index === 2)?.size).toBe('active');
    expect(dots.filter((d) => d.size === 'edge')).toEqual([]);
  });

  test('windows around the active index once total exceeds the cap', () => {
    const dots = pagerDots(20, 10, 7);
    expect(dots).toHaveLength(7);
    expect(dots.map((d) => d.index)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect(dots.find((d) => d.index === 10)?.size).toBe('active');
  });

  test('marks the truncated window edges as "edge", not the real start/end', () => {
    const dots = pagerDots(20, 10, 7);
    expect(dots[0].size).toBe('edge'); // index 7, real start is 0
    expect(dots[dots.length - 1].size).toBe('edge'); // index 13, real end is 19
  });

  test('does not mark the real first item as "edge" even when it is at the window boundary', () => {
    const dots = pagerDots(20, 0, 7);
    expect(dots.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dots[0].size).toBe('active');
    expect(dots[dots.length - 1].size).toBe('edge'); // 6 is not the real end (19)
  });

  test('does not mark the real last item as "edge" even when it is at the window boundary', () => {
    const dots = pagerDots(20, 19, 7);
    expect(dots.map((d) => d.index)).toEqual([13, 14, 15, 16, 17, 18, 19]);
    expect(dots[0].size).toBe('edge');
    expect(dots[dots.length - 1].size).toBe('active');
  });

  test('clamps an out-of-range active index into bounds', () => {
    const dots = pagerDots(5, 99, 7);
    expect(dots.find((d) => d.size === 'active')?.index).toBe(4);
  });
});
