import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CardStackCarousel, type CardStackCarouselMeta } from './CardStackCarousel';
import { CARD_COLOR_GRADIENTS, DEFAULT_CARD_COLOR } from '../lib/tagColors';
import { pagerDots } from '../lib/pagerDots';
import type { CardColorKey, ExperienceTag } from '../types';

export interface StackEntry {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  situation: string | null;
  tags: ExperienceTag[];
  card_color: CardColorKey | null;
}

// 저장 시점에 사용자가 직접 고른 카드 색 (design.md 참고). 옛 기록처럼 값이 없으면 기본색.
function cardGradient(cardColor: CardColorKey | null): string {
  return CARD_COLOR_GRADIENTS[cardColor ?? DEFAULT_CARD_COLOR];
}

// 내 경험 탭의 카드 스택 — 범용 CardStackCarousel 위에 엔트리 카드 렌더링/그라디언트만 얹은 어댑터.
// entries는 이미 원하는 정렬 순서로 정렬돼 들어온다고 가정한다 (EntriesPage 참고).
// 인라인 화살표로 두면 렌더마다 정체성이 바뀌어 스택 쪽 메모이제이션이 무효가 된다.
const entryKey = (entry: StackEntry) => entry.id;

export function EntryCardStack({ entries }: { entries: StackEntry[] }) {
  // 애플 스타일 페이지 인디케이터 요청 — 컬렉션 하나에 카드가 몇 개든 "지금 몇 번째 카드에
  // 와 있는지" 아래 점으로 보여준다. 컨트롤드 activeIndex로 넘기면 점을 눌러 바로 그 카드로
  // 점프하는 것도 함께 된다(CardStackCarousel이 이미 지원하는 계약).
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    // 인디케이터를 스택 아래가 아니라 옆에 세로로 둔다 — 세로로 넘기는 스택인데 점이 가로로
    // 아래 깔리면 스택의 고정 높이(containerHeight)만큼 자리를 차지한 "뒤"에 더 얹히는
    // 셈이라, 화면이 낮은 기기에서는 그 추가 줄이 화면 아래로 밀려 스크롤해야만 보이거나
    // (기기별로 있다 없다 하는 것처럼 느껴짐) 아예 잘렸다. flex row로 묶어 items-stretch를
    // 주면 이 열이 스택과 똑같은 높이를 갖고, 그 안에서 세로 중앙 정렬되어 항상 카드와
    // 나란히 보인다 — 화면 크기와 무관하게 스택이 보이는 한 인디케이터도 함께 보인다.
    <div className="flex items-stretch gap-2">
      <CardStackCarousel
        className="min-w-0 flex-1"
        items={entries}
        getKey={entryKey}
        activeIndex={activeIndex}
        onActiveChange={setActiveIndex}
        renderItem={(entry, { isActive }: CardStackCarouselMeta) => (
          <Link
            to={`/entries/${entry.id}`}
            onClick={(e) => {
              // active 카드가 아닐 때의 첫 탭은 CardStackCarousel이 캡처 단계에서 막아 "중앙으로
              // 이동"만 시키므로, 여기 도달했다는 건 이미 active 상태에서 눌렀다는 뜻 — 정상적으로
              // 이동시킨다.
              if (!isActive) e.preventDefault();
            }}
            className={`relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br shadow-lg shadow-black/10 ${cardGradient(
              entry.card_color,
            )}`}
          >
            {/* Figma 카드는 좌상단이 짙은 남색, 우하단이 옅은 파스텔인 대각선(to-br) 그라디언트라,
                흰 텍스트를 그대로 얹으면 밝은 구간에서 대비가 깨진다. 스크림도 반드시 같은 to-br
                방향이어야 한다 — 세로(to-b) 스크림을 얹으면 카드 대각선과 축이 어긋나서, 대각선상
                밝기가 같은 두 지점(예: 우상단과 좌하단)에 서로 다른 세기가 걸려 한쪽은 과하게
                가려지고 다른 쪽은 그대로 밝은 채 남는다. 같은 축으로 맞추면 카드가 밝아지는
                속도만큼 스크림도 짙어져, 카드 위 어느 위치든 밑바탕 밝기가 균일하게 눌린다. */}
            <div
              aria-hidden="true"
              // to-br 스크림의 알파는 좌상단 모서리에서 0이다 — 제목이 앉는 자리(px-5 py-4, 카드
              // 좌상단 근처)는 그라디언트 진행도가 0.1 안팎이라 이전 스톱(from-black/0)에서는
              // 거의 안 눌린다. 밝은 카드색(rose #EAAEA5, coral #E58F91)에서 이게 흰 텍스트 대비를
              // 2~3:1까지 떨어뜨렸다(리뷰에서 발견) — 시작 스톱을 0이 아니라 35%로 올려 카드
              // 전체에 최소한의 어두운 바닥을 깔고, 우하단으로 갈수록 더 짙어지는 흐름은 유지한다.
              // (30%로 처음 올렸을 때 rose(#EAAEA5) 제목만 4.31~4.36:1로 근소하게 미달해 재검증
              // 후 35%로 한 단 더 올림 — 이제 5색 전부 4.5:1 이상.)
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/35 via-black/50 to-black/80"
            />
            <div className="relative z-10 flex h-full flex-col justify-between gap-1.5 px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-bold text-white">{entry.project_title || '제목 없음'}</p>
                {/* 11px 작은 글자라 white/85로는 rose/coral 카드에서 4.5:1을 간신히 못 넘길 수
                    있다(리뷰 지적) — 여유를 두려고 불투명 흰색으로 올림. */}
                <p className="shrink-0 text-[11px] text-white">
                  {new Date(entry.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <p className="line-clamp-3 flex-1 text-sm leading-snug text-white/95">
                {entry.situation ?? entry.raw_text}
              </p>
              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.tags.slice(0, 3).map((tag) => (
                    // 배지는 자기 배경이 있는 별도 레이어라 카드 밝기와 무관하게 대비가 고정된다 —
                    // 반투명 흰색(bg-white/20)은 밝은 카드 구간 위에서 배지 자체도 함께 밝아져
                    // 흰 글자와 거의 구분되지 않았다.
                    <span
                      key={tag}
                      className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        )}
      />

      {/* 애플식 페이지 점 인디케이터 (pagerDots.ts 참고) — 카드가 많으면 활성 카드 주변
          창(window)만 보여주고 창 양 끝은 축소해 "더 있다"는 걸 암시한다. 세로로 넘기는
          스택이라 점도 세로로 쌓는다. */}
      {entries.length > 1 && (
        <div role="group" aria-label="카드 위치" className="flex w-2 shrink-0 flex-col items-center justify-center gap-1.5">
          {pagerDots(entries.length, activeIndex).map((dot) => (
            <button
              key={dot.index}
              type="button"
              onClick={() => setActiveIndex(dot.index)}
              aria-label={`${dot.index + 1}번째 카드로 이동`}
              aria-current={dot.size === 'active' ? 'true' : undefined}
              className={`shrink-0 rounded-full transition-all ${
                dot.size === 'active'
                  ? 'h-5 w-2 bg-slate-50'
                  : dot.size === 'near'
                    ? 'h-2 w-2 bg-slate-500 hover:bg-slate-400'
                    : 'h-1.5 w-1.5 bg-slate-700'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
