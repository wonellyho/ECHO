import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EntryCardStack, type StackEntry } from './EntryCardStack';
import { pageFromScrollLeft, scrollLeftForPage } from '../lib/swipePaging';
import type { EntryGroup } from '../lib/entryGrouping';

// "컬렉션 모음" 시트(EntriesPage)에서 특정 컬렉션을 골랐을 때 그 페이지로 바로 넘기기 위한
// 외부 호출 창구. 내부 스크롤 상태를 통째로 끌어올리는 대신(그러면 스크롤 프레임마다 부모까지
// 리렌더된다) ref로 명령만 하나 노출한다.
export interface CollectionSwipeViewHandle {
  scrollToKey: (key: string) => void;
}

// 컬렉션별로 가로로 넘겨보는 뷰 (Figma 메모: "내 경험탭에서 왼쪽 오른쪽으로 스와이프하면
// 내 컬렉션에 모아둔 기록들 넘어가게 함"). 한 페이지 = 컬렉션 하나, 그 안에서는 기존 세로
// 카드 스택(EntryCardStack)을 그대로 재사용한다 — "컬렉션별로 나뉜 여러 개의 세로 스택을
// 가로로 넘긴다"는 구조라, 각 스택의 순환·페이드 등 기존 동작을 다시 만들 필요가 없다.
export const CollectionSwipeView = forwardRef<CollectionSwipeViewHandle, { groups: EntryGroup<StackEntry>[] }>(
  function CollectionSwipeView({ groups }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const [activePage, setActivePage] = useState(0);
    // 검색/필터가 바뀌어 지금 보던 컬렉션이 목록에서 사라지면, 그 자리에 우연히 온 다른
    // 컬렉션을 아무 안내 없이 보여주는 대신 처음(0번)으로 되돌린다.
    const activeKeyRef = useRef<string | null>(null);

    const recompute = useCallback(() => {
      const el = containerRef.current;
      if (!el || el.clientWidth === 0) return;
      const page = pageFromScrollLeft(el.scrollLeft, el.clientWidth, groups.length);
      setActivePage(page);
      activeKeyRef.current = groups[page]?.key ?? null;
    }, [groups]);

    const handleScroll = useCallback(() => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recompute();
      });
    }, [recompute]);

    useEffect(() => {
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    // 화면 폭이 바뀌면(회전 등) 페이지 경계가 달라지므로 다시 계산한다.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(() => recompute());
      observer.observe(el);
      return () => observer.disconnect();
    }, [recompute]);

    // 목록이 바뀌면(검색/필터) 예약된 재계산이 낡은 groups.length를 참조하지 않게 취소하고,
    // 보던 컬렉션이 여전히 있으면 그 자리를 유지, 없으면 처음으로 되돌린다.
    useEffect(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const el = containerRef.current;
      if (!el) return;
      const kept = activeKeyRef.current === null ? -1 : groups.findIndex((g) => g.key === activeKeyRef.current);
      const target = Math.max(0, kept);
      el.scrollTo({ left: scrollLeftForPage(target, el.clientWidth), behavior: 'auto' });
      recompute();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups.map((g) => g.key).join('|')]);

    function goToPage(page: number) {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ left: scrollLeftForPage(page, el.clientWidth), behavior: 'smooth' });
    }

    // "컬렉션 모음" 시트에서 고른 컬렉션으로 점프한다. groups 배열 순서는 검색/필터에 따라
    // 바뀔 수 있으므로 인덱스가 아니라 key로 찾는다.
    useImperativeHandle(
      ref,
      () => ({
        scrollToKey(key: string) {
          const index = groups.findIndex((g) => g.key === key);
          if (index !== -1) goToPage(index);
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [groups],
    );

    if (groups.length === 0) return null;

    // groups가 바뀌는 사이(예: 검색으로 목록이 줄어드는 순간) activePage가 잠깐 범위를 벗어날 수
    // 있다 — 헤더가 undefined를 렌더링해 이름/개수가 빈 채로 보이는 것을 막는다.
    const activeGroup = groups[Math.min(activePage, groups.length - 1)];

    return (
      <div>
        {/* 지금 보고 있는 컬렉션 이름 — 상단에 아이콘 토글이 없어졌으니(항상 스와이프가 기본 동작),
            "지금 어디를 보고 있는지"를 알려줄 곳이 여기뿐이다. key를 컬렉션마다 바꿔 매번 다시
            마운트시키면 넘길 때마다 살짝 아래에서 페이드인 — 그냥 텍스트가 뚝 바뀌는 것보다
            지금 페이지가 바뀌었다는 걸 분명히 알 수 있다. */}
        <div className="flex flex-col items-center gap-0.5 px-1 pb-3 text-center">
          <p key={activeGroup?.key} className="fade-in-up-enter text-base font-semibold text-slate-50">
            {activeGroup?.label}
          </p>
          <p key={`${activeGroup?.key}-count`} className="fade-in-up-enter text-xs text-slate-400">
            {activeGroup?.entries.length}개
          </p>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          // tabIndex로 키보드 포커스를 받아 화살표 키로도 페이지를 넘길 수 있게 한다.
          tabIndex={0}
          aria-label="컬렉션 스와이프"
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((group, i) => (
            <div
              key={group.key}
              role="group"
              aria-label={group.label}
              aria-hidden={i === activePage ? undefined : true}
              // 화면 밖 페이지는 포커스/스크린리더 탐색에서 뺀다 — 안 그러면 Tab이 다음 페이지의
              // 카드로 넘어가면서 브라우저가 그 페이지를 보이게 하려고 스크롤을 튀게 만든다.
              inert={i === activePage ? undefined : true}
              className="w-full shrink-0 snap-center px-0.5"
            >
              {/* group.entries를 그대로 넘긴다 — 렌더마다 새 배열/객체로 매핑하면
                  CardStackCarousel의 identity 메모(listSignature)가 매번 무효화된다. 카드 제목은
                  project_title이 있으면(옛 기록) 그 값을, 없으면 EntryCardStack 자신의 '제목
                  없음' 폴백을 그대로 쓴다 — 바로 위 헤더가 이미 컬렉션 이름을 보여주므로 카드마다
                  또 채우면 같은 이름이 중복돼 보인다(리뷰에서 지적, EntriesPage 주석 참고). */}
              <EntryCardStack entries={group.entries} />
            </div>
          ))}
        </div>

        {/* Figma 스와이프 프레임의 점 인디케이터 — 지금 몇 번째/총 몇 개 컬렉션인지 스와이프 없이도
            예측할 수 있게 한다. 탭하면 그 컬렉션으로 바로 이동 (예전 pill 바의 이동 기능 유지). */}
        {/* role 없는 순수 div엔 aria-label이 노출되지 않는 스크린리더가 많아 role="group"을 붙인다. */}
        <div
          role="group"
          aria-label="컬렉션 목록"
          className="mt-3 flex flex-wrap items-center justify-center gap-1.5"
        >
          {groups.map((group, i) => (
            <button
              key={group.key}
              type="button"
              onClick={() => goToPage(i)}
              aria-label={`${group.label}로 이동`}
              aria-current={i === activePage ? 'page' : undefined}
              className={`h-2 rounded-full transition-all ${
                i === activePage ? 'w-5 bg-slate-50' : 'w-2 bg-slate-600 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>
    );
  },
);
