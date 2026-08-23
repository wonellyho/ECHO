import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { EntryStructured, ExperienceTag, StarConversion } from '../types';

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rawText, setRawText] = useState('');
  const [structured, setStructured] = useState<EntryStructured | null>(null);
  const [tags, setTags] = useState<ExperienceTag[]>([]);
  const [star, setStar] = useState<StarConversion | null>(null);
  const [starLoading, setStarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: entry }, { data: struct }, { data: tagRows }] = await Promise.all([
        supabase.from('entries').select('raw_text').eq('id', id).single(),
        supabase.from('entries_structured').select('*').eq('entry_id', id).maybeSingle(),
        supabase.from('entry_tags').select('tag').eq('entry_id', id),
      ]);
      if (entry) setRawText(entry.raw_text);
      if (struct) setStructured(struct as EntryStructured);
      if (tagRows) setTags(tagRows.map((r) => r.tag as ExperienceTag));
    })();
  }, [id]);

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
    <div className="entry-detail-page">
      <h2>기록 상세</h2>
      <p className="raw-text">{rawText}</p>

      {tags.length > 0 && (
        <div className="tags">
          {tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {structured ? (
        <dl className="structured">
          <dt>상황</dt>
          <dd>{structured.situation ?? '-'}</dd>
          <dt>내 역할</dt>
          <dd>{structured.role ?? '-'}</dd>
          <dt>문제·갈등</dt>
          <dd>{structured.conflict ?? '-'}</dd>
          <dt>행동</dt>
          <dd>{structured.action ?? '-'}</dd>
          <dt>결과</dt>
          <dd>{structured.result ?? '-'}</dd>
          <dt>감정</dt>
          <dd>{structured.emotion ?? '-'}</dd>
          <dt>감정의 이유</dt>
          <dd>{structured.emotion_reason ?? '-'}</dd>
        </dl>
      ) : (
        <p>구조화 결과를 불러오는 중입니다...</p>
      )}

      <button type="button" onClick={handleStarConvert} disabled={starLoading || !structured}>
        {starLoading ? '변환 중...' : 'STAR로 변환'}
      </button>
      {error && <p className="error">{error}</p>}

      {star && (
        <dl className="star">
          <dt>Situation</dt>
          <dd>{star.situation}</dd>
          <dt>Task</dt>
          <dd>{star.task}</dd>
          <dt>Action</dt>
          <dd>{star.action}</dd>
          <dt>Result</dt>
          <dd>{star.result}</dd>
        </dl>
      )}
    </div>
  );
}
