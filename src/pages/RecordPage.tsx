import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSpeechInput } from '../lib/useSpeechInput';
import { canSubmitRecord } from '../lib/recordValidation';
import type { ExperienceTag } from '../types';

interface StructureResponse {
  situation: string | null;
  role: string | null;
  conflict: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  emotion_reason: string | null;
  realization: string | null;
  tags: ExperienceTag[];
}

export function RecordPage() {
  const navigate = useNavigate();
  const speech = useSpeechInput();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveText = text || speech.transcript;

  async function handleSubmit() {
    if (!canSubmitRecord(effectiveText)) return;
    setSaving(true);
    setError(null);
    setStatusMessage('저장 중...');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { data: entry, error: insertError } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          raw_text: effectiveText,
          input_type: speech.transcript && !text ? 'voice' : 'text',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      setStatusMessage('AI가 구조화하는 중...');

      const res = await fetch('/api/structure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw_text: effectiveText }),
      });
      if (!res.ok) throw new Error('구조화 요청에 실패했습니다.');
      const structured: StructureResponse = await res.json();

      const { error: structuredError } = await supabase.from('entries_structured').insert({
        entry_id: entry.id,
        situation: structured.situation,
        role: structured.role,
        conflict: structured.conflict,
        action: structured.action,
        result: structured.result,
        emotion: structured.emotion,
        emotion_reason: structured.emotion_reason,
        realization: structured.realization,
        status: 'done',
      });
      if (structuredError) throw structuredError;

      if (structured.tags?.length) {
        const { error: tagError } = await supabase
          .from('entry_tags')
          .insert(structured.tags.map((tag) => ({ entry_id: entry.id, tag })));
        if (tagError) throw tagError;
      }

      setStatusMessage(null);
      navigate(`/entries/${entry.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
      setStatusMessage(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>오늘의 경험을 남겨보세요</h2>

      {speech.isSupported && (
        <button
          type="button"
          onClick={speech.isRecording ? speech.stop : speech.start}
          disabled={saving}
        >
          {speech.isRecording ? '녹음 중지' : '🎙️ 음성으로 기록'}
        </button>
      )}

      <textarea
        placeholder="예: 오늘 팀 발표에서 갑자기 자료가 안 열려서 당황했는데, 즉석에서 화면 공유 없이 설명해서 넘겼다. 발표 끝나고 뿌듯했다."
        value={effectiveText}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        disabled={saving}
      />

      {speech.error && <p>{speech.error}</p>}
      {error && <p>{error}</p>}
      {statusMessage && <p>{statusMessage}</p>}

      <button type="button" onClick={handleSubmit} disabled={saving || !canSubmitRecord(effectiveText)}>
        기록하기
      </button>
    </div>
  );
}
