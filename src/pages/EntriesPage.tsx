import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, UNASSIGNED_KEY } from '../lib/entryGrouping';
import { ALL_TAGS } from '../lib/tagColors';
import { CollectionSwipeView, type CollectionSwipeViewHandle } from '../components/CollectionSwipeView';
import {
  CheckIcon,
  ChevronRightIcon,
  EditIcon,
  LayersIcon,
  MoreIcon,
  SearchIcon,
  TrashIcon,
} from '../components/icons';
import { CosmicPage } from '../components/cosmic/CosmicPage';
import { GlassCard } from '../components/ui/GlassCard';
import { CosmicIconButton, GradientButton, OutlineButton } from '../components/ui/CosmicButton';
import { TagChip } from '../components/ui/TagChip';
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
  const navigate = useNavigate();
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
  // 카드마다 있던 수정·삭제 버튼이 너무 다닥다닥 붙어 있어 선택하려다 삭제가 눌리는
  // 문제가 있었다 — 점점점 더보기 메뉴 하나로 숨기고, 열려 있는 카드 id만 기억한다
  // (한 번에 하나만 열린다).
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const cardMenuRef = useRef<HTMLDivElement | null>(null);
  // 일괄 추가 바의 컬렉션 선택 — 네이티브 <select>가 모바일에서 화면 폭을 넘어가던 문제로
  // RecordPage와 같은 방식의 직접 그린 드롭다운을 쓴다.
  const [bulkCollectionDropdownOpen, setBulkCollectionDropdownOpen] = useState(false);
  const bulkCollectionDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!openCardMenuId) return;
    function handlePointerDown(e: PointerEvent) {
      if (!cardMenuRef.current?.contains(e.target as Node)) {
        setOpenCardMenuId(null);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openCardMenuId]);

  useEffect(() => {
    if (!bulkCollectionDropdownOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (!bulkCollectionDropdownRef.current?.contains(e.target as Node)) {
        setBulkCollectionDropdownOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [bulkCollectionDropdownOpen]);

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
    setBulkCollectionDropdownOpen(false);
    setOpenCardMenuId(null);
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

  // "카드를 전체선택해서 일괄삭제" 요청 — 지금 화면에 보이는(필터링된) 기록 전체를 한 번에
  // 선택/해제한다.
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((e) => prev.has(e.id));
      return allSelected ? new Set() : new Set(filtered.map((e) => e.id));
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 기록 ${selectedIds.size}개를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBulkSaving(true);
    setBulkError(null);
    try {
      const { error: deleteError } = await supabase.from('entries').delete().in('id', Array.from(selectedIds));
      if (deleteError) throw deleteError;
      setEntries((prev) => prev.filter((e) => !selectedIds.has(e.id)));
      toggleSelectMode();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : '일괄 삭제하지 못했습니다.');
    } finally {
      setBulkSaving(false);
    }
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

  // 편집 모드에서 컬렉션 이동 말고도 카드 하나를 바로 지울 수 있게 한다(요청사항).
  // 되돌릴 수 없는 동작이라 확인을 한 번 거친다.
  async function handleDeleteEntry(entryId: string) {
    if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
    setBulkError(null);
    try {
      const { error: deleteError } = await supabase.from('entries').delete().eq('id', entryId);
      if (deleteError) throw deleteError;
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : '기록을 삭제하지 못했습니다.');
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
    const cardBody = (
      <div className="flex h-full flex-col justify-between gap-2 p-3.5 text-left">
        <p className="truncate text-sm font-semibold text-ink">{entry.project_title || '제목 없음'}</p>
        <p className="line-clamp-3 flex-1 text-[11px] leading-relaxed text-ink-dim">
          {entry.situation ?? entry.raw_text}
        </p>
        <p className="text-right text-[10px] text-ink-muted">
          {new Date(entry.created_at).toLocaleDateString('ko-KR')}
        </p>
      </div>
    );

    if (selectMode) {
      const selected = selectedIds.has(entry.id);
      const menuOpen = openCardMenuId === entry.id;
      return (
        // 컬렉션 이동을 위한 선택 토글은 그대로 두되, 더보기 메뉴도 함께 둬야 해서
        // <button> 안에 <button>을 넣을 수 없다 — div+role="button"으로 바꿨다.
        // 카드 바깥(relative)에 더보기 메뉴를 둬서 GlassCard의 overflow-hidden에 잘리지
        // 않게 한다.
        <div key={entry.id} className="relative">
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleSelected(entry.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSelected(entry.id);
              }
            }}
            className="text-left"
          >
            <GlassCard active={selected} accent="255, 138, 76" blur={false} className="h-44 overflow-hidden">
              {cardBody}
            </GlassCard>
          </div>

          {/* 수정·삭제를 각각 따로 둔 버튼이 너무 다닥다닥 붙어 있어 선택하려다 삭제가
              눌리는 문제가 있었다 — 점점점 더보기 하나로 숨겼다("점점점 더보기로 숨겨줘"
              요청). 열려 있을 때만 이 wrapper 전체를 outside-click 판정 기준으로 쓴다. */}
          <div
            className="absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5"
            ref={menuOpen ? cardMenuRef : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenCardMenuId((prev) => (prev === entry.id ? null : entry.id));
              }}
              aria-label="더보기"
              aria-expanded={menuOpen}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-hairline text-ink-dim backdrop-blur-sm transition-colors hover:border-hairline-active hover:text-ink"
              style={{ background: 'rgba(10, 20, 40, 0.55)' }}
            >
              <MoreIcon className="h-3.5 w-3.5 rotate-90" />
            </button>
            <span
              className="h-4 w-4 shrink-0 rounded-full border-2"
              style={{
                borderColor: selected ? 'rgb(255,138,76)' : 'rgba(130,160,220,0.4)',
                background: selected ? 'rgb(255,138,76)' : 'transparent',
              }}
            />

            {menuOpen && (
              <div className="absolute right-0 top-8 flex w-24 flex-col overflow-hidden rounded-xl border border-hairline bg-[rgba(8,15,33,0.94)] p-1 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenCardMenuId(null);
                    navigate(`/entries/${entry.id}`);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-ink-dim transition-colors hover:bg-[rgba(130,160,220,0.14)] hover:text-ink"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                  수정
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenCardMenuId(null);
                    handleDeleteEntry(entry.id);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-echo-coral transition-colors hover:bg-[rgba(255,90,90,0.14)]"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <Link key={entry.id} to={`/entries/${entry.id}`}>
        <GlassCard className="h-44 overflow-hidden">{cardBody}</GlassCard>
      </Link>
    );
  }

  return (
    <CosmicPage
      variant="archive"
      width="wide"
      // 화면 높이에 딱 맞추고 페이지 자체는 스크롤하지 않는다 — 스와이프 뷰를 보려고 화면을
      // 내려야 했던 문제(요청사항)의 핵심 원인은 이 페이지가 fullHeight가 아니라 내용만큼
      // 늘어나는 페이지였다는 것. 이제 아래 본문 영역(body)만 남은 높이를 나눠 갖고, 편집
      // 모드일 때만 그 안에서(내비게이션 위로는 넘지 않는 선에서) 스크롤한다.
      fullHeight
    >
      {/* 로고/태그라인 머리말 없이 제목을 바로 맨 위에 둔다. */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h1
          className="min-w-0 truncate bg-clip-text text-[27px] font-bold tracking-tight text-transparent"
          style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
        >
          {withNickname(nickname, (n) => `${n}의 경험 기록`, '내 경험 기록')}
        </h1>
        {/* 텍스트 버튼 대신 편집 아이콘 토글 — 선택 모드에서는 체크 아이콘으로 바뀌어
            "누르면 편집을 마친다"는 걸 알려준다(사진 앱 등의 편집/완료 관례). */}
        <CosmicIconButton
          type="button"
          onClick={toggleSelectMode}
          aria-pressed={selectMode}
          aria-label={selectMode ? '편집 완료' : '기록 편집'}
          title={selectMode ? '편집 완료' : '기록 편집'}
          className={selectMode ? 'border-hairline-active text-ink' : ''}
        >
          {selectMode ? <CheckIcon className="h-4 w-4" /> : <EditIcon className="h-4 w-4" />}
        </CosmicIconButton>
      </div>

      <div
        className="mt-4 flex shrink-0 items-center gap-3 rounded-2xl border border-hairline px-4 backdrop-blur-xl transition-colors focus-within:border-hairline-active"
        style={{ background: 'rgba(10, 20, 40, 0.38)' }}
      >
        <SearchIcon className="h-5 w-5 shrink-0 text-ink-muted" />
        <input
          type="text"
          aria-label="키워드로 검색"
          placeholder="키워드로 검색 (예: 갈등)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-[3rem] flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none"
        />
      </div>

      {/* 태그 6개가 화면 폭에 따라 줄바꿈되면 두세 줄로 들쭉날쭉해져 지저분했다. 한 줄로
          고정하고 넘치면 가로 스크롤되게 한다 — 스크롤바는 숨기되(다른 가로 스크롤 영역과
          동일한 관례) 태그 자체가 손에 잡히니 스와이프로 넘긴다는 게 자연스럽게 읽힌다. */}
      <div
        role="group"
        aria-label="태그로 필터"
        className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ALL_TAGS.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            active={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
          />
        ))}
      </div>

      {/* 본문 — 남은 높이를 전부 차지한다(min-h-0가 있어야 flex 자식이 내용만큼 커지지 않고
          실제로 줄어들 수 있다). 편집 모드에서만 이 영역 안에서 스크롤하고, 기본(스와이프)
          모드는 절대 스크롤하지 않는다 — 화면 안에 다 들어오도록 CollectionSwipeView 쪽에서
          카드 개수를 줄였다(CardStackCarousel의 DEFAULT_MAX_VISIBLE 참고). */}
      <div className="mt-4 min-h-0 flex-1">
        {loading && <p className="text-sm text-ink-dim">불러오는 중...</p>}

        {!loading && loadError && (
          <GlassCard tone="strong" className="p-4">
            <p className="text-sm text-ink">기록을 불러오지 못했습니다.</p>
            <OutlineButton type="button" onClick={loadEntries} className="mt-3">
              다시 불러오기
            </OutlineButton>
          </GlassCard>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <p className="text-sm text-ink-dim">기록이 없습니다.</p>
        )}

        {!loading &&
          !loadError &&
          filtered.length > 0 &&
          (selectMode ? (
            // 편집 모드는 기록이 아무리 많아져도 다 보여줘야 하는 목적이 다른 화면이라
            // 여기서만 예외적으로 스크롤한다 — 네비게이션 위, 이 영역 안에서만 스크롤되므로
            // "화면 자체가 아래로 스크롤된다"는 문제와는 다르다. 일괄 추가 바가 떠 있으면
            // 그 높이만큼 아래 여백을 더 줘서 마지막 카드 줄이 가리지 않게 한다.
            <div
              className="h-full overflow-y-auto"
              style={{ paddingBottom: `calc(1.5rem + ${bulkBarHeight}px)` }}
            >
              {/* "카드를 전체선택해서 일괄삭제" 요청 — 지금 보이는 기록 전체를 한 번에
                  선택/해제한다. */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-medium text-ink-dim transition-colors hover:text-ink"
                >
                  {filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id)) ? '전체 해제' : '전체 선택'}
                </button>
                {selectedIds.size > 0 && (
                  <p className="text-xs text-ink-muted">{selectedIds.size}개 선택됨</p>
                )}
              </div>

              {/* 컬렉션마다 테두리 있는 카드 블록으로 감싸 경계를 분명히 하고, 이름 옆에
                  개수 배지를 붙인다 — 예전엔 회색 제목 한 줄만 있어 스크롤하다 보면 어디부터
                  어디까지가 한 컬렉션인지 잘 안 보였다(요청 사항). */}
              <div className="flex flex-col gap-4">
                {collectionGroups.map((group) => (
                  <GlassCard key={group.key} blur={false} className="p-3.5">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          group.key === UNASSIGNED_KEY ? 'text-ink-dim' : 'text-ink'
                        }`}
                      >
                        {group.label}
                      </h3>
                      <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                        {group.entries.length}개
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {group.entries.map((entry) => renderCard(entry))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          ) : (
            // 토글 없이 항상 컬렉션 스와이프 뷰 — Figma 메모 원문("내 경험탭에서 좌우로
            // 스와이프하면 컬렉션별로 넘어가게 함")을 기본 동작으로 그대로 따른다.
            // justify-center로 남은 높이 안에서 세로 가운데 정렬하고, overflow-hidden으로
            // 혹시 남은 공간보다 카드 뭉치가 커도 페이지 스크롤이 생기는 대신 안에서 잘리게
            // 막는다(스크롤이 생기면 안 된다는 요청의 마지막 안전장치).
            <div className="flex h-full flex-col justify-center overflow-hidden">
              {/* 하나씩 스와이프하지 않고도 전체 컬렉션이 뭐가 있는지 한눈에 보고 싶다는
                  요청으로 추가한 "컬렉션 모음" 진입점. 컬렉션이 하나뿐이면(또는 전부 미분류라
                  하나로 뭉쳐 있으면) 굳이 목록을 볼 필요가 없어 숨긴다. 따로 줄을 차지하던
                  버튼을 제목과 같은 줄(headerAction)로 옮겨 세로 공간을 아꼈다. */}
              <CollectionSwipeView
                ref={swipeViewRef}
                groups={collectionGroups}
                headerAction={
                  collectionGroups.length > 1 ? (
                    <CosmicIconButton
                      type="button"
                      onClick={() => setCollectionSheetOpen(true)}
                      aria-label={`컬렉션 모음 (${collectionGroups.length}개)`}
                      title="컬렉션 모음"
                    >
                      <LayersIcon className="h-4 w-4" />
                    </CosmicIconButton>
                  ) : undefined
                }
              />
            </div>
          ))}
      </div>

      {collectionSheetOpen && (
        // 화면 크기와 무관하게 항상 가운데 팝업으로 뜨게 한다 (예전엔 모바일 폭에서 바텀시트).
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(2,4,13,0.78)] p-6 backdrop-blur-sm"
          onClick={() => setCollectionSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="컬렉션 모음"
            onClick={(e) => e.stopPropagation()}
            // 컬렉션이 적을 때 텅 빈 여백만 남던 걸 없앴다 — 고정 높이(h-[70vh]) 대신
            // 상한(max-h-[70vh])만 두어 내용만큼만 커지고, 그 상한을 넘을 때만 아래 목록이
            // 스크롤된다("쓸데없는 여백 두지 말고, 일정 길이 이상이면 스크롤" 요청).
            className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-hairline bg-[rgba(8,15,33,0.92)] p-4 backdrop-blur-xl"
          >
            <div className="flex shrink-0 items-center justify-between">
              <p className="text-sm font-semibold text-ink">컬렉션 모음</p>
              <button
                type="button"
                onClick={() => setCollectionSheetOpen(false)}
                aria-label="닫기"
                className="rounded-full px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
              >
                닫기
              </button>
            </div>
            <div className="mt-3 min-h-0 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                {collectionGroups.map((group) => (
                // 항목마다 옅은 테두리+배경을 얹어 가만히 있을 때도(호버 전에도) 항목 사이
                // 경계가 뚜렷하게 보이게 했다("리스트들이 구분되게 잘 보이게" 요청) — 예전엔
                // 호버해야만 배경이 생겨서 평소엔 텍스트만 죽 이어진 것처럼 보였다.
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    swipeViewRef.current?.scrollToKey(group.key);
                    setCollectionSheetOpen(false);
                  }}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-xl border border-hairline px-3 py-2.5 text-left text-sm transition-colors hover:border-hairline-active hover:bg-[rgba(130,160,220,0.14)] focus-visible:bg-[rgba(130,160,220,0.14)] focus-visible:outline-none ${
                    group.key === UNASSIGNED_KEY ? 'text-ink-dim' : 'text-ink'
                  }`}
                  style={{ background: 'rgba(130, 160, 220, 0.06)' }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 left-0 w-1 origin-left scale-x-0 rounded-full bg-cosmic-violet transition-transform group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  />
                  <span className="flex min-w-0 items-center pl-2">
                    <span className="truncate">{group.label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">{group.entries.length}개</span>
                </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkBar && (
        // 바텀시트(echo-sheet-up)와 같은 방식으로 아래에서 부드럽게 올라오게 한다 — 예전엔
        // 조건부 렌더만 하고 애니메이션이 없어 뚝 튀어나오듯 나타났다("못생겼다" 피드백).
        // 페이지 콘텐츠와 같은 폭(mx-auto max-w-2xl)으로 맞춰서 화면 전체 폭으로 뚱뚱하게
        // 늘어나 보이지 않게 한다.
        <div
          className="fixed inset-x-0 bottom-[var(--bottom-nav-total)] z-30 border-t border-hairline bg-[rgba(6,12,28,0.92)] backdrop-blur-xl"
          style={{
            borderTopLeftRadius: '1.25rem',
            borderTopRightRadius: '1.25rem',
            animation: 'echo-sheet-up 280ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        >
          <div ref={bulkBarRef} className="mx-auto flex w-full max-w-2xl flex-col gap-2 p-3.5">
            <p className="text-xs text-ink-dim">{selectedIds.size}개 선택됨</p>
            <div className="flex gap-2">
              {/* 네이티브 <select>가 모바일에서 화면 폭을 넘어가던 문제로, 직접 그린
                  드롭다운으로 바꿨다(RecordPage와 같은 패턴). 바 자체가 화면 맨 아래라
                  아래로 펼치면 화면 밖으로 나가므로 위로 펼친다. */}
              <div ref={bulkCollectionDropdownRef} className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setBulkCollectionDropdownOpen((prev) => !prev)}
                  aria-expanded={bulkCollectionDropdownOpen}
                  className="flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-[rgba(10,20,40,0.4)] px-3 text-sm text-ink transition-colors focus:border-hairline-active focus:outline-none"
                >
                  <span className={`truncate ${bulkCollectionChoice ? 'text-ink' : 'text-ink-muted'}`}>
                    {bulkCollectionChoice === NEW_COLLECTION_VALUE
                      ? '+ 새 컬렉션 만들기'
                      : (collections.find((c) => c.id === bulkCollectionChoice)?.name ?? '컬렉션 선택')}
                  </span>
                  <ChevronRightIcon
                    className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 ${
                      bulkCollectionDropdownOpen ? 'rotate-90' : '-rotate-90'
                    }`}
                  />
                </button>

                {/* 아래가 아니라 위로 부드럽게 펼쳐진다 — grid-template-rows를 0fr↔1fr로
                    트랜지션해 높이를 몰라도 자연스럽게 열고 닫는다("토글 하위항목 나올 때
                    부드럽게" 요청). */}
                <div
                  className={`absolute inset-x-0 bottom-full grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
                    bulkCollectionDropdownOpen ? 'mb-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="min-h-0 overflow-hidden rounded-2xl border border-hairline bg-[rgba(8,15,33,0.94)] backdrop-blur-sm">
                    <div className="max-h-40 overflow-y-auto p-1.5">
                      {collections.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setBulkCollectionChoice(c.id);
                            setBulkCollectionDropdownOpen(false);
                          }}
                          className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(130,160,220,0.14)] ${
                            bulkCollectionChoice === c.id ? 'text-ink' : 'text-ink-dim'
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setBulkCollectionChoice(NEW_COLLECTION_VALUE);
                          setBulkCollectionDropdownOpen(false);
                        }}
                        className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(130,160,220,0.14)] ${
                          bulkCollectionChoice === NEW_COLLECTION_VALUE ? 'text-ink' : 'text-ink-dim'
                        }`}
                      >
                        + 새 컬렉션 만들기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* GradientButton 기본 클래스에 w-full이 있는데, 컴파일된 CSS에서 w-full이
                  w-auto보다 뒤에 와 있어 그냥 className="w-auto"로는 덮어써지지 않는다
                  (실제로 버튼이 셀렉트를 밀어내며 폭 100%로 늘어나 화면 밖으로 밀려났다 —
                  "추가 버튼이 잘려있다"는 버그의 정체). !w-auto로 강제로 이긴다. */}
              <GradientButton
                type="button"
                onClick={handleBulkAddToCollection}
                disabled={bulkSaving || !bulkCollectionChoice}
                className="min-h-[2.75rem] !w-auto shrink-0 px-6"
              >
                추가
              </GradientButton>
              {/* "전체선택해서 일괄삭제" 요청 — 컬렉션 추가와 나란히, 눈에 띄는 코럴 톤으로. */}
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkSaving}
                aria-label="선택한 기록 일괄 삭제"
                title="선택한 기록 삭제"
                className="flex min-h-[2.75rem] w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,120,140,0.35)] text-echo-coral transition-colors hover:bg-[rgba(255,90,90,0.14)] disabled:opacity-45"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            {bulkCollectionChoice === NEW_COLLECTION_VALUE && (
              <input
                type="text"
                placeholder="새 컬렉션 이름"
                value={newBulkCollectionName}
                onChange={(e) => setNewBulkCollectionName(e.target.value)}
                className="min-h-[2.75rem] w-full rounded-xl border border-hairline bg-[rgba(10,20,40,0.4)] px-3 text-sm text-ink placeholder:text-ink-muted focus:border-hairline-active focus:outline-none"
              />
            )}
            {bulkError && <p className="text-xs text-echo-coral">{bulkError}</p>}
          </div>
        </div>
      )}
    </CosmicPage>
  );
}
