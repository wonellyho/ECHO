import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, type GroupBy } from '../lib/entryGrouping';
import { ALL_TAGS, TAG_COLORS, TAG_COLORS_ACTIVE } from '../lib/tagColors';
import { EntryCardStack } from '../components/EntryCardStack';
import { useNickname, withNickname } from '../lib/useNickname';
import type { ExperienceTag } from '../types';

type SortMode = GroupBy | 'latest';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'latest', label: '최신순' },
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
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCollectionChoice, setBulkCollectionChoice] = useState('');
  const [newBulkCollectionName, setNewBulkCollectionName] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const nickname = useNickname();
  // 일괄 추가 바가 실제로 차지하는 높이. 이만큼 목록 아래 여백을 더 줘야 마지막 카드 줄이
  // 바 뒤에 가리지 않는다 ("새 컬렉션 만들기" 선택 시 입력칸이 늘어 높이가 변한다).
  const [bulkBarHeight, setBulkBarHeight] = useState(0);
  const bulkBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 정렬 드롭다운 바깥을 클릭하면 닫는다.
  useEffect(() => {
    if (!sortOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sortOpen]);

  // 바가 나타나거나 내용이 바뀌어 높이가 변하면 목록 아래 여백도 따라 바뀌어야 한다.
  const showBulkBar = selectMode && selectedIds.size > 0;
  useEffect(() => {
    const el = bulkBarRef.current;
    if (!el) {
      setBulkBarHeight(0);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setBulkBarHeight(entry.contentRect.height);
    });
    observer.observe(el);
    setBulkBarHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [showBulkBar, bulkCollectionChoice]);

  async function loadEntries() {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        { data: entryRows, error: entryError },
        { data: tagRows, error: tagError },
        { data: structuredRows, error: structuredError },
        { data: collectionRows, error: collectionError },
      ] = await Promise.all([
        supabase
          .from('entries')
          .select('id, raw_text, created_at, project_title, collection_id')
          .order('created_at', { ascending: false }),
        supabase.from('entry_tags').select('entry_id, tag'),
        supabase.from('entries_structured').select('entry_id, situation'),
        supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
      ]);
      if (entryError) throw entryError;
      if (tagError) throw tagError;
      if (structuredError) throw structuredError;
      if (collectionError) throw collectionError;

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
    } catch (err) {
      setEntries([]);
      setLoadError(err instanceof Error ? err.message : '기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
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
  // useMemo로 배열 정체성을 안정화한다 — 카드 스택이 스크롤 중 매 프레임 리렌더되는데,
  // 매번 새 배열이 내려가면 스택 쪽의 메모이제이션이 전부 무효가 된다.
  const filtered = useMemo(
    () => filterEntries(entries, activeTag, query),
    [entries, activeTag, query],
  );
  const groups = useMemo(
    () => (sortMode === 'latest' ? null : groupEntries(filtered, sortMode, collections)),
    [filtered, sortMode, collections],
  );
  // 카드 스택은 그룹 헤더 없이 하나의 스택으로 보여준다 — groups가 있으면 그 순서를 그대로 이어붙인다.
  const stackEntries = useMemo(
    () => (groups === null ? filtered : groups.flatMap((group) => group.entries)),
    [groups, filtered],
  );

  function renderCard(entry: EntryRow) {
    const dividerClass = selectMode && selectedIds.has(entry.id) ? 'border-white/20' : 'border-slate-800';
    const cardBody = (
      <>
        <div className={`border-b px-3 py-2 ${dividerClass}`}>
          <p className="truncate text-base font-semibold">{entry.project_title || '제목 없음'}</p>
        </div>
        <div className={`flex-1 overflow-hidden border-b px-3 py-2 ${dividerClass}`}>
          <p className="line-clamp-3 text-xs opacity-80">{entry.situation ?? entry.raw_text}</p>
        </div>
        <div className="px-3 py-1.5 text-right">
          <p className="text-xs opacity-60">{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
        </div>
      </>
    );

    if (selectMode) {
      const selected = selectedIds.has(entry.id);
      return (
        <button
          key={entry.id}
          type="button"
          onClick={() => toggleSelected(entry.id)}
          className={`relative flex h-44 flex-col overflow-hidden rounded-lg text-left transition-colors ${
            selected
              ? 'bg-gradient-to-br from-orange-500 to-pink-600 text-white'
              : 'border border-slate-800 bg-slate-900 text-slate-100 hover:bg-slate-800'
          }`}
        >
          <span
            className={`absolute right-2 top-2 h-4 w-4 rounded-full border-2 ${
              selected ? 'border-white bg-white' : 'border-slate-600'
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
        className="flex h-44 flex-col overflow-hidden rounded-lg bg-slate-900 text-slate-100 transition-shadow hover:shadow-md"
      >
        {cardBody}
      </Link>
    );
  }

  return (
    <div
      className="mx-auto max-w-2xl px-4 py-6"
      // 아래 여백은 네비게이션 + (떠 있다면) 일괄 추가 바를 모두 비켜야 한다.
      // 바 높이는 "새 컬렉션 만들기"를 고르면 입력칸이 하나 더 생겨 달라지므로,
      // 고정값 대신 실제 높이를 재서 더한다.
      style={{
        paddingBottom: `calc(var(--bottom-nav-total) + 1.5rem + ${bulkBarHeight}px)`,
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-50">
          {withNickname(nickname, (n) => `${n}의 경험 기록`, '내 경험 기록')}
        </h2>
        <button
          type="button"
          onClick={toggleSelectMode}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          {selectMode ? '선택 취소' : '선택'}
        </button>
      </div>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
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

      <div className="relative mt-3" ref={sortRef}>
        <button
          type="button"
          onClick={() => setSortOpen((prev) => !prev)}
          aria-expanded={sortOpen}
          className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          {SORT_OPTIONS.find((opt) => opt.value === sortMode)?.label ?? '정렬 방식'} {sortOpen ? '▲' : '▼'}
        </button>
        {sortOpen && (
          // z-30: 카드 스택 위, 하단 네비게이션(z-40) 아래.
          <div className="absolute left-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 py-1 shadow-lg">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={sortMode === opt.value}
                onClick={() => {
                  setSortMode(opt.value);
                  setSortOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                  sortMode === opt.value
                    ? 'bg-slate-700 font-medium text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-400">불러오는 중...</p>}

      {!loading && loadError && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
          <p className="text-slate-200">기록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={loadEntries}
            className="mt-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            다시 불러오기
          </button>
        </div>
      )}

      {!loading && !loadError && filtered.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">기록이 없습니다.</p>
      )}

      {!loading &&
        !loadError &&
        filtered.length > 0 &&
        (selectMode ? (
          groups === null ? (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((entry) => renderCard(entry))}
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key} className="mt-5">
                <h3 className="text-sm font-semibold text-slate-300">{group.label}</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.entries.map((entry) => renderCard(entry))}
                </div>
              </section>
            ))
          )
        ) : (
          <div className="mt-5">
            <EntryCardStack entries={stackEntries} />
          </div>
        ))}

      {showBulkBar && (
        <div
          ref={bulkBarRef}
          className="fixed inset-x-0 bottom-[var(--bottom-nav-total)] z-30 flex flex-col gap-2 border-t border-slate-800 bg-slate-900 p-3"
        >
          <p className="text-xs text-slate-400">{selectedIds.size}개 선택됨</p>
          <div className="flex gap-2">
            <select
              value={bulkCollectionChoice}
              onChange={(e) => setBulkCollectionChoice(e.target.value)}
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-50"
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
              className="rounded-md bg-gradient-to-r from-orange-400 to-pink-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
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
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-50"
            />
          )}
          {bulkError && <p className="text-xs text-red-400">{bulkError}</p>}
        </div>
      )}
    </div>
  );
}
