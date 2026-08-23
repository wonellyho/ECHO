import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { EntryStructured, ExperienceTag, StarConversion } from '../types';
import { TAG_COLORS } from '../lib/tagColors';

const STRUCTURED_FIELDS: { key: keyof EntryStructured; label: string }[] = [
  { key: 'situation', label: '상황' },
  { key: 'role', label: '내 역할' },
  { key: 'conflict', label: '문제·갈등' },
  { key: 'action', label: '행동' },
  { key: 'result', label: '결과' },
  { key: 'emotion', label: '감정' },
  { key: 'emotion_reason', label: '감정의 이유' },
];

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
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-slate-900">기록 상세</h2>

      <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-sm text-slate-800">{rawText}</p>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_COLORS[tag]}`}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">구조화 결과</h3>
          {structured &&
            (editing ? (
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="text-xs font-medium text-violet-700 disabled:opacity-50"
              >
                {savingEdit ? '저장 중...' : '저장'}
              </button>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="text-xs font-medium text-slate-500"
              >
                수정
              </button>
            ))}
        </div>

        {structured ? (
          <dl className="flex flex-col gap-3">
            {STRUCTURED_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                {editing ? (
                  <textarea
                    value={draft[key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm focus:border-violet-400 focus:outline-none"
                  />
                ) : (
                  <dd className="mt-0.5 text-sm text-slate-800">{structured[key] ?? '-'}</dd>
                )}
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">구조화 결과를 불러오는 중입니다...</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleStarConvert}
        disabled={starLoading || !structured}
        className="rounded-lg bg-violet-600 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {starLoading ? '변환 중...' : star ? 'STAR로 다시 변환' : 'STAR로 변환'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {star && (
        <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">STAR</h3>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-xs font-semibold text-slate-500">Situation</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{star.situation}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Task</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{star.task}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Action</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{star.action}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Result</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{star.result}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
