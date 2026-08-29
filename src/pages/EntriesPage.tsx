import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, type GroupBy } from '../lib/entryGrouping';
import { TAG_COLORS, TAG_COLORS_ACTIVE } from '../lib/tagColors';
import type { ExperienceTag } from '../types';

const ALL_TAGS: ExperienceTag[] = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'month', label: '월별' },
  { value: 'project', label: '프로젝트별' },
  { value: 'collection', label: '컬렉션별' },
];

const NEW_COLLECTION_VALUE = '__new__';

interface EntryRow {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
  situation: string | null;
  tags: ExperienceTag[];
}

interface CollectionOption {
  id: string;
  name: string;
}

export function EntriesPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<ExperienceTag | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCollectionChoice, setBulkCollectionChoice] = useState('');
  const [newBulkCollectionName, setNewBulkCollectionName] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEntries() {
    setLoading(true);
    const [{ data: entryRows }, { data: tagRows }, { data: structuredRows }, { data: collectionRows }] =
      await Promise.all([
        supabase
          .from('entries')
          .select('id, raw_text, created_at, project_title, collection_id')
          .order('created_at', { ascending: false }),
        supabase.from('entry_tags').select('entry_id, tag'),
        supabase.from('entries_structured').select('entry_id, situation'),
        supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
      ]);

    const tagsByEntry = new Map<string, ExperienceTag[]>();
    (tagRows ?? []).forEach((row) => {
      const list = tagsByEntry.get(row.entry_id) ?? [];
      list.push(row.tag as ExperienceTag);
      tagsByEntry.set(row.entry_id, list);
    });

    const situationByEntry = new Map<string, string | null>();
    (structuredRows ?? []).forEach((row) => {
      situationByEntry.set(row.entry_id, row.situation);
    });

    setEntries(
      (entryRows ?? []).map((e) => ({
        ...e,
        situation: situationByEntry.get(e.id) ?? null,
        tags: tagsByEntry.get(e.id) ?? [],
      })),
    );
    setCollections((collectionRows ?? []) as CollectionOption[]);
    setLoading(false);
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
    setBulkCollectionChoice('');
    setNewBulkCollectionName('');
    setBulkError(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulkAddToCollection() {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    setBulkError(null);
    try {
      let collectionId = bulkCollectionChoice;

      if (bulkCollectionChoice === NEW_COLLECTION_VALUE) {
        const trimmedName = newBulkCollectionName.trim();
        if (!trimmedName) throw new Error('새 컬렉션 이름을 입력해주세요.');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        const { data: created, error: createError } = await supabase
          .from('collections')
          .insert({ user_id: user.id, name: trimmedName })
          .select()
          .single();
        if (createError) throw createError;
        collectionId = created.id;
        setCollections((prev) => [{ id: created.id, name: created.name }, ...prev]);
      }

      if (!collectionId) throw new Error('컬렉션을 선택해주세요.');

      const { error: updateError } = await supabase
        .from('entries')
        .update({ collection_id: collectionId })
        .in('id', Array.from(selectedIds));
      if (updateError) throw updateError;

      const finalCollectionId = collectionId;
      setEntries((prev) =>
        prev.map((e) => (selectedIds.has(e.id) ? { ...e, collection_id: finalCollectionId } : e)),
      );
      toggleSelectMode();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : '컬렉션에 추가하지 못했습니다.');
    } finally {
      setBulkSaving(false);
    }
  }

  // MVP 검색: 태그 필터 + 키워드 매칭. 추후 임베딩 기반 유사도 검색으로 고도화 예정 (CLAUDE.md 참고)
  const filtered = filterEntries(entries, activeTag, query);
  const groups = groupEntries(filtered, groupBy, collections);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">내 경험 기록</h2>
        <button
          type="button"
          onClick={toggleSelectMode}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          {selectMode ? '선택 취소' : '선택'}
        </button>
      </div>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTag === tag ? TAG_COLORS_ACTIVE[tag] : TAG_COLORS[tag]
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        {GROUP_BY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={groupBy === opt.value}
            onClick={() => setGroupBy(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              groupBy === opt.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">불러오는 중...</p>}
      {!loading && filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">기록이 없습니다.</p>}

      {groups.map((group) => (
        <section key={group.key} className="mt-5">
          <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {group.entries.map((entry) => {
              const cardBody = (
                <>
                  <div>
                    <p className="text-xs font-medium text-slate-500">{entry.project_title || '제목 없음'}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-800">{entry.situation ?? entry.raw_text}</p>
                  </div>
                  <p className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
                </>
              );

              if (selectMode) {
                const selected = selectedIds.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => toggleSelected(entry.id)}
                    className={`relative flex h-36 flex-col justify-between rounded-lg p-3 text-left shadow-sm transition-colors ${
                      selected ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`absolute right-2 top-2 h-4 w-4 rounded-full border-2 ${
                        selected ? 'border-white bg-white' : 'border-slate-300'
                      }`}
                    />
                    {cardBody}
                  </button>
                );
              }

              return (
                <Link
                  key={entry.id}
                  to={`/entries/${entry.id}`}
                  className="flex h-36 flex-col justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  {cardBody}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white p-3 shadow-[0_-1px_4px_rgba(0,0,0,0.05)]">
          <p className="text-xs text-slate-500">{selectedIds.size}개 선택됨</p>
          <div className="flex gap-2">
            <select
              value={bulkCollectionChoice}
              onChange={(e) => setBulkCollectionChoice(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">컬렉션 선택</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_COLLECTION_VALUE}>+ 새 컬렉션 만들기</option>
            </select>
            <button
              type="button"
              onClick={handleBulkAddToCollection}
              disabled={bulkSaving || !bulkCollectionChoice}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              추가
            </button>
          </div>
          {bulkCollectionChoice === NEW_COLLECTION_VALUE && (
            <input
              type="text"
              placeholder="새 컬렉션 이름"
              value={newBulkCollectionName}
              onChange={(e) => setNewBulkCollectionName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          )}
          {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
        </div>
      )}
    </div>
  );
}
