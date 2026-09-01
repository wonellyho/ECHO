import { describe, expect, it } from 'vitest';
import { smoothPath } from './smoothPath';

describe('smoothPath', () => {
  it('빈 배열이면 빈 문자열', () => {
    expect(smoothPath([])).toBe('');
  });

  it('점이 하나면 그 높이의 수평선', () => {
    expect(smoothPath([0.5])).toBe('M 0 50 L 100 50');
  });

  it('점이 둘이면 직선', () => {
    expect(smoothPath([0, 1])).toBe('M 0 100 L 100 0');
  });

  it('값이 클수록 y가 작아진다 (위로 솟는다)', () => {
    expect(smoothPath([0])).toBe('M 0 100 L 100 100');
    expect(smoothPath([1])).toBe('M 0 0 L 100 0');
  });

  it('세 점 이상이면 cubic bezier로 잇는다', () => {
    const d = smoothPath([0, 1, 0]);
    expect(d.startsWith('M 0 100')).toBe(true);
    // 구간이 두 개이므로 C 명령도 두 개.
    expect(d.match(/C/g)).toHaveLength(2);
  });

  it('모든 원본 점을 그대로 통과한다', () => {
    const d = smoothPath([0.2, 0.8, 0.4, 0.6]);
    // 각 구간의 끝점이 원본 점 좌표와 일치해야 한다.
    expect(d).toContain('33.33 20');
    expect(d).toContain('66.67 60');
    expect(d).toContain('100 40');
  });

  it('x는 0에서 100까지 균등 배치된다', () => {
    const d = smoothPath([0.5, 0.5, 0.5]);
    expect(d.startsWith('M 0 50')).toBe(true);
    expect(d.endsWith('100 50')).toBe(true);
  });
});
