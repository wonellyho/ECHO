import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('0은 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('초는 두 자리로 채운다', () => {
    expect(formatDuration(6_000)).toBe('0:06');
  });

  it('1분 직전', () => {
    expect(formatDuration(59_000)).toBe('0:59');
  });

  it('정확히 1분', () => {
    expect(formatDuration(60_000)).toBe('1:00');
  });

  it('10분 이상도 분 단위를 그대로 늘린다', () => {
    expect(formatDuration(630_000)).toBe('10:30');
  });

  it('1초 미만은 내림해서 0:00', () => {
    expect(formatDuration(999)).toBe('0:00');
  });

  it('음수는 0:00으로 클램프', () => {
    expect(formatDuration(-5_000)).toBe('0:00');
  });
});
