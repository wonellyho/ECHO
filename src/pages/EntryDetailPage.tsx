import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { EntryStructured, ExperienceTag, StarConversion } from '../types';

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
    <div>
      <h2>기록 상세</h2>

      <div>
        <p>{rawText}</p>
        {tags.length > 0 && (
          <div>
            {tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div>
          <h3>구조화 결과</h3>
          {structured &&
            (editing ? (
              <button type="button" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? '저장 중...' : '저장'}
              </button>
            ) : (
              <button type="button" onClick={startEdit}>
                수정
              </button>
            ))}
        </div>

        {structured ? (
          <dl>
            {STRUCTURED_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt>{label}</dt>
                {editing ? (
                  <textarea
                    value={draft[key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    rows={2}
                  />
                ) : (
                  <dd>{structured[key] ?? '-'}</dd>
                )}
              </div>
            ))}
          </dl>
        ) : (
          <p>구조화 결과를 불러오는 중입니다...</p>
        )}
      </div>

      <button type="button" onClick={handleStarConvert} disabled={starLoading || !structured}>
        {starLoading ? '변환 중...' : star ? 'STAR로 다시 변환' : 'STAR로 변환'}
      </button>
      {error && <p>{error}</p>}

      {star && (
        <div>
          <h3>STAR</h3>
          <dl>
            <div>
              <dt>Situation</dt>
              <dd>{star.situation}</dd>
            </div>
            <div>
              <dt>Task</dt>
              <dd>{star.task}</dd>
            </div>
            <div>
              <dt>Action</dt>
              <dd>{star.action}</dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd>{star.result}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
