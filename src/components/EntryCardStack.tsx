import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TAG_COLORS } from '../lib/tagColors';
import type { ExperienceTag } from '../types';

export interface StackEntry {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  situation: string | null;
  tags: ExperienceTag[];
}

// 내 경험 탭의 겹쳐 쌓인 카드 스택. 항목을 탭하면 그 카드만 펼쳐지고 나머지는 접힌다.
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

  return (
    <div className="flex flex-col">
      {entries.map((entry, index) => {
        const isExpanded = entry.id === expandedId;
        return (
          <div
            key={entry.id}
            role="button"
            tabIndex={0}
            onClick={() => setExpandedId(entry.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExpandedId(entry.id);
              }
            }}
            style={{ zIndex: entries.length - index, marginTop: index === 0 ? 0 : -8 }}
            className={`relative cursor-pointer rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 ${
              isExpanded ? 'p-4' : 'p-3 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">{entry.project_title || '제목 없음'}</p>
              {isExpanded && <span className="shrink-0 text-xs text-slate-400">접기 ⌄</span>}
            </div>

            {isExpanded && (
              <div className="mt-3 space-y-3">
                <div className="h-px bg-slate-100" />
                <p className="text-sm leading-relaxed text-slate-700">{entry.situation ?? entry.raw_text}</p>
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLORS[tag]}`}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
                  <Link
                    to={`/entries/${entry.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
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
  );
}
