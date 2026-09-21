import { describe, expect, it } from 'vitest';
import { pageFromScrollLeft, scrollLeftForPage } from './swipePaging';

describe('pageFromScrollLeft', () => {
  it('정확히 페이지 경계에 있으면 그 페이지', () => {
    expect(pageFromScrollLeft(0, 300, 3)).toBe(0);
    expect(pageFromScrollLeft(300, 300, 3)).toBe(1);
    expect(pageFromScrollLeft(600, 300, 3)).toBe(2);
  });

  it('가장 가까운 페이지로 반올림한다', () => {
    expect(pageFromScrollLeft(140, 300, 3)).toBe(0);
    expect(pageFromScrollLeft(160, 300, 3)).toBe(1);
  });

  it('범위를 벗어나면 양 끝으로 고정한다', () => {
    expect(pageFromScrollLeft(-50, 300, 3)).toBe(0);
    expect(pageFromScrollLeft(10000, 300, 3)).toBe(2);
  });

  it('페이지가 없으면 0', () => {
    expect(pageFromScrollLeft(300, 300, 0)).toBe(0);
  });

  it('페이지 폭이 0이어도 나누기 오류 없이 0을 준다', () => {
    expect(pageFromScrollLeft(100, 0, 3)).toBe(0);
  });
});

describe('scrollLeftForPage', () => {
  it('페이지 번호 × 폭', () => {
    expect(scrollLeftForPage(0, 300)).toBe(0);
    expect(scrollLeftForPage(2, 300)).toBe(600);
  });
});
