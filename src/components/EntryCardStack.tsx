import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NEUTRAL_CARD_GRADIENT, TAG_GRADIENTS } from '../lib/tagColors';
import type { ExperienceTag } from '../types';

export interface StackEntry {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  situation: string | null;
  tags: ExperienceTag[];
}

// 최대 몇 장까지 "노출"된 것으로 볼지 — 그 이상은 스크롤로 접근 (cardscroll.jpg 참고).
const MAX_VISIBLE_CARDS = 6;
// 접힌 카드 하나가 겹침 이후 실제로 추가하는 높이(대략치, px-5 py-4 한 줄 기준).
const COLLAPSED_PEEK_HEIGHT = 12;
// 펼쳐진 카드의 대략적인 최대 높이(태그 2줄 기준 여유 포함).
const EXPANDED_CARD_HEIGHT = 240;

// 첫 번째 태그로 카드 그라디언트를 정한다 (design.md 참고). 태그가 없으면 중립 그레이.
function cardGradient(tags: ExperienceTag[]): string {
  const primary = tags[0];
  return primary ? TAG_GRADIENTS[primary] : NEUTRAL_CARD_GRADIENT;
}

// 내 경험 탭의 겹쳐 쌓인 카드 스택. 항목을 탭하면 그 카드만 펼쳐지고 나머지는 접힌다.
// 카드가 MAX_VISIBLE_CARDS보다 많으면 스크롤 영역으로 감싸고 위아래 가장자리를 페이드 처리한다.
// entries는 이미 원하는 정렬 순서로 정렬돼 들어온다고 가정한다 (EntriesPage 참고).
export function EntryCardStack({ entries }: { entries: StackEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(entries[0]?.id ?? null);

  // 필터/정렬이 바뀌어 현재 펼쳐진 카드가 더 이상 목록에 없으면 최신 카드로 되돌린다.
  useEffect(() => {
    if (entries.length === 0) {
      setExpandedId(null);
      return;
    }
    if (!entries.some((entry) => entry.id === expandedId)) {
      setExpandedId(entries[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  function expand(el: HTMLElement, id: string) {
    setExpandedId(id);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const needsScroll = entries.length > MAX_VISIBLE_CARDS;
  const maxHeight = EXPANDED_CARD_HEIGHT + (MAX_VISIBLE_CARDS - 1) * COLLAPSED_PEEK_HEIGHT;
  const edgeFade = 'linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)';

  return (
    <div
      className={needsScroll ? 'overflow-y-auto scroll-smooth' : undefined}
      style={
        needsScroll
          ? { maxHeight, WebkitMaskImage: edgeFade, maskImage: edgeFade }
          : undefined
      }
    >
      <div className="flex flex-col">
        {entries.map((entry, index) => {
          const isExpanded = entry.id === expandedId;
          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={(e) => expand(e.currentTarget, entry.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  expand(e.currentTarget, entry.id);
                }
              }}
              style={{ zIndex: entries.length - index, marginTop: index === 0 ? 0 : -44 }}
              className={`relative cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br text-left shadow-lg shadow-black/10 transition-all duration-200 ${cardGradient(
                entry.tags,
              )} ${isExpanded ? 'p-5' : 'px-5 py-4'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-bold text-white">{entry.project_title || '제목 없음'}</p>
                {isExpanded && <span className="shrink-0 text-xs text-white/80">접기 ⌄</span>}
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-3">
                  <div className="h-px bg-white/25" />
                  <p className="text-sm leading-relaxed text-white/90">{entry.situation ?? entry.raw_text}</p>
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/70">{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
                    <Link
                      to={`/entries/${entry.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white/90"
                    >
                      상세 보기
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
