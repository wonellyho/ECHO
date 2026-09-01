import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSpeechInput } from '../lib/useSpeechInput';
import { useMicAnalyser } from '../lib/useMicAnalyser';
import { AmbientVoiceField } from '../components/AmbientVoiceField';
import { Logo } from '../components/Logo';
import { CheckIcon, KeyboardIcon, MicIcon, PauseIcon, PlayIcon, TrashIcon, TypingIcon } from '../components/icons';
import { canSubmitRecord } from '../lib/recordValidation';
import { formatDuration } from '../lib/formatDuration';
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

// nav "기록"으로 나가려 할 때 작성 중인 내용이 사라지는 걸 알리는 확인창.
// 3분짜리 녹음을 실수로 날리지 않게 하기 위한 것이라, 내용이 있을 때만 띄운다.
function LeaveConfirmDialog({
  alreadySaved,
  onCancel,
  onConfirm,
}: {
  /** 저장은 됐고 구조화만 실패한 상태인지 — 이 경우 "사라진다"는 안내는 사실이 아니다. */
  alreadySaved: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6">
      <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm font-medium text-slate-50">
          {alreadySaved ? '구조화를 마치지 않고 나갑니다' : '작성 중인 내용이 사라집니다'}
        </p>
        <p className="mt-1.5 text-xs text-slate-400">
          {alreadySaved
            ? '기록 자체는 이미 저장되어 있고, AI 구조화만 아직 안 된 상태입니다. 나중에 기록 상세에서 다시 시도할 수 있어요.'
            : '지금까지 기록한 내용은 저장되지 않았습니다. 첫 화면으로 나갈까요?'}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            계속 작성
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const speech = useSpeechInput();
  const mic = useMicAnalyser();

  const [step, setStep] = useState<Step>('choice');
  const [source, setSource] = useState<Source>('typing');
  const [text, setText] = useState('');
  const [editingContent, setEditingContent] = useState(false);

  // 녹화 화면 경과 시간. 녹음 중일 때만 흐르고, 일시정지하면 멈췄다가 이어 녹음하면
  // 리셋하지 않고 멈춘 지점부터 계속된다 — 받아쓰기 내용이 이어붙는 동작과 일관되게.
  // 틱마다 고정값을 더하면 브라우저가 백그라운드 탭의 interval을 1초로 묶을 때 시간이 어긋나므로,
  // 실제 벽시계(Date.now)로 계산하고 일시정지 시점의 누적분만 ref에 접어둔다.
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedBaseRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  // 사용자가 ✓(완료)를 눌렀는지. 단순 일시정지(⏸)와 구분하기 위한 값 —
  // 완료 상태에서만 가운데 버튼이 "넘어가기"가 된다.
  const [voiceDone, setVoiceDone] = useState(false);
  // nav "기록"으로 나가려는데 작성 중인 내용이 있어 확인을 띄운 상태.
  const [confirmLeave, setConfirmLeave] = useState(false);

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

  // 녹음 중일 때만 경과 시간이 흐른다. 멈추면 그때까지의 실제 경과를 누적분에 접어두고,
  // 화면을 떠날 때도 같은 정리 경로로 interval이 해제된다.
  useEffect(() => {
    if (!speech.isRecording) {
      if (recordingStartedAtRef.current !== null) {
        elapsedBaseRef.current += Date.now() - recordingStartedAtRef.current;
        recordingStartedAtRef.current = null;
        setElapsedMs(elapsedBaseRef.current);
      }
      return;
    }
    const startedAt = Date.now();
    recordingStartedAtRef.current = startedAt;
    const id = setInterval(() => {
      setElapsedMs(elapsedBaseRef.current + (Date.now() - startedAt));
    }, 200);
    return () => clearInterval(id);
  }, [speech.isRecording]);

  // 녹음 중 실시간 대본이 길어지면 새로 인식된 말이 접힌 부분 아래로 들어가, 말하는 사람이
  // 첫 문장만 계속 보게 된다. 새 내용이 붙을 때마다 바닥으로 따라 내린다.
  // 다만 사용자가 위로 올려 앞부분을 읽는 중이면 끌어내리지 않는다.
  const liveTranscriptRef = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    const el = liveTranscriptRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 48) return;
    el.scrollTop = el.scrollHeight;
  }, [speech.transcript]);

  function resetVoiceTimer() {
    elapsedBaseRef.current = 0;
    recordingStartedAtRef.current = null;
    setElapsedMs(0);
  }

  function goToVoice() {
    if (!speech.isSupported) return;
    setSource('voice');
    setStep('voice');
    setError(null);
    resetVoiceTimer();
    setVoiceDone(false);
    speech.start();
    mic.start();
  }

  function goToTyping() {
    setSource('typing');
    setStep('typing');
  }

  // ⏸ 일시정지 — 녹음만 멈춘다. 가운데 버튼은 아직 ✓(완료) 상태로 남는다.
  function pauseVoiceRecording() {
    speech.stop();
    mic.stop();
  }

  // ✓ 완료 — 녹음을 멈추고 "넘어갈 준비가 됐다" 상태로 바꾼다. 화면 전환은 하지 않는다.
  function finishVoiceRecording() {
    speech.stop();
    mic.stop();
    setVoiceDone(true);
  }

  // "넘어가기" — 실제로 저장 정보 입력 단계로 넘어간다.
  function goToDetailsFromVoice() {
    if (!canSubmitRecord(speech.transcript)) return;
    setStep('details');
  }

  function resumeVoiceRecording() {
    setVoiceDone(false);
    speech.start();
    mic.start();
  }

  function switchVoiceToTyping() {
    speech.stop();
    mic.stop();
    setText(speech.transcript);
    setSource('typing');
    setStep('typing');
  }

  // 타이핑 화면에서 다시 음성으로. 지금까지 친 글을 받아쓰기 기준값으로 옮겨두면
  // 이어서 말한 내용이 그 뒤에 붙는다.
  function switchTypingToVoice() {
    if (!speech.isSupported) return;
    speech.setTranscript(text);
    setSource('voice');
    setStep('voice');
    setVoiceDone(false);
    speech.start();
    mic.start();
  }

  function cancelVoice() {
    resetRecordState();
    setStep('choice');
  }

  function goToDetailsFromTyping() {
    if (!canSubmitRecord(text)) return;
    setStep('details');
  }

  // 기록 플로우의 모든 상태를 처음으로 되돌린다.
  // 일부만 지우면 이전 시도의 잔재(특히 structureFailed와 savedEntryIdRef)가 남아,
  // 새로 녹음한 내용이 details 단계에서 저장 버튼 대신 "이전 기록 구조화 재시도" 화면을
  // 만나 영영 저장할 수 없게 된다. 그래서 리셋 지점을 한 곳으로 모은다.
  function resetRecordState() {
    speech.stop();
    mic.stop();
    speech.setTranscript('');
    setText('');
    resetVoiceTimer();
    setVoiceDone(false);
    setEditingContent(false);
    setError(null);
    setStatusMessage(null);
    setStructureFailed(false);
    savedEntryIdRef.current = null;
    savedRawTextRef.current = '';
    setProjectTitle('');
    setCollectionChoice('');
    setNewCollectionName('');
  }

  // nav의 "기록" 탭 — 어느 단계에 있든 첫 화면(선택)으로 돌아간다.
  // 작성 중인 내용이 있으면 곧바로 버리지 않고 한 번 확인한다.
  function returnToChoice() {
    resetRecordState();
    setStep('choice');
    setConfirmLeave(false);
  }

  function requestReturnToChoice() {
    if (step === 'choice') return;
    // 저장이 진행 중이면 끼어들지 않는다 — 중간에 화면을 되돌려도 저장 요청은 계속 날아가고,
    // 성공하면 몇 초 뒤 갑자기 상세 화면으로 튕겨 나간다.
    // 다만 아무 반응 없이 무시하면 탭이 먹힌 것처럼 보이므로 이유를 알려준다.
    if (saving) {
      setStatusMessage('저장 중입니다. 잠시만 기다려주세요.');
      return;
    }
    if (canSubmitRecord(content)) {
      setConfirmLeave(true);
      return;
    }
    returnToChoice();
  }

  // nav에서 "기록"을 누르면 같은 경로라도 새 location.key가 생긴다. 그걸 신호로 삼아
  // 첫 화면으로 되돌린다 (최초 마운트 때의 key는 무시).
  // "마지막으로 처리한 key"를 들고 있어야 한다. 마운트 시점의 key로만 비교하면, 확인창에서
  // "계속 작성"을 고른 뒤 브라우저 뒤로가기로 원래 key에 돌아왔을 때 아무 반응도 하지 않는다.
  const handledLocationKeyRef = useRef(location.key);
  useEffect(() => {
    if (location.key === handledLocationKeyRef.current) return;
    handledLocationKeyRef.current = location.key;
    requestReturnToChoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // "다시 녹음" / "다시 입력" — 이전 단계로 돌아가되 지금까지의 내용은 유지한다.
  function backToSource() {
    setError(null);
    if (source === 'voice') {
      setStep('voice');
      setVoiceDone(false);
      speech.start();
      mic.start();
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
        <Logo />
        <h2 className="mt-6 text-xl font-semibold text-slate-50">오늘의 경험을 남겨보세요</h2>
        <p className="mt-2 text-sm text-slate-400">말하거나 적으면 AI가 구조화해 둡니다.</p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={goToVoice}
            disabled={!speech.isSupported}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-left transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
              <MicIcon className="h-5 w-5 text-white" />
            </span>
            <span>
              <p className="text-sm font-semibold text-slate-50">음성으로 기록</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {speech.isSupported ? '말하면 자동으로 글로 옮깁니다' : '사용 불가'}
              </p>
            </span>
          </button>
          <button
            type="button"
            onClick={goToTyping}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-left transition-colors hover:bg-slate-800"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700">
              <TypingIcon className="h-5 w-5 text-white" />
            </span>
            <span>
              <p className="text-sm font-semibold text-slate-50">타이핑으로 기록</p>
              <p className="mt-0.5 text-xs text-slate-400">직접 입력합니다</p>
            </span>
          </button>
        </div>

        {!speech.isSupported && (
          <p className="mt-3 rounded-md border border-slate-700 p-2.5 text-xs text-slate-200">
            이 브라우저에서는 음성 입력을 쓸 수 없습니다. 타이핑으로 기록해주세요.
          </p>
        )}

        <div className="mt-auto flex flex-col items-center gap-2 pt-8">
          <p className="text-xs text-slate-400">눌러서 바로 녹음 시작</p>
          <button
            type="button"
            onClick={goToVoice}
            disabled={!speech.isSupported}
            aria-label="음성으로 기록 시작"
            className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 p-1 disabled:opacity-40"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
              <MicIcon className="h-7 w-7 text-white" />
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'voice') {
    // 높이를 고정하되 100vh가 아니라 100dvh를 쓴다 — iOS Safari의 100vh는 주소창을 무시한
    // "큰 뷰포트" 기준이라, 고정 높이로 잡으면 하단 컨트롤이 툴바 아래에 깔려 손이 닿지 않는다.
    // 그리고 본문은 스크롤되게 두고 컨트롤 줄은 sticky로 바닥에 붙여, 화면이 아무리 낮아도
    // (가로 모드 등) 녹음을 멈출 수단이 사라지지 않게 한다.
    return (
      <div className="relative isolate mx-auto flex h-[calc(100dvh-3.5rem)] max-w-md flex-col overflow-hidden bg-[#fdf4ec]">
        <AmbientVoiceField analyserRef={mic.analyserRef} />

        {/* 시각화는 배경 레이어이고 조작 요소는 전부 그 위에 얹는다. */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={requestReturnToChoice}
              className="rounded-full bg-white/70 px-3 py-1.5 text-slate-700 ring-1 ring-slate-900/10 backdrop-blur-sm hover:bg-white/90"
            >
              ← 뒤로
            </button>
            <button
              type="button"
              onClick={switchVoiceToTyping}
              aria-label="타이핑으로 전환"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-slate-700 ring-1 ring-slate-900/10 backdrop-blur-sm hover:bg-white/90"
            >
              <KeyboardIcon className="h-4 w-4" />
            </button>
          </div>

          <p
            className="mt-6 text-center text-sm font-medium tracking-wide text-slate-700"
            aria-live="polite"
          >
            {speech.isRecording ? '듣고 있어요' : voiceDone ? '녹음을 마쳤어요' : '잠시 멈췄어요'}
          </p>

          <p
            className="mt-2 text-center text-5xl font-light tabular-nums text-slate-800"
            role="timer"
          >
            {formatDuration(elapsedMs)}
          </p>

          {/* 녹음 중에는 실시간 표시(읽기 전용), 멈추면 그 자리에서 바로 고칠 수 있는 입력이 된다.
              커서를 올린 곳부터 수정 가능하도록 textarea를 그대로 노출한다. */}
          <div className="mt-8 min-h-0 flex-1">
            {speech.isRecording ? (
              <p
                ref={liveTranscriptRef}
                className="h-full overflow-y-auto whitespace-pre-wrap text-center text-lg leading-relaxed text-slate-800"
              >
                {speech.transcript || '말씀하시면 이 자리에 실시간으로 옮겨 적어요.'}
              </p>
            ) : (
              <textarea
                value={speech.transcript}
                onChange={(e) => speech.setTranscript(e.target.value)}
                placeholder="여기에 직접 입력하거나, 녹음한 내용을 고칠 수 있어요."
                aria-label="녹음한 내용 (수정 가능)"
                className="h-full min-h-[6rem] w-full resize-none rounded-2xl bg-white/60 p-4 text-lg leading-relaxed text-slate-800 placeholder:text-slate-600 focus:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/60"
              />
            )}
          </div>

          {speech.error && (
            <div className="mt-4 rounded-2xl bg-white/75 p-2.5 text-sm text-slate-800 backdrop-blur-sm">
              {/* 훅이 침묵 같은 정상 상황과 실제 오류(마이크 끊김, 권한 거부 등)를 이미 구분해서
                  올려주므로, 원인을 뭉뚱그리지 않고 그대로 보여준다. */}
              <p>! {speech.error}</p>
              <p className="mt-1 text-xs text-slate-600">다시 시도하거나 타이핑으로 남겨주세요.</p>
              {speech.transcript && (
                <p className="mt-1 text-xs text-slate-600">여기까지는 저장되어 있습니다 (이어서 녹음 가능)</p>
              )}
            </div>
          )}
          {mic.error && (
            <p className="mt-2 rounded-xl bg-white/75 px-2.5 py-1.5 text-xs text-slate-800 backdrop-blur-sm">
              {mic.error} (배경 시각화만 비활성됩니다)
            </p>
          )}

          {/* 본문이 길어져 스크롤되더라도 컨트롤은 항상 바닥에 붙어 있어야 한다. */}
          <div className="sticky bottom-0 mt-8 flex items-center justify-between pb-1">
            {speech.isRecording ? (
              <button
                type="button"
                onClick={pauseVoiceRecording}
                aria-label="일시정지"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-900/15 backdrop-blur-sm hover:bg-white"
              >
                <PauseIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeVoiceRecording}
                aria-label="이어 녹음"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-900/15 backdrop-blur-sm hover:bg-white"
              >
                <PlayIcon className="h-5 w-5" />
              </button>
            )}

            {voiceDone ? (
              <button
                type="button"
                onClick={goToDetailsFromVoice}
                disabled={!canSubmitRecord(speech.transcript)}
                className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-lg font-medium text-slate-800 shadow-lg shadow-orange-900/10 ring-1 ring-slate-900/15 disabled:opacity-50"
              >
                저장
              </button>
            ) : (
              <button
                type="button"
                onClick={finishVoiceRecording}
                aria-label="녹음 완료"
                className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg shadow-orange-900/10 ring-1 ring-slate-900/15"
              >
                <CheckIcon className="h-9 w-9" />
              </button>
            )}

            <button
              type="button"
              onClick={cancelVoice}
              aria-label="삭제"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-900/15 backdrop-blur-sm hover:bg-white"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>

          {voiceDone && !canSubmitRecord(speech.transcript) && (
            <p className="mt-3 text-center text-xs text-slate-700">먼저 녹음해주세요</p>
          )}
        </div>

        {confirmLeave && (
          <LeaveConfirmDialog
            alreadySaved={savedEntryIdRef.current !== null}
            onCancel={() => setConfirmLeave(false)}
            onConfirm={returnToChoice}
          />
        )}
      </div>
    );
  }

  if (step === 'typing') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-50">오늘의 경험을 남겨보세요</h2>
          {speech.isSupported && (
            <button
              type="button"
              onClick={switchTypingToVoice}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              <MicIcon className="h-3.5 w-3.5 text-slate-300" />
              음성으로
            </button>
          )}
        </div>
        <textarea
          placeholder="예: 오늘 팀 발표에서 갑자기 자료가 안 열려서 당황했는데, 즉석에서 화면 공유 없이 설명해서 넘겼다. 발표 끝나고 뿌듯했다."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="mt-4 w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={goToDetailsFromTyping}
          disabled={!canSubmitRecord(text)}
          className="mt-4 w-full rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
        >
          다음
        </button>

        {confirmLeave && (
          <LeaveConfirmDialog
            alreadySaved={savedEntryIdRef.current !== null}
            onCancel={() => setConfirmLeave(false)}
            onConfirm={returnToChoice}
          />
        )}
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
          className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          ← {source === 'voice' ? '다시 녹음' : '다시 입력'}
        </button>
        <p className="font-medium text-slate-50">2 / 2 · 저장 정보</p>
        <span className="w-16" />
      </div>

      <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-3">
        <p className="text-xs text-slate-400">{source === 'voice' ? '녹음한 내용' : '입력한 내용'}</p>
        {editingContent ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-sm text-slate-50"
          />
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{content}</p>
        )}
        <button
          type="button"
          onClick={() => setEditingContent((prev) => !prev)}
          className="mt-2 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          {editingContent ? '수정 완료' : '내용 수정'}
        </button>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-50">프로젝트 제목</p>
        <input
          type="text"
          list="project-title-options"
          placeholder="선택 입력"
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          disabled={saving}
          className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none disabled:opacity-50"
        />
        <datalist id="project-title-options">
          {projectTitleOptions.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>
        {projectTitleOptions.length === 0 && (
          <p className="mt-1.5 text-xs text-slate-400">추천할 기존 제목이 없습니다</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-50">컬렉션</p>
        {collections.length === 0 ? (
          <p className="mt-1.5 rounded-md border border-dashed border-slate-700 p-3 text-center text-xs text-slate-400">
            만든 컬렉션이 없습니다.
          </p>
        ) : null}
        <select
          value={collectionChoice}
          onChange={(e) => setCollectionChoice(e.target.value)}
          disabled={saving}
          className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:border-slate-500 focus:outline-none disabled:opacity-50"
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
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none disabled:opacity-50"
          />
        )}
      </div>

      {statusMessage && <p className="mt-4 text-sm text-slate-400">{statusMessage}</p>}
      {error && (
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-2.5 text-sm text-slate-100">
          <p>! {error}</p>
          {structureFailed && <p className="mt-1 text-xs text-slate-400">기록 자체는 저장됨 · 구조화만 재시도</p>}
        </div>
      )}

      {structureFailed ? (
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRetryStructuring}
            disabled={saving}
            className="rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
          >
            {saving ? '다시 시도 중...' : '다시 시도'}
          </button>
          <button
            type="button"
            onClick={handleSkipStructuring}
            className="rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            구조화 없이 저장만 하고 나가기
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSubmitRecord(content)}
          className="mt-4 w-full rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '기록 저장하기'}
        </button>
      )}

      {confirmLeave && (
        <LeaveConfirmDialog
            alreadySaved={savedEntryIdRef.current !== null}
            onCancel={() => setConfirmLeave(false)}
            onConfirm={returnToChoice}
          />
      )}
    </div>
  );
}
