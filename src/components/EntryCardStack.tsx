import { Link } from 'react-router-dom';
import { CardStackCarousel, type CardStackCarouselMeta } from './CardStackCarousel';
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

// 첫 번째 태그로 카드 그라디언트를 정한다 (design.md 참고). 태그가 없으면 중립 그레이.
function cardGradient(tags: ExperienceTag[]): string {
  const primary = tags[0];
  return primary ? TAG_GRADIENTS[primary] : NEUTRAL_CARD_GRADIENT;
}

// 내 경험 탭의 카드 스택 — 범용 CardStackCarousel 위에 엔트리 카드 렌더링/그라디언트만 얹은 어댑터.
// entries는 이미 원하는 정렬 순서로 정렬돼 들어온다고 가정한다 (EntriesPage 참고).
export function EntryCardStack({ entries }: { entries: StackEntry[] }) {
  return (
    <CardStackCarousel
      items={entries}
      getKey={(entry) => entry.id}
      renderItem={(entry, { isActive }: CardStackCarouselMeta) => (
        <Link
          to={`/entries/${entry.id}`}
          onClick={(e) => {
            // active 카드가 아닐 때의 첫 탭은 CardStackCarousel이 캡처 단계에서 막아 "중앙으로 이동"만
            // 시키므로, 여기 도달했다는 건 이미 active 상태에서 눌렀다는 뜻 — 정상적으로 이동시킨다.
            if (!isActive) e.preventDefault();
          }}
          className={`flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br px-5 py-4 shadow-lg shadow-black/10 ${cardGradient(
            entry.tags,
          )}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-bold text-white">{entry.project_title || '제목 없음'}</p>
            <p className="shrink-0 text-[11px] text-white/70">
              {new Date(entry.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <p className="line-clamp-1 text-sm text-white/90">{entry.situation ?? entry.raw_text}</p>
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </Link>
      )}
    />
  );
}
