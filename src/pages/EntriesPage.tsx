import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, UNASSIGNED_KEY } from '../lib/entryGrouping';
import { ALL_TAGS, TAG_COLORS, TAG_COLORS_ACTIVE } from '../lib/tagColors';
import { CollectionSwipeView, type CollectionSwipeViewHandle } from '../components/CollectionSwipeView';
import { CheckIcon, ChevronRightIcon, EditIcon, LayersIcon } from '../components/icons';
import { useNickname, withNickname } from '../lib/useNickname';
import type { CardColorKey, ExperienceTag } from '../types';

const NEW_COLLECTION_VALUE = '__new__';

interface EntryRow {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
  card_color: CardColorKey | null;
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCollectionChoice, setBulkCollectionChoice] = useState('');
  const [newBulkCollectionName, setNewBulkCollectionName] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const nickname = useNickname();
  // 일괄 추가 바가 실제로 차지하는 높이. 이만큼 목록 아래 여백을 더 줘야 마지막 카드 줄이
  // 바 뒤에 가리지 않는다 ("새 컬렉션 만들기" 선택 시 입력칸이 늘어 높이가 변한다).
  const [bulkBarHeight, setBulkBarHeight] = useState(0);
  const bulkBarRef = useRef<HTMLDivElement | null>(null);
  // "컬렉션 모음" 시트 — 스와이프로 하나씩 넘기지 않고도 전체 컬렉션 목록을 한눈에 보고
  // 원하는 곳으로 바로 이동하기 위한 것. 스크롤 위치 자체는 CollectionSwipeView가 계속 들고
  // 있고, 여기서는 ref로 "이 컬렉션으로 이동해라" 명령만 보낸다(끌어올리면 스크롤 프레임마다
  // 이 페이지까지 리렌더된다).
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false);
  const swipeViewRef = useRef<CollectionSwipeViewHandle>(null);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          .select('id, raw_text, created_at, project_title, collection_id, card_color')
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
  // "프로젝트별"과 "컬렉션별"을 컬렉션 하나로 통일했다 — 이제 그룹 기준은 컬렉션뿐이다
  // (design.md, entryGrouping.ts 참고). 선택 모드의 그리드와 컬렉션 스와이프 뷰가 이 그룹을
  // 함께 쓴다. 카드 제목을 그룹 라벨로 채우는 폴백은 일부러 안 한다 — 스와이프 뷰 헤더와
  // 선택 모드 그리드 둘 다 그룹 라벨을 바로 옆에 이미 보여주므로, 카드마다 또 같은 이름을
  // 붙이면 카드 제목 줄이 매번 헤더를 그대로 반복할 뿐 아무 정보도 더해주지 않는다(리뷰에서
  // 지적). project_title이 없는 신규 기록은 EntryCardStack 자신의 '제목 없음' 폴백을 그대로
  // 쓴다.
  const collectionGroups = useMemo(
    () => groupEntries(filtered, collections),
    [filtered, collections],
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
        {/* 텍스트 버튼 대신 편집 아이콘 토글 — 선택 모드에서는 체크 아이콘으로 바뀌어
            "누르면 편집을 마친다"는 걸 알려준다(사진 앱 등의 편집/완료 관례). */}
        <button
          type="button"
          onClick={toggleSelectMode}
          aria-pressed={selectMode}
          aria-label={selectMode ? '편집 완료' : '기록 편집'}
          title={selectMode ? '편집 완료' : '기록 편집'}
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            selectMode
              ? 'border-slate-500 bg-slate-700 text-white'
              : 'border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          {selectMode ? <CheckIcon className="h-4 w-4" /> : <EditIcon className="h-4 w-4" />}
        </button>
      </div>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
      />

      {/* 태그 6개가 화면 폭에 따라 줄바꿈되면 두세 줄로 들쭉날쭉해져 지저분했다. 한 줄로
          고정하고 넘치면 가로 스크롤되게 한다 — 스크롤바는 숨기되(다른 가로 스크롤 영역과
          동일한 관례) 태그 자체가 손에 잡히니 스와이프로 넘긴다는 게 자연스럽게 읽힌다. */}
      <div
        role="group"
        aria-label="태그로 필터"
        className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTag === tag ? TAG_COLORS_ACTIVE[tag] : TAG_COLORS[tag]
            }`}
          >
            #{tag}
          </button>
        ))}
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
          // 편집 모드에서는 컬렉션마다 테두리 있는 카드 블록으로 감싸 경계를 분명히 하고,
          // 이름 옆에 개수 배지를 붙인다 — 예전엔 회색 제목 한 줄만 있어 스크롤하다 보면
          // 어디부터 어디까지가 한 컬렉션인지 잘 안 보였다(요청 사항).
          <div className="mt-4 flex flex-col gap-4">
            {collectionGroups.map((group) => (
              <section
                key={group.key}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm font-semibold ${
                      group.key === UNASSIGNED_KEY ? 'text-slate-400' : 'text-slate-100'
                    }`}
                  >
                    {group.label}
                  </h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                    {group.entries.length}개
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.entries.map((entry) => renderCard(entry))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          // 토글 없이 항상 컬렉션 스와이프 뷰 — Figma 메모 원문("내 경험탭에서 좌우로
          // 스와이프하면 컬렉션별로 넘어가게 함")을 기본 동작으로 그대로 따른다.
          <div className="mt-5">
            {/* 하나씩 스와이프하지 않고도 전체 컬렉션이 뭐가 있는지 한눈에 보고 싶다는
                요청으로 추가한 "컬렉션 모음" 진입점. 컬렉션이 하나뿐이면(또는 전부 미분류라
                하나로 뭉쳐 있으면) 굳이 목록을 볼 필요가 없어 숨긴다. */}
            {collectionGroups.length > 1 && (
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCollectionSheetOpen(true)}
                  aria-label={`컬렉션 모음 (${collectionGroups.length}개)`}
                  title="컬렉션 모음"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <LayersIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            <CollectionSwipeView ref={swipeViewRef} groups={collectionGroups} />
          </div>
        ))}

      {collectionSheetOpen && (
        // 화면 크기와 무관하게 항상 가운데 팝업으로 뜨게 한다 (예전엔 모바일 폭에서 바텀시트).
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-6"
          onClick={() => setCollectionSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="컬렉션 모음"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-50">컬렉션 모음</p>
              <button
                type="button"
                onClick={() => setCollectionSheetOpen(false)}
                aria-label="닫기"
                className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
              >
                닫기
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {collectionGroups.map((group) => (
                // group 유틸리티로 화살표를 평소엔 숨겨뒀다가 호버/포커스에서만 슬며시
                // 나타나게 한다 — 배경색만 바뀌는 것보다 "누르면 이동한다"는 게 분명해진다.
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    swipeViewRef.current?.scrollToKey(group.key);
                    setCollectionSheetOpen(false);
                  }}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline-none ${
                    group.key === UNASSIGNED_KEY ? 'text-slate-400' : 'text-slate-100'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                    <span className="truncate">{group.label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{group.entries.length}개</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
