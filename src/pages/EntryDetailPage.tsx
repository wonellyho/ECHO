import { useEffect, useState, type ReactElement } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { postJson } from '../lib/apiClient';
import { ALL_TAGS } from '../lib/tagColors';
import { ROUTES } from '../lib/routes';
import { CosmicPage } from '../components/cosmic/CosmicPage';
import { GlassCard } from '../components/ui/GlassCard';
import { BackButton, GradientButton, OutlineButton } from '../components/ui/CosmicButton';
import { CosmicTextarea } from '../components/ui/CosmicInput';
import { TagChip } from '../components/ui/TagChip';
import {
  AlertIcon,
  BulbIcon,
  ChartIcon,
  DocumentIcon,
  EditIcon,
  GearIcon,
  HeartIcon,
  QuestionIcon,
  UserIcon,
} from '../components/icons';
import type { EntryStructured, ExperienceTag, StarWlConversion } from '../types';

// 항목마다 왼쪽에 도는 원형 아이콘 오브를 둔다 (레퍼런스 05). 미니멀 라인 아이콘만 쓴다.
const STRUCTURED_FIELDS: {
  key: keyof EntryStructured;
  label: string;
  Icon: (props: { className?: string }) => ReactElement;
}[] = [
  { key: 'situation', label: '상황', Icon: DocumentIcon },
  { key: 'role', label: '내 역할', Icon: UserIcon },
  { key: 'conflict', label: '문제·갈등', Icon: AlertIcon },
  { key: 'action', label: '행동', Icon: GearIcon },
  { key: 'result', label: '결과', Icon: ChartIcon },
  { key: 'emotion', label: '감정', Icon: HeartIcon },
  { key: 'emotion_reason', label: '감정의 이유', Icon: QuestionIcon },
  { key: 'realization', label: '깨달음', Icon: BulbIcon },
];

// STARWL 카드는 형태가 모두 같고 accent만 다르다 (레퍼런스 06). 오른쪽의 작은 궤도 표식은
// 순수 장식이라 텍스트보다 눈에 띄면 안 된다 — 그래서 불투명도를 낮게 유지한다.
const STARWL_FIELDS: { key: keyof StarWlConversion; label: string; accent: string }[] = [
  { key: 'situation', label: 'Situation', accent: '104, 167, 255' },
  { key: 'task', label: 'Task', accent: '255, 160, 90' },
  { key: 'action', label: 'Action', accent: '167, 110, 255' },
  { key: 'result', label: 'Result', accent: '79, 214, 231' },
  { key: 'why', label: 'Why', accent: '255, 122, 140' },
  { key: 'learning', label: 'Learning', accent: '186, 130, 255' },
];

const TABS = [
  { key: 'structure', label: '구조화' },
  { key: 'starwl', label: 'STARWL' },
  { key: 'pattern', label: '패턴' },
] as const;

interface RelatedInsight {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rawText, setRawText] = useState('');
  const [structured, setStructured] = useState<EntryStructured | null>(null);
  const [draft, setDraft] = useState<Partial<EntryStructured>>({});
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [tags, setTags] = useState<ExperienceTag[]>([]);
  const [tagSaving, setTagSaving] = useState<ExperienceTag | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [starwl, setStarwl] = useState<StarWlConversion | null>(null);
  const [starwlLoading, setStarwlLoading] = useState(false);
  const [starwlProgress, setStarwlProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'structure' | 'starwl' | 'pattern'>('structure');
  const [relatedInsights, setRelatedInsights] = useState<RelatedInsight[]>([]);
  const [patternLoaded, setPatternLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: entry }, { data: struct }, { data: tagRows }, { data: starwlRows }] = await Promise.all([
        supabase.from('entries').select('raw_text').eq('id', id).single(),
        supabase.from('entries_structured').select('*').eq('entry_id', id).maybeSingle(),
        supabase.from('entry_tags').select('tag').eq('entry_id', id),
        supabase
          .from('starwl_conversions')
          .select('*')
          .eq('entry_id', id)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      if (entry) setRawText(entry.raw_text);
      if (struct) setStructured(struct as EntryStructured);
      if (tagRows) setTags(tagRows.map((r) => r.tag as ExperienceTag));
      if (starwlRows && starwlRows.length > 0) setStarwl(starwlRows[0] as StarWlConversion);
    })();
  }, [id]);

  useEffect(() => {
    if (!id || tab !== 'pattern' || patternLoaded) return;
    (async () => {
      const { data } = await supabase
        .from('insights')
        .select('id, type, summary, evidence_entry_ids')
        .contains('evidence_entry_ids', [id]);
      setRelatedInsights((data ?? []) as RelatedInsight[]);
      setPatternLoaded(true);
    })();
  }, [id, tab, patternLoaded]);

  // AI가 자동 생성한 태그 외에 사람이 직접 추가/제거할 수 있게 한다. 클릭 즉시 저장(낙관적 업데이트),
  // 실패하면 되돌리고 에러를 보여준다.
  async function toggleTag(tag: ExperienceTag) {
    if (!id || tagSaving) return;
    const hasTag = tags.includes(tag);
    setTagError(null);
    setTagSaving(tag);
    setTags((prev) => (hasTag ? prev.filter((t) => t !== tag) : [...prev, tag]));
    try {
      if (hasTag) {
        const { error: deleteError } = await supabase
          .from('entry_tags')
          .delete()
          .eq('entry_id', id)
          .eq('tag', tag);
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase.from('entry_tags').insert({ entry_id: id, tag });
        if (insertError) throw insertError;
      }
    } catch (err) {
      setTags((prev) => (hasTag ? [...prev, tag] : prev.filter((t) => t !== tag)));
      setTagError(err instanceof Error ? err.message : '태그를 변경하지 못했습니다.');
    } finally {
      setTagSaving(null);
    }
  }

  function startEdit() {
    if (!structured) return;
    setDraft(structured);
    setEditing(true);
  }

  async function saveEdit() {
    if (!id) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updates = Object.fromEntries(STRUCTURED_FIELDS.map(({ key }) => [key, draft[key] ?? null]));
      const { data, error: updateError } = await supabase
        .from('entries_structured')
        .update(updates)
        .eq('entry_id', id)
        .select()
        .single();
      if (updateError) throw updateError;
      setStructured(data as EntryStructured);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 저장에 실패했습니다.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleStarwlConvert() {
    if (!structured || !id) return;
    setStarwlLoading(true);
    setStarwlProgress(8);
    setError(null);
    // 실제 진행률을 알 수 없는 단일 요청이라, 완료 전까지 서서히 채워지는 척 하다가
    // 응답이 오면 100%로 마무리한다 ("게이지바가 나오면서 추출완료까지 동작" 요청).
    const progressTimer = window.setInterval(() => {
      setStarwlProgress((prev) => (prev < 90 ? prev + (90 - prev) * 0.15 : prev));
    }, 220);
    try {
      // postJson이 로그인 토큰을 실어 보낸다 (src/lib/apiClient.ts 참고).
      const result = await postJson<Record<string, unknown>>('/api/starwl', structured);

      const { data, error: insertError } = await supabase
        .from('starwl_conversions')
        .insert({ entry_id: id, ...result })
        .select()
        .single();
      if (insertError) throw insertError;
      window.clearInterval(progressTimer);
      setStarwl(data as StarWlConversion);
      setStarwlProgress(100);
      // 완료 표시를 잠깐 보여준 뒤 STARWL 탭으로 자동 이동한다 (요청사항).
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      setTab('starwl');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STARWL 변환에 실패했습니다.');
    } finally {
      window.clearInterval(progressTimer);
      setStarwlLoading(false);
      setStarwlProgress(0);
    }
  }

  return (
    // STARWL 탭은 구조화 탭보다 조금 더 대기감 있는 하늘을 쓴다 (레퍼런스 05 vs 06).
    // fullHeight로 바꿔 머리말(뒤로가기·제목·원문·탭)은 화면에 고정하고, 아래 탭 내용만
    // 그 안에서 스크롤한다 — 예전에는 페이지 전체가 늘어나 뒤로가기 버튼을 보려고
    // 위로 다시 스크롤해야 했다(요청사항).
    <CosmicPage variant={tab === 'starwl' ? 'detail-starwl' : 'detail'} width="wide" fullHeight>
      <div className="shrink-0">
        <BackButton onClick={() => navigate(-1)} />

        <h1 className="mt-5 text-[27px] font-bold tracking-tight text-ink">기록 상세</h1>

        {/* 원문 + 태그 — 이 화면에서 관측 대상이 되는 "하나의 별" */}
        <GlassCard tone="strong" accent="167, 110, 255" active className="mt-5 p-4">
          <p className="text-xs text-ink-muted">기록 원문</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{rawText}</p>
          <p className="mt-4 text-xs text-ink-muted">
            태그 <span className="text-ink-muted">(AI가 자동으로 붙이지만 직접 고를 수도 있어요)</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_TAGS.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                active={tags.includes(tag)}
                onClick={() => toggleTag(tag)}
                disabled={tagSaving === tag}
              />
            ))}
          </div>
          {tagError && <p className="mt-2 text-xs text-echo-coral">{tagError}</p>}
        </GlassCard>

        {/* 탭 — 활성 탭 아래에만 얇은 그라디언트 밑줄 */}
        <div className="mt-7 flex gap-1 border-b border-hairline">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={active ? 'true' : undefined}
                className={`relative px-4 py-3 text-[15px] font-semibold transition-colors ${
                  active ? 'text-ink' : 'text-ink-muted hover:text-ink-dim'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                    style={{ background: 'var(--echo-gradient)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 탭 내용 — 남은 높이 안에서만 스크롤한다. 위 머리말(뒤로가기 포함)은 항상 고정. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--bottom-nav-total) + 1.5rem)' }}
      >
      {tab === 'structure' && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">구조화 결과</h2>
            {structured &&
              (editing ? (
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="rounded-full border border-hairline-active px-4 py-2 text-xs font-semibold text-ink transition-colors disabled:opacity-50"
                >
                  {savingEdit ? '저장 중...' : '저장'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-xs font-medium text-ink-dim transition-colors hover:border-hairline-active hover:text-ink"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                  수정
                </button>
              ))}
          </div>

          {structured ? (
            <dl className="mt-3 space-y-2.5">
              {STRUCTURED_FIELDS.map(({ key, label, Icon }) => (
                <GlassCard key={key} className="flex items-start gap-3.5 p-3.5">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-cosmic-indigo"
                    style={{ background: 'rgba(90, 110, 190, 0.12)' }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs text-ink-muted">{label}</dt>
                    {editing ? (
                      <CosmicTextarea
                        value={draft[key] ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        rows={2}
                        aria-label={label}
                        className="mt-1.5 !p-3 text-sm"
                      />
                    ) : (
                      <dd className="mt-1 break-words text-[15px] leading-relaxed text-ink">
                        {structured[key] ?? '-'}
                      </dd>
                    )}
                  </div>
                </GlassCard>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-dim">구조화 결과를 불러오는 중입니다...</p>
          )}

          {starwlLoading ? (
            <div className="mt-5">
              <div
                className="h-2.5 w-full overflow-hidden rounded-full border border-hairline"
                style={{ background: 'rgba(10, 20, 40, 0.4)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.min(starwlProgress, 100)}%`, background: 'var(--echo-gradient)' }}
                />
              </div>
              <p className="mt-2 text-center text-xs text-ink-dim">
                {starwlProgress >= 100 ? '추출 완료! STARWL 탭으로 이동합니다...' : 'STARWL로 추출하는 중...'}
              </p>
            </div>
          ) : (
            <GradientButton
              type="button"
              onClick={handleStarwlConvert}
              disabled={!structured}
              className="mt-5"
            >
              {starwl ? 'STARWL로 다시 추출' : 'STARWL로 추출'}
            </GradientButton>
          )}
          {error && <p className="mt-2 text-sm text-echo-coral">{error}</p>}
        </div>
      )}

      {tab === 'starwl' && (
        <div className="mt-5">
          {starwl ? (
            <dl className="space-y-3">
              {STARWL_FIELDS.map(({ key, label, accent }) => (
                // ghost 톤 + blur 없음 — 뒤 배경이 그대로 비치게 하고(요청사항), 오른쪽의
                // 장식용 궤도 표식은 없앴다(요청사항).
                <GlassCard key={key} tone="ghost" blur={false} accent={accent} className="p-4">
                  <dt className="text-[15px] font-semibold" style={{ color: `rgb(${accent})` }}>
                    {label}
                  </dt>
                  <dd className="mt-1.5 break-words text-[14px] leading-relaxed text-ink">
                    {starwl[key] ?? '-'}
                  </dd>
                </GlassCard>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-ink-dim">아직 추출한 STARWL이 없습니다.</p>
          )}
        </div>
      )}

      {tab === 'pattern' && (
        <div className="mt-5">
          {relatedInsights.length === 0 ? (
            <GlassCard className="p-4">
              <p className="text-sm leading-relaxed text-ink-dim">
                이 기록과 관련된 패턴이 아직 없어요.
              </p>
              <Link to={ROUTES.insights}>
                <OutlineButton type="button" className="mt-3">
                  전체 패턴 분석 보러가기
                </OutlineButton>
              </Link>
            </GlassCard>
          ) : (
            <ul className="space-y-2.5">
              {relatedInsights.map((item) => {
                const accent = item.type === 'energizer' ? '255, 178, 90' : '124, 137, 168';
                return (
                  <li key={item.id}>
                    <GlassCard accent={accent} className="p-4">
                      <p className="text-xs font-medium" style={{ color: `rgb(${accent})` }}>
                        {item.type === 'energizer' ? '에너지를 얻는 조건' : '소진되는 조건'}
                      </p>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{item.summary}</p>
                    </GlassCard>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      </div>
    </CosmicPage>
  );
}
