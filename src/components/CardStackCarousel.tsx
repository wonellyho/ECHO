import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  circularRange,
  fadeFalloff,
  recenterShift,
  shortestWrappedStep,
  toRealIndex,
} from '../lib/circularStack';

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
// 본문 3줄은 들어가되, 컨테이너 전체 높이(step * maxVisible)가 모바일 화면 안에 넉넉히 들어오도록
// 이전보다 낮춤 — 컨테이너가 뷰포트보다 커지면 "중앙"이 화면상 중앙과 어긋나 보이는 문제가 있었다.
const DEFAULT_CARD_HEIGHT = 160;
const DEFAULT_OVERLAP = 0.45;
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

  // 스크롤은 항목 수보다 훨씬 긴 "가상 인덱스" 공간 위에서 이뤄지고, 그릴 때 나머지 연산으로
  // 실제 항목을 찾는다 — 목록의 처음과 끝이 이어져 위아래 어느 쪽으로도 끊기지 않는다.
  // 매 렌더 새 객체를 만들면 아래 콜백들의 정체성이 매 스크롤 프레임마다 바뀐다.
  const range = useMemo(() => circularRange(items.length), [items.length]);
  const lastVirtual = Math.max(0, range.virtualCount - 1);
  const initialVirtual = range.baseOffset + clamp(activeIndex ?? 0, 0, Math.max(0, items.length - 1));

  const [internalActive, setInternalActive] = useState(initialVirtual);
  const lastReportedRef = useRef(initialVirtual);
  const rafRef = useRef<number | null>(null);
  const recenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 손가락이 화면에 닿아 있는 동안에는 스크롤 위치를 건드리지 않는다 (아래 scheduleRecenter 참고).
  const pointerDownRef = useRef(false);
  // 항목 목록이 바뀌어도 보고 있던 카드를 유지하기 위한 키.
  const centeredKeyRef = useRef<string | null>(null);
  // 타이머와 스크롤 콜백이 오래된 값을 클로저로 붙잡지 않도록 최신 값을 ref로 읽는다.
  const latestRef = useRef({ range, items, getKey, step });

  // scrollTop을 0에서 시작하면 첫 페인트가 "가상 인덱스 0이 중앙"인 상태로 그려진다.
  // 실제 중앙은 baseOffset(수백 번째)이라 모든 카드가 scale 0.72 / opacity 0으로 찍히고,
  // 곧이어 레이아웃 이펙트가 위치를 잡으면 150ms 트랜지션이 걸려 카드가 스르륵 움직인다.
  // 처음부터 맞는 위치를 넣어 그 움직임을 없앤다.
  const [scrollTop, setScrollTop] = useState(
    () => padding + initialVirtual * step + step / 2 - containerHeight / 2,
  );

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

  latestRef.current = { range, items, getKey, step };

  const recompute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    const nearest = clamp(Math.round(indexFromScrollTop(el.scrollTop, el.clientHeight)), 0, lastVirtual);
    if (nearest !== lastReportedRef.current) {
      lastReportedRef.current = nearest;
      setInternalActive(nearest);
      onActiveChange?.(toRealIndex(nearest, latestRef.current.items.length));
    }
    // 목록이 바뀌어도 이 카드를 다시 찾아 중앙에 두기 위해 키를 기억해둔다.
    // 조건 밖에서 갱신해야 한 번도 스크롤하지 않은 상태에서도 값이 채워진다.
    const { items: latestItems, getKey: latestGetKey } = latestRef.current;
    const real = toRealIndex(nearest, latestItems.length);
    const centered = latestItems[real];
    centeredKeyRef.current = centered === undefined ? null : latestGetKey(centered, real);
  }, [indexFromScrollTop, lastVirtual, onActiveChange]);

  // 가상 공간의 기준점에서 너무 멀어지면 항목 수의 배수만큼 스크롤을 되돌려 놓는다.
  // 배수라서 화면에 보이는 카드는 그대로이므로 사용자는 눈치채지 못한다.
  //
  // 스크롤이 멈춘 뒤에만 실행한다 — 관성 스크롤 도중에 scrollTop을 건드리면 iOS에서
  // 관성이 끊기고 scroll-snap과도 충돌한다.
  const scheduleRecenter = useCallback(() => {
    if (recenterTimerRef.current !== null) clearTimeout(recenterTimerRef.current);
    recenterTimerRef.current = setTimeout(() => {
      recenterTimerRef.current = null;
      // 스크롤 이벤트가 180ms 없었다는 것과 "제스처가 끝났다"는 건 다르다 —
      // 손가락을 댄 채 멈춰 있으면 이벤트가 안 온다. 그때 위치를 건드리면 드래그가 튄다.
      if (pointerDownRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      // 최신 값을 ref에서 읽는다. 클로저로 잡으면 목록이 바뀐 뒤 옛 항목 수로 계산해
      // 항목 수의 배수가 아닌 만큼 움직여 중앙 카드가 바뀐다.
      const { range: currentRange, items: currentItems, step: currentStep } = latestRef.current;
      if (!currentRange.loop) return;
      const itemCount = currentItems.length;
      const current = clamp(
        Math.round(indexFromScrollTop(el.scrollTop, el.clientHeight)),
        0,
        Math.max(0, currentRange.virtualCount - 1),
      );
      const shift = recenterShift(current, currentRange, itemCount);
      if (shift === 0) return;
      el.scrollTop += shift * currentStep;
      lastReportedRef.current = current + shift;
      setInternalActive(current + shift);
      setScrollTop(el.scrollTop);
    }, 180);
  }, [indexFromScrollTop]);

  const handleScroll = useCallback(() => {
    scheduleRecenter();
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recompute();
    });
  }, [recompute, scheduleRecenter]);

  // 마운트 시 초기 activeIndex가 중앙에 오도록 즉시(애니메이션 없이) 위치를 잡는다.
  // 폰트 스왑 등으로 마운트 직후 한 프레임 뒤에 레이아웃이 미세하게 바뀌는 경우를 대비해,
  // 다음 프레임에 한 번 더 같은 위치로 보정한다 (모바일에서 포커스 카드가 중앙을 벗어나는 문제 방지).
  useLayoutEffect(() => {
    scrollToIndex(initialVirtual, 'auto');
    recompute();
    const raf = requestAnimationFrame(() => {
      scrollToIndex(initialVirtual, 'auto');
      recompute();
    });
    return () => {
      cancelAnimationFrame(raf);
      isFirstLayoutRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 목록이 바뀌면(검색/필터/정렬/추가/삭제) 가상 공간 크기와 항목 순서가 달라진다.
  // 보고 있던 카드가 새 목록에도 있으면 그 카드를 다시 중앙에 두고, 없을 때만 처음으로 돌아간다
  // — 무조건 처음으로 되돌리면 항목 하나가 추가/삭제됐을 뿐인데 읽던 자리를 잃는다.
  //
  // 페인트 전에 실행해야 한다. useEffect로 두면 수만 px을 점프한 뒤 렌더 창이 갱신되기 전
  // 한 프레임 동안 빈 스페이서만 보인다.
  // 길이와 첫 항목만 보면 정렬 방식 변경(월별/프로젝트별 등)을 놓친다 — 그 경우 길이도
  // 첫 항목도 그대로인 채 가운데 카드만 슬그머니 다른 기록으로 바뀐다.
  const listSignature = items.map((item, i) => getKey(item, i)).join('|');
  const isFirstLayoutRef = useRef(true);
  useLayoutEffect(() => {
    if (isFirstLayoutRef.current) {
      isFirstLayoutRef.current = false;
      return;
    }
    // 낡은 목록 기준으로 예약된 되돌리기는 취소한다.
    if (recenterTimerRef.current !== null) {
      clearTimeout(recenterTimerRef.current);
      recenterTimerRef.current = null;
    }
    const previousKey = centeredKeyRef.current;
    const keptIndex =
      previousKey === null ? -1 : items.findIndex((item, i) => getKey(item, i) === previousKey);
    scrollToIndex(range.baseOffset + Math.max(0, keptIndex), 'auto');
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listSignature]);

  // 제어 컴포넌트: 외부에서 activeIndex(실제 인덱스)를 바꾸면 지금 위치에서 가장 가까운
  // 같은 항목의 가상 인덱스로 스무스 스크롤한다 — 순환 중에도 최단 경로로 움직인다.
  useEffect(() => {
    if (activeIndex === undefined || items.length === 0) return;
    const current = lastReportedRef.current;
    if (toRealIndex(current, items.length) === activeIndex) return;
    const step = shortestWrappedStep(current, activeIndex, items.length);
    scrollToIndex(clamp(current + step, 0, lastVirtual));
  }, [activeIndex, items.length, lastVirtual, scrollToIndex]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (recenterTimerRef.current !== null) clearTimeout(recenterTimerRef.current);
    };
  }, []);

  if (items.length === 0) return null;

  const clientHeight = containerRef.current?.clientHeight ?? containerHeight;
  const centerIndexFloat = clamp(indexFromScrollTop(scrollTop, clientHeight), 0, lastVirtual);

  const renderStart = Math.max(0, Math.floor(centerIndexFloat) - RENDER_WINDOW);
  const renderEnd = Math.min(lastVirtual, Math.ceil(centerIndexFloat) + RENDER_WINDOW);
  const topSpacer = renderStart * step;
  const bottomSpacer = Math.max(0, lastVirtual - renderEnd) * step;
  const allIndices = Array.from(
    { length: renderEnd - renderStart + 1 },
    (_, i) => renderStart + i,
  );
  // 순환 중에는 같은 항목이 중앙에서 ±itemCount/2 떨어진 자리에도 놓인다. 항목이 적으면 그
  // 두 자리가 둘 다 보이는 위치라 같은 카드가 두 번 보이므로, 페이드를 항목 수에 맞춰
  // 가파르게 해 반대편 사본이 항상 투명하게 만든다 (circularStack.ts 참고).
  const falloff = fadeFalloff(items.length, range.loop);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      // 손가락/마우스가 닿아 있는 동안에는 되돌리기가 스크롤 위치를 건드리지 않게 한다.
      //
      // 터치는 pointer 이벤트로 잡을 수 없다 — 브라우저가 스크롤을 넘겨받는 순간
      // pointercancel이 날아오고 이후 pointer 이벤트가 오지 않는다. 정작 막아야 할 상황
      // (손가락을 댄 채 멈춰 있어 스크롤 이벤트가 끊긴 때)이 바로 그 뒤라서, pointer만
      // 보면 터치 기기에서는 사실상 무방비다. touch 이벤트는 스크롤 중에도 계속 온다.
      onPointerDown={() => {
        pointerDownRef.current = true;
      }}
      onPointerUp={() => {
        pointerDownRef.current = false;
        scheduleRecenter();
      }}
      onTouchStart={() => {
        pointerDownRef.current = true;
      }}
      onTouchEnd={() => {
        pointerDownRef.current = false;
        scheduleRecenter();
      }}
      onTouchCancel={() => {
        pointerDownRef.current = false;
      }}
      className={`relative overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ''}`}
      style={{
        height: containerHeight,
        scrollSnapType: 'y mandatory',
        paddingTop: padding,
        paddingBottom: padding,
      }}
    >
      <div style={{ height: topSpacer }} aria-hidden="true" />
      {allIndices.map((index) => {
        const realIndex = toRealIndex(index, items.length);
        const item = items[realIndex];
        const distance = index - centerIndexFloat;
        const absDist = Math.abs(distance);
        const isActive = index === internalActive;

        const scale = clamp(1 - 0.04 * absDist, 0.72, 1);
        const opacity = clamp(1 - falloff * absDist, 0, 1);

        return (
          <div
            // 같은 항목이 여러 번 나타나므로 가상 인덱스까지 넣어야 키가 유일해진다.
            key={`${getKey(item, realIndex)}#${index}`}
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
                  transition: 'transform 150ms ease-out, opacity 150ms ease-out',
                  pointerEvents: isActive ? undefined : 'none',
                } satisfies CSSProperties
              }
              className="w-full"
              // 중앙 카드가 아닌 것들은 탭 순서와 스크린리더에서 뺀다 — 스택은 하나의
              // 캐러셀로 읽혀야 하고, 뒤에 깔린 카드까지 전부 링크로 훑게 만들면 안 된다.
              // pointer-events를 끄는 건 "탭하면 그 카드를 중앙으로" 동작을 위해서도 필요하다.
              // 클릭이 이 래퍼를 통과해 부모 슬롯의 onClickCapture까지 가야 하기 때문이다.
              aria-hidden={isActive ? undefined : true}
              inert={isActive ? undefined : true}
            >
              {renderItem(item, { index: realIndex, isActive, distance })}
            </div>
          </div>
        );
      })}
      <div style={{ height: bottomSpacer }} aria-hidden="true" />
    </div>
  );
}
