// 컬렉션 스와이프 뷰의 페이지 계산 (CollectionSwipeView에서 사용).
// 페이지 폭이 전부 같다고 가정하는 단순 가로 페이징이라, 계산도 순수 함수로 뺄 만큼 간단하다.

/** 현재 스크롤 위치가 몇 번째 페이지에 가장 가까운지. */
export function pageFromScrollLeft(scrollLeft: number, pageWidth: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  if (pageWidth <= 0) return 0;
  const raw = Math.round(scrollLeft / pageWidth);
  return Math.min(pageCount - 1, Math.max(0, raw));
}

/** 특정 페이지로 이동하려면 scrollLeft를 얼마로 맞춰야 하는지. */
export function scrollLeftForPage(page: number, pageWidth: number): number {
  return page * pageWidth;
}
