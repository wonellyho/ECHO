import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CardStackCarousel, type CardStackCarouselMeta } from './CardStackCarousel';
import { CARD_COLOR_HEX, DEFAULT_CARD_COLOR } from '../lib/tagColors';
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
//
// 리디자인 이후 카드는 "색으로 꽉 채운 사각형"이 아니라 **어두운 유리판**이다. 고른 색은
// 배경 전체를 칠하는 대신 좌상단에서 옅게 번지는 tint로만 남는다 — 우주 위에 놓인 카드가
// 통째로 파스텔이면 배경과 따로 놀고, 흰 텍스트 대비도 색마다 들쭉날쭉해진다.
// (예전엔 그 대비를 맞추려고 to-br 스크림의 시작 스톱을 35%까지 올려야 했다.)
function cardTint(cardColor: CardColorKey | null): string {
  const hex = CARD_COLOR_HEX[cardColor ?? DEFAULT_CARD_COLOR];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
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
            // blur를 완전히 뺐더니 이번엔 반대로 뒤에 겹친 다른 카드들까지 비쳐 보여
            // 가시성이 떨어졌다("너무 투명해서 뒤 카드가 비친다" 피드백). 아주 약한 blur만
            // 되살려서 — 배경 사진은 여전히 또렷이 비치되, 뒤로 겹친 카드끼리는 서로 구분되게 한다.
            className="relative flex h-full flex-col overflow-hidden rounded-3xl border backdrop-blur-[3px] transition-[border-color,box-shadow] duration-200"
            style={{
              // "완전히 투명해서 배경이 보였으면" 요청으로 낮췄던 알파를 아주 조금만 다시
              // 올렸다 — 여전히 배경이 또렷이 비치는 수준을 유지하면서 카드 자체의 존재감(과
              // 뒤 카드와의 구분)만 살짝 더한다.
              background: `radial-gradient(120% 110% at 8% 0%, rgba(${cardTint(entry.card_color)}, 0.1) 0%, rgba(${cardTint(entry.card_color)}, 0.04) 38%, rgba(7, 13, 30, 0.12) 78%)`,
              // 스택에서 가운데 카드만 또렷하다 — 앞뒤 카드는 테두리도 흐리고 glow도 없다.
              borderColor: isActive ? 'rgba(255, 170, 190, 0.6)' : 'rgba(130, 160, 220, 0.2)',
              boxShadow: isActive
                ? '0 0 0 1px rgba(255,180,150,0.18), 0 0 30px -8px rgba(255,120,160,0.55)'
                : 'none',
            }}
          >
            <div
              className="relative z-10 flex h-full flex-col justify-between gap-2 px-5 py-4 text-white"
              // 카드가 거의 투명해진 만큼, 글자 자체는 색 대신 그림자로 대비를 만든다 —
              // 밝은 배경 조각 위에 놓여도 흰 글자가 묻히지 않는다.
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.5)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-[17px] font-bold text-white">
                  {entry.project_title || '제목 없음'}
                </p>
                <p className="shrink-0 pt-1 text-[11px] text-white">
                  {new Date(entry.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-white">
                {entry.situation ?? entry.raw_text}
              </p>
              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entry.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-hairline bg-[rgba(4,8,20,0.5)] px-2 py-0.5 text-[10px] font-medium text-white"
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
                  ? 'h-5 w-2'
                  : dot.size === 'near'
                    ? 'h-2 w-2 bg-ink-muted hover:bg-ink-dim'
                    : 'h-1.5 w-1.5 bg-[rgba(130,160,220,0.28)]'
              }`}
              style={dot.size === 'active' ? { background: 'var(--echo-gradient)' } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
