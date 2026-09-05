// 카드 스택을 세로로 넘길 때 "몇 번째 카드에 와 있는지" 보여주는 점 인디케이터의 점 목록을
// 계산하는 순수 함수 (EntryCardStack.tsx에서 사용). 컬렉션 스와이프 뷰의 점 인디케이터와
// 달리, 한 컬렉션 안 기록 수는 수십~수백 개로 늘어날 수 있어 전부 점으로 그리면 한 줄에
// 다 안 들어가고 의미도 없어진다. iOS UIPageControl의 automatic(축소) 표시를 참고해,
// 활성 카드를 중심으로 한 창(window)만 보여주고 창의 양 끝은(실제 처음/끝이 아니면) 더 작은
// 점으로 그려 "이 너머에 더 있다"는 걸 암시한다.

export type PagerDotSize = 'active' | 'near' | 'edge';

export interface PagerDot {
  /** 전체 목록 기준 인덱스. */
  index: number;
  size: PagerDotSize;
}

/**
 * @param total 전체 카드 수
 * @param active 지금 활성 카드의 인덱스 (0-based, 범위를 벗어나면 안쪽으로 clamp)
 * @param maxDots 한 번에 보여줄 점의 최대 개수 (홀수 권장 — 활성 점이 정확히 가운데 오도록)
 */
export function pagerDots(total: number, active: number, maxDots = 7): PagerDot[] {
  if (total <= 0) return [];
  const clampedActive = Math.min(Math.max(active, 0), total - 1);

  if (total <= maxDots) {
    return Array.from({ length: total }, (_, index) => ({
      index,
      size: index === clampedActive ? 'active' : 'near',
    }));
  }

  const half = Math.floor(maxDots / 2);
  let start = clampedActive - half;
  let end = start + maxDots - 1;
  if (start < 0) {
    start = 0;
    end = maxDots - 1;
  }
  if (end > total - 1) {
    end = total - 1;
    start = end - maxDots + 1;
  }

  const dots: PagerDot[] = [];
  for (let i = start; i <= end; i += 1) {
    let size: PagerDotSize = i === clampedActive ? 'active' : 'near';
    // 창의 끝이 실제 목록의 끝이 아닐 때만 축소 표시한다 — 진짜 마지막/처음 점까지
    // 작게 그리면 "여기가 끝"이라는 신호가 사라진다.
    if ((i === start && start > 0) || (i === end && end < total - 1)) size = 'edge';
    dots.push({ index: i, size });
  }
  return dots;
}
