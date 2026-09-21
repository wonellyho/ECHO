import { describe, expect, test } from 'vitest';
import { joinWithSpace, mergeAtCursor } from './transcriptMerge';

describe('joinWithSpace', () => {
  test('inserts a space between two non-empty pieces with no boundary whitespace', () => {
    expect(joinWithSpace('안녕', '하세요')).toBe('안녕 하세요');
  });

  test('does not double a trailing space on the left piece', () => {
    expect(joinWithSpace('안녕 ', '하세요')).toBe('안녕 하세요');
  });

  test('does not double a leading space on the right piece', () => {
    expect(joinWithSpace('안녕', ' 하세요')).toBe('안녕 하세요');
  });

  test('returns the other piece unchanged when one side is empty', () => {
    expect(joinWithSpace('', '하세요')).toBe('하세요');
    expect(joinWithSpace('안녕', '')).toBe('안녕');
  });
});

describe('mergeAtCursor', () => {
  test('splices newly recognized speech between prefix and suffix', () => {
    expect(mergeAtCursor('오늘 발표에서', '갑자기 화면이 꺼져서', '당황했다')).toBe(
      '오늘 발표에서 갑자기 화면이 꺼져서 당황했다',
    );
  });

  test('falls back to plain append when suffix is empty (cursor at end)', () => {
    expect(mergeAtCursor('오늘 발표에서', '갑자기 화면이 꺼졌다', '')).toBe(
      '오늘 발표에서 갑자기 화면이 꺼졌다',
    );
  });

  test('handles empty recognized speech (no result yet) without inventing spaces', () => {
    expect(mergeAtCursor('오늘', '', '있었다')).toBe('오늘 있었다');
  });

  test('handles cursor at the very start (empty prefix)', () => {
    expect(mergeAtCursor('', '갑자기', '화면이 꺼졌다')).toBe('갑자기 화면이 꺼졌다');
  });
});
