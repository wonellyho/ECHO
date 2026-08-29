import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSpeechInput } from '../lib/useSpeechInput';
import { useMicLevel } from '../lib/useMicLevel';
import { VoiceWaveform } from '../components/VoiceWaveform';
import { MicIcon, StopIcon } from '../components/icons';
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

// 4단계 플로우: 음성/타이핑 선택 → (음성 녹음 | 타이핑 입력) → 저장 정보 입력.
// 별도 URL 없이 이 컴포넌트 내부 상태로만 전환한다 (새로고침하면 처음부터 다시 시작).
type Step = 'choice' | 'voice' | 'typing' | 'details';
type Source = 'voice' | 'typing';

export function RecordPage() {
  const navigate = useNavigate();
  const speech = useSpeechInput();
  const micLevel = useMicLevel();

  const [step, setStep] = useState<Step>('choice');
  const [source, setSource] = useState<Source>('typing');
  const [text, setText] = useState('');
  const [editingContent, setEditingContent] = useState(false);

  const [projectTitle, setProjectTitle] = useState('');
  const [projectTitleOptions, setProjectTitleOptions] = useState<string[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionChoice, setCollectionChoice] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [structureFailed, setStructureFailed] = useState(false);

  // 저장 단계(entries insert)까지는 성공했지만 구조화가 실패한 경우, 재시도를 위해 기록해둔다.
  const savedEntryIdRef = useRef<string | null>(null);
  const savedRawTextRef = useRef('');

  const content = source === 'voice' ? speech.transcript : text;
  function setContent(value: string) {
    if (source === 'voice') speech.setTranscript(value);
    else setText(value);
  }

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

  // 화면을 떠날 때 마이크가 계속 켜져 있지 않도록 정리.
  useEffect(() => {
    return () => {
      micLevel.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToVoice() {
    if (!speech.isSupported) return;
    setSource('voice');
    setStep('voice');
    setError(null);
    speech.start();
    micLevel.start();
  }

  function goToTyping() {
    setSource('typing');
    setStep('typing');
  }

  function stopVoiceAndContinue() {
    speech.stop();
    micLevel.stop();
    if (!canSubmitRecord(speech.transcript)) return;
    setStep('details');
  }

  function resumeVoiceRecording() {
    speech.start();
    micLevel.start();
  }

  function switchVoiceToTyping() {
    speech.stop();
    micLevel.stop();
    setText(speech.transcript);
    setSource('typing');
    setStep('typing');
  }

  function cancelVoice() {
    speech.stop();
    micLevel.stop();
    speech.setTranscript('');
    setStep('choice');
  }

  function goToDetailsFromTyping() {
    if (!canSubmitRecord(text)) return;
    setStep('details');
  }

  // "다시 녹음" / "다시 입력" — 이전 단계로 돌아가되 지금까지의 내용은 유지한다.
  function backToSource() {
    setError(null);
    if (source === 'voice') {
      setStep('voice');
      speech.start();
      micLevel.start();
    } else {
      setStep('typing');
    }
  }

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
      setCollections((prev) => [{ id: created.id, name: created.name }, ...prev]);
      setCollectionChoice(created.id);
      return created.id;
    }
    return collectionChoice || null;
  }

  // entries 저장이 끝난 뒤 구조화를 시도한다. 재시도 시에도 동일하게 호출된다.
  // entries_structured는 entry_id가 PK이므로 upsert로 처음 저장/재시도를 동일하게 다룬다.
  async function runStructuring(entryId: string, rawText: string) {
    setStatusMessage('AI가 구조화하는 중...');
    try {
      const res = await fetch('/api/structure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw_text: rawText }),
      });
      if (!res.ok) throw new Error('구조화 요청에 실패했습니다.');
      const structured: StructureResponse = await res.json();

      const { error: structuredError } = await supabase.from('entries_structured').upsert(
        {
          entry_id: entryId,
          situation: structured.situation,
          role: structured.role,
          conflict: structured.conflict,
          action: structured.action,
          result: structured.result,
          emotion: structured.emotion,
          emotion_reason: structured.emotion_reason,
          realization: structured.realization,
          status: 'done',
        },
        { onConflict: 'entry_id' },
      );
      if (structuredError) throw structuredError;

      if (structured.tags?.length) {
        const { error: tagError } = await supabase
          .from('entry_tags')
          .insert(structured.tags.map((tag) => ({ entry_id: entryId, tag })));
        if (tagError) throw tagError;
      }

      setStatusMessage(null);
      setStructureFailed(false);
      navigate(`/entries/${entryId}`);
    } catch (err) {
      // 기록 자체는 이미 저장돼 있으므로, 구조화 실패 기록만 남기고 저장 정보 화면에 머문다.
      await supabase
        .from('entries_structured')
        .upsert({ entry_id: entryId, status: 'failed' }, { onConflict: 'entry_id' });
      setError(
        err instanceof Error ? err.message : '구조화 요청에 실패했습니다. 녹음 내용과 선택은 유지됩니다.',
      );
      setStructureFailed(true);
      setStatusMessage(null);
    }
  }

  async function handleSave() {
    if (!canSubmitRecord(content)) return;
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
          raw_text: content,
          input_type: source === 'voice' ? 'voice' : 'text',
          project_title: projectTitle.trim() || null,
          collection_id: collectionId,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      savedEntryIdRef.current = entry.id;
      savedRawTextRef.current = content;

      await runStructuring(entry.id, content);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
      setStatusMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleRetryStructuring() {
    if (!savedEntryIdRef.current) return;
    setSaving(true);
    setError(null);
    await runStructuring(savedEntryIdRef.current, savedRawTextRef.current);
    setSaving(false);
  }

  function handleSkipStructuring() {
    if (!savedEntryIdRef.current) return;
    navigate(`/entries/${savedEntryIdRef.current}`);
  }

  if (step === 'choice') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col px-4 py-6">
        <h2 className="text-xl font-semibold text-slate-900">오늘의 경험을 남겨보세요</h2>
        <p className="mt-2 text-sm text-slate-500">말하거나 적으면 AI가 구조화해 둡니다.</p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={goToVoice}
            disabled={!speech.isSupported}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3.5 text-left transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-slate-900">음성으로 기록</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {speech.isSupported ? '말하면 자동으로 글로 옮깁니다' : '사용 불가'}
            </p>
          </button>
          <button
            type="button"
            onClick={goToTyping}
            className="rounded-lg border border-slate-300 px-4 py-3.5 text-left transition-colors hover:bg-slate-100"
          >
            <p className="text-sm font-semibold text-slate-900">타이핑으로 기록</p>
            <p className="mt-0.5 text-xs text-slate-500">직접 입력합니다</p>
          </button>
        </div>

        {!speech.isSupported && (
          <p className="mt-3 rounded-md border border-slate-300 p-2.5 text-xs text-slate-700">
            이 브라우저에서는 음성 입력을 쓸 수 없습니다. 타이핑으로 기록해주세요.
          </p>
        )}

        <div className="mt-auto flex flex-col items-center gap-2 pt-8">
          <p className="text-xs text-slate-500">눌러서 바로 녹음 시작</p>
          <button
            type="button"
            onClick={goToVoice}
            disabled={!speech.isSupported}
            aria-label="음성으로 기록 시작"
            className="flex h-28 w-28 items-center justify-center rounded-full border border-slate-300 disabled:opacity-40"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900">
              <MicIcon className="h-7 w-7 text-white" />
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'voice') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col bg-gradient-to-b from-orange-100 via-rose-100 to-pink-200 px-4 py-6">
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={cancelVoice}
            className="rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-slate-700 hover:bg-white/70"
          >
            ← 뒤로
          </button>
          <p className="font-medium text-slate-900">
            {speech.isRecording ? '듣고 있습니다...' : '음성으로 기록'}
          </p>
          <span className="w-16" />
        </div>

        <div className="mt-6">
          <VoiceWaveform history={micLevel.history} barClassName="bg-white/90" />
        </div>

        <p className="mt-6 min-h-[3.5rem] whitespace-pre-wrap text-center text-sm leading-relaxed text-slate-700">
          {speech.transcript ||
            (speech.isRecording ? '' : '아래 버튼을 눌러 시작하세요. 말한 내용이 이 자리에 실시간으로 표시됩니다.')}
        </p>

        {speech.error && (
          <div className="mt-4 rounded-2xl border border-white/60 bg-white/50 p-2.5 text-sm text-slate-800">
            <p>! 음성을 인식하지 못했습니다. 다시 시도하거나 타이핑으로 남겨주세요.</p>
            {speech.transcript && (
              <p className="mt-1 text-xs text-slate-600">여기까지는 저장되어 있습니다 (이어서 녹음 가능)</p>
            )}
          </div>
        )}
        {micLevel.error && <p className="mt-2 text-xs text-slate-600">{micLevel.error} (파형만 비활성됩니다)</p>}

        <div className="mt-auto flex items-center justify-between pt-8">
          <button
            type="button"
            onClick={switchVoiceToTyping}
            aria-label="타이핑으로 전환"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/50 text-[10px] text-slate-700 hover:bg-white/70"
          >
            키보드
          </button>
          {speech.isRecording ? (
            <button
              type="button"
              onClick={stopVoiceAndContinue}
              aria-label="녹음 정지"
              className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 shadow-lg"
            >
              <StopIcon className="h-7 w-7 rounded-sm bg-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={resumeVoiceRecording}
              aria-label="다시 녹음"
              className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-[10px] text-white shadow-lg"
            >
              <MicIcon className="h-6 w-6 text-white" />
              다시
            </button>
          )}
          <button
            type="button"
            onClick={cancelVoice}
            aria-label="취소"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/50 text-slate-700 hover:bg-white/70"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-600">가운데 버튼 = 녹음 정지 · 정지하면 저장 정보 입력으로</p>
      </div>
    );
  }

  if (step === 'typing') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h2 className="text-xl font-semibold text-slate-900">오늘의 경험을 남겨보세요</h2>
        <textarea
          placeholder="예: 오늘 팀 발표에서 갑자기 자료가 안 열려서 당황했는데, 즉석에서 화면 공유 없이 설명해서 넘겼다. 발표 끝나고 뿌듯했다."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="mt-4 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={goToDetailsFromTyping}
          disabled={!canSubmitRecord(text)}
          className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          다음
        </button>
      </div>
    );
  }

  // step === 'details'
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={backToSource}
          disabled={saving}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          ← {source === 'voice' ? '다시 녹음' : '다시 입력'}
        </button>
        <p className="font-medium text-slate-900">2 / 2 · 저장 정보</p>
        <span className="w-16" />
      </div>

      <div className="mt-4 rounded-md border border-slate-300 p-3">
        <p className="text-xs text-slate-500">{source === 'voice' ? '녹음한 내용' : '입력한 내용'}</p>
        {editingContent ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm"
          />
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{content}</p>
        )}
        <button
          type="button"
          onClick={() => setEditingContent((prev) => !prev)}
          className="mt-2 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          {editingContent ? '수정 완료' : '내용 수정'}
        </button>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">프로젝트 제목</p>
        <input
          type="text"
          list="project-title-options"
          placeholder="선택 입력"
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          disabled={saving}
          className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
        />
        <datalist id="project-title-options">
          {projectTitleOptions.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>
        {projectTitleOptions.length === 0 && (
          <p className="mt-1.5 text-xs text-slate-500">추천할 기존 제목이 없습니다</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">컬렉션</p>
        {collections.length === 0 ? (
          <p className="mt-1.5 rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
            만든 컬렉션이 없습니다.
          </p>
        ) : null}
        <select
          value={collectionChoice}
          onChange={(e) => setCollectionChoice(e.target.value)}
          disabled={saving}
          className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
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
      </div>

      {statusMessage && <p className="mt-4 text-sm text-slate-500">{statusMessage}</p>}
      {error && (
        <div className="mt-4 rounded-md border border-slate-300 p-2.5 text-sm text-slate-800">
          <p>! {error}</p>
          {structureFailed && <p className="mt-1 text-xs text-slate-500">기록 자체는 저장됨 · 구조화만 재시도</p>}
        </div>
      )}

      {structureFailed ? (
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRetryStructuring}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? '다시 시도 중...' : '다시 시도'}
          </button>
          <button
            type="button"
            onClick={handleSkipStructuring}
            className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            구조화 없이 저장만 하고 나가기
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSubmitRecord(content)}
          className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '기록 저장하기'}
        </button>
      )}
    </div>
  );
}
