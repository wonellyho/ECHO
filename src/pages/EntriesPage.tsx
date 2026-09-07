import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, UNASSIGNED_KEY } from '../lib/entryGrouping';
import { ALL_TAGS } from '../lib/tagColors';
import { CollectionSwipeView, type CollectionSwipeViewHandle } from '../components/CollectionSwipeView';
import { CheckIcon, EditIcon, LayersIcon, SearchIcon } from '../components/icons';
import { Logo } from '../components/Logo';
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
      return (
        <button key={entry.id} type="button" onClick={() => toggleSelected(entry.id)} className="text-left">
          <GlassCard active={selected} accent="255, 138, 76" className="relative h-44 overflow-hidden">
            <span
              className="absolute right-2.5 top-2.5 h-4 w-4 rounded-full border-2"
              style={{
                borderColor: selected ? 'rgb(255,138,76)' : 'rgba(130,160,220,0.4)',
                background: selected ? 'rgb(255,138,76)' : 'transparent',
              }}
            />
            {cardBody}
          </GlassCard>
        </button>
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
      // 아래 여백은 네비게이션 + (떠 있다면) 일괄 추가 바를 모두 비켜야 한다.
      // 바 높이는 "새 컬렉션 만들기"를 고르면 입력칸이 하나 더 생겨 달라지므로,
      // 고정값 대신 실제 높이를 재서 더한다.
      bottomExtra={bulkBarHeight}
    >
      <div className="flex items-start justify-between gap-3">
        <Logo />
        <p className="hidden shrink-0 pt-1 text-right text-[11px] leading-relaxed text-ink-muted min-[380px]:block">
          <span className="block">모든 경험은</span>
          <span className="block">조금 더 나은 나를 만드는</span>
          <span className="block">별이 됩니다.</span>
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
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
        className="mt-5 flex items-center gap-3 rounded-2xl border border-hairline px-4 backdrop-blur-xl transition-colors focus-within:border-hairline-active"
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
        className="mt-3.5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

      {loading && <p className="mt-5 text-sm text-ink-dim">불러오는 중...</p>}

      {!loading && loadError && (
        <GlassCard tone="strong" className="mt-5 p-4">
          <p className="text-sm text-ink">기록을 불러오지 못했습니다.</p>
          <OutlineButton type="button" onClick={loadEntries} className="mt-3">
            다시 불러오기
          </OutlineButton>
        </GlassCard>
      )}

      {!loading && !loadError && filtered.length === 0 && (
        <p className="mt-5 text-sm text-ink-dim">기록이 없습니다.</p>
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
              <GlassCard key={group.key} className="p-3.5">
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
        ) : (
          // 토글 없이 항상 컬렉션 스와이프 뷰 — Figma 메모 원문("내 경험탭에서 좌우로
          // 스와이프하면 컬렉션별로 넘어가게 함")을 기본 동작으로 그대로 따른다.
          <div className="mt-5">
            {/* 하나씩 스와이프하지 않고도 전체 컬렉션이 뭐가 있는지 한눈에 보고 싶다는
                요청으로 추가한 "컬렉션 모음" 진입점. 컬렉션이 하나뿐이면(또는 전부 미분류라
                하나로 뭉쳐 있으면) 굳이 목록을 볼 필요가 없어 숨긴다. */}
            {collectionGroups.length > 1 && (
              <div className="mb-2 flex justify-end">
                <CosmicIconButton
                  type="button"
                  onClick={() => setCollectionSheetOpen(true)}
                  aria-label={`컬렉션 모음 (${collectionGroups.length}개)`}
                  title="컬렉션 모음"
                >
                  <LayersIcon className="h-4 w-4" />
                </CosmicIconButton>
              </div>
            )}
            <CollectionSwipeView ref={swipeViewRef} groups={collectionGroups} />
          </div>
        ))}

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
            className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-hairline bg-[rgba(8,15,33,0.92)] p-4 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
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
            <div className="mt-3 flex flex-col gap-1">
              {collectionGroups.map((group) => (
                // 화살표 페이드인은 눈에 잘 안 띈다는 피드백으로, 배경 자체가 확실히
                // 밝아지는 효과로 바꿨다 — 팝업 배경(slate-900)과 이전 호버색(slate-800)이
                // 너무 가까운 톤이라 차이가 잘 안 보였던 게 원인. 한 단 더 밝은 slate-700과
                // 왼쪽에서 슬라이드-인하는 강조 바를 더해 "지금 이 항목이 활성화됐다"를
                // 분명하게 한다.
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    swipeViewRef.current?.scrollToKey(group.key);
                    setCollectionSheetOpen(false);
                  }}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(130,160,220,0.14)] focus-visible:bg-[rgba(130,160,220,0.14)] focus-visible:outline-none ${
                    group.key === UNASSIGNED_KEY ? 'text-ink-dim' : 'text-ink'
                  }`}
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
      )}

      {showBulkBar && (
        <div
          ref={bulkBarRef}
          className="fixed inset-x-0 bottom-[var(--bottom-nav-total)] z-30 flex flex-col gap-2 border-t border-hairline bg-[rgba(6,12,28,0.92)] p-3 backdrop-blur-xl"
        >
          <p className="text-xs text-ink-dim">{selectedIds.size}개 선택됨</p>
          <div className="flex gap-2">
            <select
              value={bulkCollectionChoice}
              aria-label="컬렉션 선택"
              onChange={(e) => setBulkCollectionChoice(e.target.value)}
              className="min-h-[2.75rem] flex-1 rounded-xl border border-hairline bg-[rgba(10,20,40,0.4)] px-3 text-sm text-ink focus:border-hairline-active focus:outline-none"
            >
              <option value="">컬렉션 선택</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_COLLECTION_VALUE}>+ 새 컬렉션 만들기</option>
            </select>
            <GradientButton
              type="button"
              onClick={handleBulkAddToCollection}
              disabled={bulkSaving || !bulkCollectionChoice}
              className="min-h-[2.75rem] w-auto shrink-0 px-6"
            >
              추가
            </GradientButton>
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
      )}
    </CosmicPage>
  );
}
