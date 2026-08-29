import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export interface CardStackCarouselMeta {
  index: number;
  isActive: boolean;
  /** 활성 카드까지의 거리 (카드 "칸" 단위, 연속값 — 스크롤 중엔 소수점을 오간다). */
  distance: number;
}

export interface CardStackCarouselProps<T> {
  items: T[];
  renderItem: (item: T, meta: CardStackCarouselMeta) => ReactNode;
  getKey: (item: T, index: number) => string;
  /** 컨테이너 안에 동시에 "보이는" 것으로 칠 카드 수 — 컨테이너 높이 = cardStep * maxVisible. */
  maxVisible?: number;
  /** 제어 컴포넌트로 쓸 때: 바뀌면 그 인덱스가 중앙으로 스무스 스크롤된다. */
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
  /** 카드 자체의 시각적 높이(px). step(카드 간 간격)보다 커야 겹침이 생긴다. */
  cardHeight?: number;
  /** 카드끼리 얼마나 겹칠지 (0~1). step = cardHeight * (1 - overlap). */
  overlap?: number;
  className?: string;
}

const DEFAULT_MAX_VISIBLE = 6;
const DEFAULT_CARD_HEIGHT = 108;
const DEFAULT_OVERLAP = 0.52;
// 활성 카드에서 이 칸 수 이상 떨어진 카드는 렌더링 자체를 하지 않는다 (가상화 — 카드가 아무리
// 많아져도 DOM에는 항상 이 범위만큼만 떠 있다).
const RENDER_WINDOW = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 화면 중앙에 가장 가까운 카드가 "active"로 확대·선명해지고, 멀어질수록 작아지고 흐려지며
 * 서로 겹쳐 보이는 세로형 카드 스택 캐러셀 (cover-flow 스타일).
 *
 * 스크롤/스와이프/모멘텀은 실제 브라우저 스크롤(overflow-y: auto)에 맡기고, 스냅은 네이티브
 * CSS `scroll-snap`으로 처리한다 — 커스텀 물리 엔진을 새로 만들지 않아 가볍고 안정적이다.
 * activeIndex는 스크롤 위치를 카드 간격(step)으로 나눈 산술 계산으로 구하므로(요청된 두 방식 중
 * "컨테이너 중심과의 거리 계산" 방식), 매 프레임 DOM을 읽는 IntersectionObserver/getBoundingClientRect
 * 없이도 카드가 수백 개로 늘어나도 계산 비용이 일정하다.
 */
export function CardStackCarousel<T>({
  items,
  renderItem,
  getKey,
  maxVisible = DEFAULT_MAX_VISIBLE,
  activeIndex,
  onActiveChange,
  cardHeight = DEFAULT_CARD_HEIGHT,
  overlap = DEFAULT_OVERLAP,
  className,
}: CardStackCarouselProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const step = cardHeight * (1 - overlap);
  const containerHeight = step * maxVisible;
  const padding = Math.max(0, (containerHeight - step) / 2);
  const lastCount = Math.max(0, items.length - 1);

  const [internalActive, setInternalActive] = useState(() => clamp(activeIndex ?? 0, 0, lastCount));
  const lastReportedRef = useRef(internalActive);
  const rafRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const indexFromScrollTop = useCallback(
    (top: number, clientHeight: number) => (top + clientHeight / 2 - padding - step / 2) / step,
    [padding, step],
  );

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const el = containerRef.current;
      if (!el) return;
      const target = padding + index * step + step / 2 - el.clientHeight / 2;
      el.scrollTo({ top: target, behavior });
    },
    [padding, step],
  );

  const recompute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    const nearest = clamp(Math.round(indexFromScrollTop(el.scrollTop, el.clientHeight)), 0, lastCount);
    if (nearest !== lastReportedRef.current) {
      lastReportedRef.current = nearest;
      setInternalActive(nearest);
      onActiveChange?.(nearest);
    }
  }, [indexFromScrollTop, lastCount, onActiveChange]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recompute();
    });
  }, [recompute]);

  // 마운트 시 초기 activeIndex가 중앙에 오도록 즉시(애니메이션 없이) 위치를 잡는다.
  useLayoutEffect(() => {
    scrollToIndex(clamp(activeIndex ?? 0, 0, lastCount), 'auto');
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 항목 개수가 바뀌면(필터링 등) 범위를 다시 계산한다.
  useEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // 제어 컴포넌트: 외부에서 activeIndex를 바꾸면 그 카드가 중앙에 오도록 스무스 스크롤한다.
  useEffect(() => {
    if (activeIndex === undefined || activeIndex === lastReportedRef.current) return;
    scrollToIndex(clamp(activeIndex, 0, lastCount));
  }, [activeIndex, lastCount, scrollToIndex]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (items.length === 0) return null;

  const clientHeight = containerRef.current?.clientHeight ?? containerHeight;
  const centerIndexFloat = clamp(indexFromScrollTop(scrollTop, clientHeight), 0, lastCount);

  const renderStart = Math.max(0, Math.floor(centerIndexFloat) - RENDER_WINDOW);
  const renderEnd = Math.min(lastCount, Math.ceil(centerIndexFloat) + RENDER_WINDOW);
  const topSpacer = renderStart * step;
  const bottomSpacer = Math.max(0, lastCount - renderEnd) * step;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`relative overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ''}`}
      style={{
        height: containerHeight,
        scrollSnapType: 'y mandatory',
        paddingTop: padding,
        paddingBottom: padding,
      }}
    >
      <div style={{ height: topSpacer }} aria-hidden="true" />
      {items.slice(renderStart, renderEnd + 1).map((item, i) => {
        const index = renderStart + i;
        const distance = index - centerIndexFloat;
        const absDist = Math.abs(distance);
        const isActive = index === internalActive;

        const scale = clamp(1 - 0.04 * absDist, 0.72, 1);
        const opacity = clamp(1 - 0.22 * absDist, 0, 1);
        const blur = clamp((absDist - 0.4) * 1.4, 0, 3);

        return (
          <div
            key={getKey(item, index)}
            style={{ height: step, zIndex: Math.round(1000 - absDist * 10), scrollSnapAlign: 'center' }}
            className="relative flex items-center justify-center"
            onClickCapture={(e) => {
              // 중앙(active)이 아닌 카드를 탭하면 우선 그 카드를 중앙으로 가져올 뿐, 내부의
              // 링크/버튼 클릭(상세 이동 등)은 이번 탭에서는 발동하지 않게 막는다.
              if (isActive) return;
              e.preventDefault();
              e.stopPropagation();
              scrollToIndex(index);
            }}
          >
            <div
              style={
                {
                  height: cardHeight,
                  transform: `scale(${scale})`,
                  opacity,
                  filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
                  transition: 'transform 150ms ease-out, opacity 150ms ease-out, filter 150ms ease-out',
                } satisfies CSSProperties
              }
              className="w-full"
            >
              {renderItem(item, { index, isActive, distance })}
            </div>
          </div>
        );
      })}
      <div style={{ height: bottomSpacer }} aria-hidden="true" />
    </div>
  );
}
