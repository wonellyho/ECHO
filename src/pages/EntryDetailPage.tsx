import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { TAG_COLORS } from '../lib/tagColors';
import type { EntryStructured, ExperienceTag, StarConversion } from '../types';

const STRUCTURED_FIELDS: { key: keyof EntryStructured; label: string }[] = [
  { key: 'situation', label: '상황' },
  { key: 'role', label: '내 역할' },
  { key: 'conflict', label: '문제·갈등' },
  { key: 'action', label: '행동' },
  { key: 'result', label: '결과' },
  { key: 'emotion', label: '감정' },
  { key: 'emotion_reason', label: '감정의 이유' },
  { key: 'realization', label: '깨달음' },
];

interface RelatedInsight {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rawText, setRawText] = useState('');
  const [structured, setStructured] = useState<EntryStructured | null>(null);
  const [draft, setDraft] = useState<Partial<EntryStructured>>({});
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [tags, setTags] = useState<ExperienceTag[]>([]);
  const [star, setStar] = useState<StarConversion | null>(null);
  const [starLoading, setStarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'star' | 'pattern'>('star');
  const [relatedInsights, setRelatedInsights] = useState<RelatedInsight[]>([]);
  const [patternLoaded, setPatternLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: entry }, { data: struct }, { data: tagRows }, { data: starRows }] =
        await Promise.all([
          supabase.from('entries').select('raw_text').eq('id', id).single(),
          supabase.from('entries_structured').select('*').eq('entry_id', id).maybeSingle(),
          supabase.from('entry_tags').select('tag').eq('entry_id', id),
          supabase
            .from('star_conversions')
            .select('*')
            .eq('entry_id', id)
            .order('created_at', { ascending: false })
            .limit(1),
        ]);
      if (entry) setRawText(entry.raw_text);
      if (struct) setStructured(struct as EntryStructured);
      if (tagRows) setTags(tagRows.map((r) => r.tag as ExperienceTag));
      if (starRows && starRows.length > 0) setStar(starRows[0] as StarConversion);
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

  async function handleStarConvert() {
    if (!structured || !id) return;
    setStarLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/star', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(structured),
      });
      if (!res.ok) throw new Error('STAR 변환에 실패했습니다.');
      const result = await res.json();

      const { data, error: insertError } = await supabase
        .from('star_conversions')
        .insert({ entry_id: id, ...result })
        .select()
        .single();
      if (insertError) throw insertError;
      setStar(data as StarConversion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STAR 변환에 실패했습니다.');
    } finally {
      setStarLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">기록 상세</h2>

      <div className="mt-4 rounded-lg bg-slate-50 p-4 shadow-sm">
        <p className="text-sm text-slate-800">{rawText}</p>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLORS[tag]}`}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('star')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'star' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          구조화/STAR
        </button>
        <button
          type="button"
          onClick={() => setTab('pattern')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'pattern' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          패턴
        </button>
      </div>

      {tab === 'star' && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">구조화 결과</h3>
            {structured &&
              (editing ? (
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {savingEdit ? '저장 중...' : '저장'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  수정
                </button>
              ))}
          </div>

          {structured ? (
            <dl className="mt-2 space-y-2">
              {STRUCTURED_FIELDS.map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-white p-3 shadow-sm">
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  {editing ? (
                    <textarea
                      value={draft[key] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-slate-800">{structured[key] ?? '-'}</dd>
                  )}
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-500">구조화 결과를 불러오는 중입니다...</p>
          )}

          <button
            type="button"
            onClick={handleStarConvert}
            disabled={starLoading || !structured}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {starLoading ? '변환 중...' : star ? 'STAR로 다시 변환' : 'STAR로 변환'}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {star && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-700">STAR</h3>
              <dl className="mt-2 space-y-2">
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <dt className="text-xs font-medium text-slate-500">Situation</dt>
                  <dd className="mt-1 text-sm text-slate-800">{star.situation}</dd>
                </div>
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <dt className="text-xs font-medium text-slate-500">Task</dt>
                  <dd className="mt-1 text-sm text-slate-800">{star.task}</dd>
                </div>
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <dt className="text-xs font-medium text-slate-500">Action</dt>
                  <dd className="mt-1 text-sm text-slate-800">{star.action}</dd>
                </div>
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <dt className="text-xs font-medium text-slate-500">Result</dt>
                  <dd className="mt-1 text-sm text-slate-800">{star.result}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}

      {tab === 'pattern' && (
        <div className="mt-4">
          {relatedInsights.length === 0 ? (
            <p className="text-sm text-slate-500">
              이 기록과 관련된 패턴이 아직 없어요.{' '}
              <Link to="/insights" className="font-medium text-slate-900 underline">
                전체 패턴 분석 보러가기
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {relatedInsights.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-lg border-l-4 p-3 shadow-sm ${
                    item.type === 'energizer' ? 'border-amber-400 bg-amber-50' : 'border-slate-400 bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-medium text-slate-500">
                    {item.type === 'energizer' ? '⚡ 에너지를 얻는 조건' : '🔋 소진되는 조건'}
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
