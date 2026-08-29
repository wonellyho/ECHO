import { useEffect, useState } from 'react';
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

interface CollectionOption {
  id: string;
  name: string;
}

const NEW_COLLECTION_VALUE = '__new__';

export function RecordPage() {
  const navigate = useNavigate();
  const speech = useSpeechInput();
  const [text, setText] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectTitleOptions, setProjectTitleOptions] = useState<string[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionChoice, setCollectionChoice] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveText = text || speech.transcript;

  useEffect(() => {
    (async () => {
      const [{ data: entryRows }, { data: collectionRows }] = await Promise.all([
        supabase.from('entries').select('project_title').not('project_title', 'is', null),
        supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
      ]);
      const titles = Array.from(
        new Set((entryRows ?? []).map((row) => row.project_title as string).filter(Boolean)),
      );
      setProjectTitleOptions(titles);
      setCollections((collectionRows ?? []) as CollectionOption[]);
    })();
  }, []);

  async function resolveCollectionId(userId: string): Promise<string | null> {
    if (collectionChoice === NEW_COLLECTION_VALUE) {
      const trimmedName = newCollectionName.trim();
      if (!trimmedName) return null;
      const { data: created, error: createError } = await supabase
        .from('collections')
        .insert({ user_id: userId, name: trimmedName })
        .select()
        .single();
      if (createError) throw createError;
      return created.id;
    }
    return collectionChoice || null;
  }

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

      const collectionId = await resolveCollectionId(user.id);

      const { data: entry, error: insertError } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          raw_text: effectiveText,
          input_type: speech.transcript && !text ? 'voice' : 'text',
          project_title: projectTitle.trim() || null,
          collection_id: collectionId,
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
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">오늘의 경험을 남겨보세요</h2>

      {speech.isSupported && (
        <button
          type="button"
          onClick={speech.isRecording ? speech.stop : speech.start}
          disabled={saving}
          className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            speech.isRecording
              ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-slate-300 text-slate-600 hover:bg-slate-100'
          }`}
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
        className="mt-4 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
      />

      <input
        type="text"
        list="project-title-options"
        placeholder="프로젝트 제목 (선택)"
        value={projectTitle}
        onChange={(e) => setProjectTitle(e.target.value)}
        disabled={saving}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
      />
      <datalist id="project-title-options">
        {projectTitleOptions.map((title) => (
          <option key={title} value={title} />
        ))}
      </datalist>

      <select
        value={collectionChoice}
        onChange={(e) => setCollectionChoice(e.target.value)}
        disabled={saving}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">컬렉션 없음</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_COLLECTION_VALUE}>+ 새 컬렉션 만들기</option>
      </select>

      {collectionChoice === NEW_COLLECTION_VALUE && (
        <input
          type="text"
          placeholder="새 컬렉션 이름"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          disabled={saving}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
        />
      )}

      {speech.error && <p className="mt-2 text-sm text-red-600">{speech.error}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {statusMessage && <p className="mt-2 text-sm text-slate-500">{statusMessage}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !canSubmitRecord(effectiveText)}
        className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        기록하기
      </button>
    </div>
  );
}
