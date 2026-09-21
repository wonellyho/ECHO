import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { postJson } from '../lib/apiClient';
import { useSpeechInput } from '../lib/useSpeechInput';
import { useMicAnalyser } from '../lib/useMicAnalyser';
import { VoiceWaveform } from '../components/VoiceWaveform';
import { Logo } from '../components/Logo';
import { SpaceScene } from '../components/cosmic/SpaceScene';
import { CosmicPage } from '../components/cosmic/CosmicPage';
import { GlassCard, GlassPanel } from '../components/ui/GlassCard';
import { GradientButton, OutlineButton, CosmicIconButton, BackButton } from '../components/ui/CosmicButton';
import { CosmicTextarea } from '../components/ui/CosmicInput';
import { RecordOrb } from '../components/record/RecordOrb';
import {
  CheckIcon,
  ChevronRightIcon,
  KeyboardIcon,
  MicIcon,
  StopIcon,
  TrashIcon,
  TypingIcon,
} from '../components/icons';
import { canSubmitRecord } from '../lib/recordValidation';
import { formatDuration } from '../lib/formatDuration';
import { useNickname } from '../lib/useNickname';
import { ROUTES } from '../lib/routes';
import { CARD_COLOR_HEX, CARD_COLOR_KEYS, CARD_COLOR_LABELS } from '../lib/tagColors';
import type { CardColorKey, ExperienceTag } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,4,13,0.78)] p-6 backdrop-blur-sm">
      <GlassPanel className="w-full max-w-xs p-5">
        <p className="text-sm font-medium text-ink">
          {alreadySaved ? '구조화를 마치지 않고 나갑니다' : '작성 중인 내용이 사라집니다'}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-dim">
          {alreadySaved
            ? '기록 자체는 이미 저장되어 있고, AI 구조화만 아직 안 된 상태입니다. 나중에 기록 상세에서 다시 시도할 수 있어요.'
            : '지금까지 기록한 내용은 저장되지 않았습니다. 첫 화면으로 나갈까요?'}
        </p>
        <div className="mt-5 flex gap-2">
          <OutlineButton type="button" onClick={onCancel} className="flex-1">
            계속 작성
          </OutlineButton>
          <GradientButton type="button" onClick={onConfirm} className="flex-1">
            나가기
          </GradientButton>
        </div>
      </GlassPanel>
    </div>
  );
}

export function RecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const speech = useSpeechInput();
  const mic = useMicAnalyser();
  const nickname = useNickname();

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
  // 일시정지 중 보여주는 textarea. 이어 녹음(▶)을 누른 순간의 커서 위치를 읽어야 해서
  // ref로 붙잡아둔다 — 버튼 클릭이 포커스를 옮겨도 selectionStart는 그대로 남아있다.
  const voiceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // 커서 중간에서 이어 녹음을 시작했을 때 잠깐 띄우는 안내.
  const [cursorResumeHint, setCursorResumeHint] = useState(false);
  useEffect(() => {
    if (!cursorResumeHint) return;
    const id = setTimeout(() => setCursorResumeHint(false), 2000);
    return () => clearTimeout(id);
  }, [cursorResumeHint]);

  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionChoice, setCollectionChoice] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  // 네이티브 <select>는 모바일에서 여는 순간 OS 피커가 화면 기준을 넘어가 버렸다
  // ("컬렉션 토글을 열면 휴대폰 화면 기준 넘어가" 요청) — 직접 그린 드롭다운으로 바꿔
  // 카드 너비 안에서만 아래로 펼쳐지게 한다.
  const [collectionDropdownOpen, setCollectionDropdownOpen] = useState(false);
  const collectionDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!collectionDropdownOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (!collectionDropdownRef.current?.contains(e.target as Node)) {
        setCollectionDropdownOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [collectionDropdownOpen]);

  // "기록 저장하기" 버튼을 nav바 바로 위에 고정한다 — 예전엔 본문 맨 아래에 있어
  // 화면이 길어지면(컬렉션 목록이 늘어나는 등) 스크롤해야 보였다(요청사항). 버튼 바(구조화
  // 재시도 상태에서는 버튼이 두 개)의 실제 높이만큼 본문 아래 여백을 더 줘야 마지막
  // 카드가 바에 가리지 않는다.
  const [saveBarHeight, setSaveBarHeight] = useState(0);
  const saveBarRef = useRef<HTMLDivElement | null>(null);
  // 카드 색상 — 5색 팔레트 중 하나를 저장 시점에 직접 고른다 (design.md 참고). 안 골라도
  // 저장은 되게 첫 번째 색을 기본 선택값으로 둔다.
  const [cardColor, setCardColor] = useState<CardColorKey>(CARD_COLOR_KEYS[0]);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [structureFailed, setStructureFailed] = useState(false);

  useEffect(() => {
    const el = saveBarRef.current;
    if (!el) {
      setSaveBarHeight(0);
      return;
    }
    const observer = new ResizeObserver(([entry]) => setSaveBarHeight(entry.contentRect.height));
    observer.observe(el);
    setSaveBarHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [step, structureFailed]);

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
      const { data: collectionRows } = await supabase
        .from('collections')
        .select('id, name')
        .order('created_at', { ascending: false });
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

  // ▶ 이어 녹음 — textarea에 커서를 올려둔 자리가 있으면 그 위치부터 삽입하며 이어간다.
  // 커서가 맨 끝에 있으면(수정 없이 그냥 이어 녹음하는 보통의 경우) 예전과 동일하게 끝에 붙인다.
  function resumeVoiceRecording() {
    setVoiceDone(false);
    const el = voiceTextareaRef.current;
    const cursor = el ? el.selectionStart : null;
    const insertingMidway = cursor !== null && cursor < speech.transcript.length;
    if (insertingMidway) setCursorResumeHint(true);
    speech.start(cursor ?? undefined);
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
    setCursorResumeHint(false);
    setEditingContent(false);
    setError(null);
    setStatusMessage(null);
    setStructureFailed(false);
    savedEntryIdRef.current = null;
    savedRawTextRef.current = '';
    setCollectionChoice('');
    setNewCollectionName('');
    setCardColor(CARD_COLOR_KEYS[0]);
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
  // 음성으로 돌아갈 때는 곧바로 녹음을 시작하지 않고 정지 상태로 들어간다 — 되돌아온 직후
  // 주변 소리가 그대로 받아쓰기에 섞이는 걸 막고, 사용자가 준비됐을 때 가운데 버튼으로
  // 시작하게 한다.
  function backToSource() {
    setError(null);
    if (source === 'voice') {
      setStep('voice');
      setVoiceDone(false);
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
      // postJson이 로그인 토큰을 실어 보내고, 서버 에러 메시지를 그대로 던져준다
      // ("요청이 너무 잦습니다", "기록이 너무 깁니다" 등). src/lib/apiClient.ts 참고.
      const structured = await postJson<StructureResponse>('/api/structure', { raw_text: rawText });

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
      navigate(ROUTES.entry(entryId));
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
          collection_id: collectionId,
          card_color: cardColor,
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
    navigate(ROUTES.entry(savedEntryIdRef.current));
  }

  if (step === 'choice') {
    return (
      // fullHeight로 바꿨다 — 예전엔 min-h-[100dvh]라 내용이 조금만 길어져도(닉네임 줄 추가 등)
      // 페이지 자체가 스크롤됐다("한 화면에서 스크롤되면 안 된다"는 요청). fullHeight는 높이를
      // 정확히 화면(내비게이션 제외)에 맞추고 넘치는 부분은 스크롤 대신 안에서 잘리게 한다 —
      // 배경 사진의 지구도 이제 이 고정된 화면 안에서만 그려지므로 항상 화면 아래쪽에 보인다
      // (예전엔 배경이 스크롤 가능한 전체 높이만큼 늘어나 지구가 화면 밖 아래로 밀려났었다).
      <CosmicPage variant="record-home" fullHeight>
        <div className="shrink-0">
          <Logo size="lg" />
        </div>

        {/* 로고 이미지 여백을 줄여서 로고 자체의 시각적 아래 공백이 줄었고, 로고도 커졌다 —
            원래 간격(mt-6)을 그대로 두면 로고와 제목 사이가 예전보다 더 벌어져 보여서 좁혔다
            ("여백이 준 만큼 멘트도 위로" 요청). 닉네임을 설정했으면 이름을 윗줄에 따로 두어
            인사처럼 읽히게 한다. */}
        <h1 className="mt-3 shrink-0 text-[28px] font-bold leading-[1.25] tracking-tight text-ink">
          {nickname && <span className="block text-lg font-semibold text-ink-dim">{nickname}님</span>}
          <span
            className="mt-1 block bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
          >
            오늘의 경험을
          </span>
          남겨보세요
        </h1>
        <p className="mt-3 shrink-0 text-[13px] leading-relaxed text-ink-dim">
          오늘의 경험을 기록하면 AI가 생각과 감정을 구조화해
          <br />
          나만의 인사이트로 정리합니다.
        </p>

        <div className="mt-5 flex shrink-0 flex-col gap-2.5">
          <button
            type="button"
            onClick={goToVoice}
            disabled={!speech.isSupported}
            className="text-left disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* "카드도 투명하게, blur 없이" 요청 — ghost 톤 + blur={false}로 거의 순수한
                테두리만 남기고 뒤 배경이 그대로 비치게 한다. */}
            <GlassCard tone="ghost" blur={false} accent="255, 138, 76" className="flex items-center gap-4 px-4 py-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{
                  // 레퍼런스의 아이콘 오브 — 왼쪽 위에서 빛을 받는 주황이 코럴을 지나
                  // 마젠타·자주로 떨어진다. 뒤가 너무 비치면 비활성 버튼처럼 읽힌다는
                  // 피드백으로 알파를 다시 올렸다(RecordOrb와 같은 조정).
                  background:
                    'radial-gradient(circle at 32% 26%, rgba(255,200,148,0.86) 0%, rgba(255,130,100,0.82) 34%, rgba(232,78,146,0.78) 66%, rgba(126,50,136,0.72) 100%)',
                  boxShadow:
                    '0 0 0 1px rgba(255,190,160,0.32), 0 0 26px -4px rgba(255,110,140,0.55)',
                }}
              >
                <MicIcon className="h-6 w-6 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">음성으로 기록</span>
                <span className="mt-1 block text-xs text-ink-dim">
                  {speech.isSupported ? '말하면 자동으로 글로 옮깁니다.' : '이 브라우저에서는 사용할 수 없어요.'}
                </span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted" />
            </GlassCard>
          </button>

          <button type="button" onClick={goToTyping} className="text-left">
            <GlassCard tone="ghost" blur={false} accent="104, 167, 255" className="flex items-center gap-4 px-4 py-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{
                  // 마찬가지로 알파를 낮춰 투명도를 살렸다.
                  background:
                    'radial-gradient(circle at 32% 26%, rgba(186,214,255,0.5) 0%, rgba(112,146,230,0.46) 38%, rgba(74,78,178,0.42) 70%, rgba(44,44,110,0.36) 100%)',
                  boxShadow:
                    '0 0 0 1px rgba(170,200,255,0.24), 0 0 26px -6px rgba(120,150,255,0.45)',
                }}
              >
                <TypingIcon className="h-6 w-6 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">타이핑으로 기록</span>
                <span className="mt-1 block text-xs text-ink-dim">직접 입력합니다.</span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted" />
            </GlassCard>
          </button>
        </div>

        {!speech.isSupported && (
          <p className="mt-3 shrink-0 rounded-2xl border border-hairline p-3 text-xs leading-relaxed text-ink-dim">
            이 브라우저에서는 음성 입력을 쓸 수 없습니다. 타이핑으로 기록해주세요.
          </p>
        )}

        {/* 오브는 배경 사진의 지구 지평선 위에 떠 있어야 하지만, "타이핑으로 기록 카드와
            nav바 사이 한가운데로 올려 달라"는 요청으로 바닥에 붙이는 대신(mt-auto만 쓰면
            남은 공간의 맨 아래로 붙는다) 이 블록이 flex-1로 남은 공간 전체를 차지하고 그
            안에서 justify-center로 세로 가운데에 놓는다. min-h-0가 있어야 부모(h-full
            flex-col)의 남은 공간 안에서 이 블록이 실제로 줄어들 수 있다. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <RecordOrb
            size="clamp(100px, 26vh, 148px)"
            icon={<MicIcon className="h-9 w-9 text-white" />}
            onClick={goToVoice}
            disabled={!speech.isSupported}
            aria-label="음성으로 기록 시작"
          />
        </div>
      </CosmicPage>
    );
  }

  if (step === 'voice') {
    // 높이를 고정하되 100vh가 아니라 100dvh를 쓴다 — iOS Safari의 100vh는 주소창을 무시한
    // "큰 뷰포트" 기준이라, 고정 높이로 잡으면 하단 컨트롤이 툴바 아래에 깔려 손이 닿지 않는다.
    // 그리고 본문은 스크롤되게 두고 컨트롤 줄은 sticky로 바닥에 붙여, 화면이 아무리 낮아도
    // (가로 모드 등) 녹음을 멈출 수단이 사라지지 않게 한다.
    return (
      <div className="relative isolate mx-auto flex h-[calc(100dvh-var(--bottom-nav-total))] max-w-md flex-col overflow-hidden">
        {/* 앱에서 가장 몰입감 있는 화면 — 별이 가장 촘촘하고 성운도 가장 넓다.
            대신 비네트를 가장 강하게 줘서 파형과 대본의 가독성을 지킨다. */}
        <SpaceScene variant="recording" />

        {/* 시각화는 배경 레이어이고 조작 요소는 전부 그 위에 얹는다. */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-2 pt-5">
          <div className="flex items-center justify-between">
            <BackButton onClick={requestReturnToChoice} />
            <CosmicIconButton type="button" onClick={switchVoiceToTyping} aria-label="타이핑으로 전환">
              <KeyboardIcon className="h-4 w-4" />
            </CosmicIconButton>
          </div>

          <p className="mt-5 text-center text-[13px] font-medium tracking-wide text-ink-dim" aria-live="polite">
            {speech.isRecording ? '듣고 있어요' : voiceDone ? '녹음을 마쳤어요' : '잠시 멈췄어요'}
          </p>

          <p
            className="mt-1 bg-clip-text text-center text-[54px] font-extralight leading-none tabular-nums text-transparent"
            style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 50%, #d6b4ff 100%)' }}
            role="timer"
          >
            {formatDuration(elapsedMs)}
          </p>

          {/* 파형은 대본 위에 놓는다 — 흐름 안에 두어야 대본이 항상 그 아래로 간다. */}
          <VoiceWaveform
            analyserRef={mic.analyserRef}
            className="pointer-events-none mt-5 h-32 w-full shrink-0"
          />

          {/* 녹음 중에는 실시간 표시(읽기 전용), 멈추면 그 자리에서 바로 고칠 수 있는 입력이 된다.
              커서를 올린 곳부터 수정 가능하도록 textarea를 그대로 노출한다.
              레퍼런스처럼 뒤의 은하가 은근히 비치는 큰 유리 패널 안에 담는다. */}
          <div className="mt-5 min-h-0 flex-1">
            {speech.isRecording ? (
              <div
                className="h-full min-h-[8rem] overflow-hidden rounded-2xl border border-hairline p-4 backdrop-blur-[2px]"
                style={{ background: 'rgba(10, 20, 40, 0.32)' }}
              >
                <p
                  ref={liveTranscriptRef}
                  className="h-full overflow-y-auto whitespace-pre-wrap text-[17px] leading-relaxed text-ink"
                >
                  {speech.transcript || (
                    <span className="text-ink-muted">말씀하시면 이 자리에 실시간으로 옮겨 적어요.</span>
                  )}
                </p>
              </div>
            ) : (
              <textarea
                ref={voiceTextareaRef}
                value={speech.transcript}
                onChange={(e) => speech.setTranscript(e.target.value)}
                placeholder="여기에 직접 입력하거나, 녹음한 내용을 고칠 수 있어요."
                aria-label="녹음한 내용 (수정 가능). 커서를 올린 위치부터 이어 녹음할 수 있습니다."
                // 이어 녹음(▶)이 이 커서 위치를 그대로 쓰므로, 어디서부터 이어질지 눈에 띄어야 한다.
                className="h-full min-h-[8rem] w-full resize-none rounded-2xl border border-hairline p-4 text-[17px] leading-relaxed text-ink caret-echo-coral backdrop-blur-[2px] placeholder:text-ink-muted focus:border-hairline-active focus:outline-none"
                style={{ background: 'rgba(10, 20, 40, 0.32)' }}
              />
            )}
          </div>

          {/* 커서 중간에서 이어 녹음을 시작했을 때만 잠깐 띄우는 안내. */}
          {cursorResumeHint && (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4">
              <p className="fade-in-up-enter rounded-full border border-hairline bg-[rgba(8,15,33,0.85)] px-3 py-1.5 text-xs font-medium text-ink backdrop-blur-sm">
                커서 위치부터 녹음을 이어갑니다
              </p>
            </div>
          )}

          {speech.error && (
            <GlassCard tone="strong" className="mt-4 p-3">
              {/* 훅이 침묵 같은 정상 상황과 실제 오류(마이크 끊김, 권한 거부 등)를 이미 구분해서
                  올려주므로, 원인을 뭉뚱그리지 않고 그대로 보여준다. */}
              <p className="text-[13px] text-ink">{speech.error}</p>
              <p className="mt-1 text-xs text-ink-dim">다시 시도하거나 타이핑으로 남겨주세요.</p>
              {speech.transcript && (
                <p className="mt-1 text-xs text-ink-dim">여기까지는 저장되어 있습니다 (이어서 녹음 가능)</p>
              )}
            </GlassCard>
          )}
          {mic.error && (
            <p className="mt-2 rounded-xl border border-hairline px-3 py-2 text-xs text-ink-dim backdrop-blur-xl">
              {mic.error} (배경 시각화만 비활성됩니다)
            </p>
          )}

          {/* 본문이 길어져 스크롤되더라도 컨트롤은 항상 바닥에 붙어 있어야 한다.
              왼쪽 삭제 · 가운데 오브(마이크 ↔ 정지, 완료 후엔 저장) · 오른쪽 완료.
              가운데 오브가 녹음 시작/정지를 전담하므로 별도의 ⏸/▶ 버튼은 두지 않는다. */}
          <div className="sticky bottom-0 mt-7 flex items-center justify-between gap-2 pb-1">
            <CosmicIconButton
              type="button"
              onClick={cancelVoice}
              aria-label="삭제"
            >
              <TrashIcon className="h-5 w-5" />
            </CosmicIconButton>

            {voiceDone ? (
              // 완료(체크) 버튼을 누르고 나면 다음 동작이 "글로 옮겨 확인·수정"이라, 가운데
              // 버튼도 체크 대신 쓰기 아이콘으로 바뀌어 그 다음 단계를 몸짓으로 보여준다
              // (요청사항).
              <RecordOrb
                size="clamp(104px, 30vw, 132px)"
                state="processing"
                icon={<TypingIcon className="h-9 w-9 text-white" />}
                onClick={goToDetailsFromVoice}
                disabled={!canSubmitRecord(speech.transcript)}
                aria-label="저장 화면으로"
              />
            ) : speech.isRecording ? (
              <RecordOrb
                size="clamp(104px, 30vw, 132px)"
                state="recording"
                icon={<StopIcon className="h-8 w-8" />}
                onClick={pauseVoiceRecording}
                aria-label="녹음 정지"
              />
            ) : (
              <RecordOrb
                size="clamp(104px, 30vw, 132px)"
                state="paused"
                icon={<MicIcon className="h-9 w-9 text-white" />}
                onClick={resumeVoiceRecording}
                aria-label={canSubmitRecord(speech.transcript) ? '이어 녹음' : '녹음 시작'}
              />
            )}

            <CosmicIconButton
              type="button"
              onClick={finishVoiceRecording}
              disabled={voiceDone || !canSubmitRecord(speech.transcript)}
              aria-label="녹음 완료"
            >
              <CheckIcon className="h-5 w-5" />
            </CosmicIconButton>
          </div>

          {voiceDone && !canSubmitRecord(speech.transcript) && (
            <p className="mt-3 text-center text-xs text-ink-dim">먼저 녹음해주세요</p>
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
      <CosmicPage variant="recording">
        <div className="flex items-start justify-between gap-3">
          <BackButton onClick={requestReturnToChoice} />
          {speech.isSupported && (
            <button
              type="button"
              onClick={switchTypingToVoice}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3.5 py-2 text-xs font-medium text-ink-dim backdrop-blur-xl transition-colors hover:border-hairline-active hover:text-ink"
            >
              <MicIcon className="h-3.5 w-3.5" />
              음성으로
            </button>
          )}
        </div>

        <h1 className="mt-7 text-[26px] font-bold leading-[1.3] tracking-tight text-ink">
          오늘의 경험을
          <br />
          남겨보세요
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
          적어두면 AI가 구조화해 소중한 내 경험으로 정리해드립니다.
        </p>

        <CosmicTextarea
          placeholder="예: 오늘 팀 발표에서 갑자기 자료가 안 열려서 당황했는데, 즉석에서 화면 공유 없이 설명해서 넘겼다. 발표 끝나고 뿌듯했다."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          aria-label="오늘의 경험"
          className="mt-6"
        />

        <GradientButton
          type="button"
          onClick={goToDetailsFromTyping}
          disabled={!canSubmitRecord(text)}
          trailing={<ChevronRightIcon className="h-4 w-4" />}
          className="mt-5"
        >
          다음
        </GradientButton>

        {confirmLeave && (
          <LeaveConfirmDialog
            alreadySaved={savedEntryIdRef.current !== null}
            onCancel={() => setConfirmLeave(false)}
            onConfirm={returnToChoice}
          />
        )}
      </CosmicPage>
    );
  }

  // step === 'details'
  return (
    <CosmicPage variant="recording" bottomExtra={saveBarHeight}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={backToSource}
          disabled={saving}
          className="rounded-full border border-hairline px-3.5 py-2 text-xs font-medium text-ink-dim backdrop-blur-xl transition-colors hover:border-hairline-active hover:text-ink disabled:opacity-50"
        >
          ← {source === 'voice' ? '다시 녹음' : '다시 입력'}
        </button>
        <p className="text-xs font-medium text-ink-dim">2 / 2 · 저장 정보</p>
      </div>

      <GlassCard tone="strong" className="mt-5 p-4">
        <p className="text-xs text-ink-muted">{source === 'voice' ? '녹음한 내용' : '입력한 내용'}</p>
        {editingContent ? (
          <CosmicTextarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            aria-label="기록 내용 수정"
            className="mt-2"
          />
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{content}</p>
        )}
        <button
          type="button"
          onClick={() => setEditingContent((prev) => !prev)}
          className="mt-3 rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-hairline-active hover:text-ink"
        >
          {editingContent ? '수정 완료' : '내용 수정'}
        </button>
      </GlassCard>

      <div className="mt-5">
        <p className="text-[13px] font-semibold text-ink">카드 색상</p>
        <div className="mt-2.5 flex gap-2.5">
          {CARD_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCardColor(key)}
              disabled={saving}
              aria-pressed={cardColor === key}
              aria-label={CARD_COLOR_LABELS[key]}
              title={CARD_COLOR_LABELS[key]}
              // hex를 인라인 style로 준다 — Tailwind 임의값 클래스는 소스 텍스트를 정적으로
              // 스캔해 생성되므로, 여기처럼 배열을 돌며 변수로 색을 넣는 자리에는 애초에
              // 클래스 문자열이 성립하지 않는다 (tagColors.ts 카드 그라디언트 주석 참고).
              style={{ backgroundColor: CARD_COLOR_HEX[key] }}
              className={`h-10 w-10 shrink-0 rounded-xl ring-offset-2 ring-offset-space-black transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmic-violet disabled:opacity-50 ${
                cardColor === key ? 'scale-105 ring-2 ring-white' : 'ring-1 ring-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[13px] font-semibold text-ink">컬렉션</p>
        {collections.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-hairline p-3 text-center text-xs text-ink-muted">
            만든 컬렉션이 없습니다.
          </p>
        ) : null}
        <div ref={collectionDropdownRef} className="relative mt-2">
          <button
            type="button"
            onClick={() => setCollectionDropdownOpen((prev) => !prev)}
            disabled={saving}
            aria-expanded={collectionDropdownOpen}
            className="flex min-h-[3rem] w-full items-center justify-between gap-3 rounded-2xl border border-hairline bg-[rgba(10,20,40,0.38)] px-4 text-[15px] text-ink backdrop-blur-xl transition-colors focus:border-hairline-active focus:outline-none disabled:opacity-50"
          >
            <span className={`truncate ${collectionChoice ? 'text-ink' : 'text-ink-muted'}`}>
              {collectionChoice === NEW_COLLECTION_VALUE
                ? '+ 새 컬렉션 만들기'
                : (collections.find((c) => c.id === collectionChoice)?.name ?? '컬렉션 없음')}
            </span>
            <ChevronRightIcon
              className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 ${
                collectionDropdownOpen ? '-rotate-90' : 'rotate-90'
              }`}
            />
          </button>

          {/* 네이티브 select의 OS 피커 대신 카드 너비 그대로 아래로 펼쳐지는 목록 —
              grid-template-rows를 0fr↔1fr로 트랜지션해 높이를 몰라도 부드럽게
              펼쳐지고 접힌다("세련되게 아래로 펼쳐지는 애니메이션" 요청). */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
              collectionDropdownOpen ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden rounded-2xl border border-hairline bg-[rgba(8,15,33,0.92)] backdrop-blur-xl">
              <div className="max-h-56 overflow-y-auto p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCollectionChoice('');
                    setCollectionDropdownOpen(false);
                  }}
                  className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(130,160,220,0.14)] ${
                    collectionChoice === '' ? 'text-ink' : 'text-ink-dim'
                  }`}
                >
                  컬렉션 없음
                </button>
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCollectionChoice(c.id);
                      setCollectionDropdownOpen(false);
                    }}
                    className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(130,160,220,0.14)] ${
                      collectionChoice === c.id ? 'text-ink' : 'text-ink-dim'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCollectionChoice(NEW_COLLECTION_VALUE);
                    setCollectionDropdownOpen(false);
                  }}
                  className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(130,160,220,0.14)] ${
                    collectionChoice === NEW_COLLECTION_VALUE ? 'text-ink' : 'text-ink-dim'
                  }`}
                >
                  + 새 컬렉션 만들기
                </button>
              </div>
            </div>
          </div>
        </div>
        {collectionChoice === NEW_COLLECTION_VALUE && (
          <input
            type="text"
            placeholder="새 컬렉션 이름"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            disabled={saving}
            className="mt-2 min-h-[3rem] w-full rounded-2xl border border-hairline bg-[rgba(10,20,40,0.38)] px-4 text-[15px] text-ink backdrop-blur-xl placeholder:text-ink-muted focus:border-hairline-active focus:outline-none disabled:opacity-50"
          />
        )}
      </div>

      {statusMessage && <p className="mt-5 text-[13px] text-ink-dim">{statusMessage}</p>}
      {error && (
        <GlassCard tone="strong" className="mt-5 p-3">
          <p className="text-[13px] text-ink">{error}</p>
          {structureFailed && (
            <p className="mt-1 text-xs text-ink-dim">기록 자체는 저장됨 · 구조화만 재시도</p>
          )}
        </GlassCard>
      )}

      {confirmLeave && (
        <LeaveConfirmDialog
          alreadySaved={savedEntryIdRef.current !== null}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={returnToChoice}
        />
      )}

      {/* "기록 저장하기" 버튼을 nav바 바로 위에 고정한다 — 컬렉션 목록이 늘어나는 등
          화면이 길어져도 항상 손 닿는 곳에 있어야 한다는 요청. 배경은 검게 막지 않고
          BottomNav와 같은 알파(0.4)+blur로 맞춰 우주 배경이 nav바까지 이어서 비치게 한다
          ("저장하기 버튼 뒤 검은 배경 없애고 nav바 포함해서 항상 배경이 있어야" 요청). */}
      <div
        className="fixed inset-x-0 bottom-[var(--bottom-nav-total)] z-30 border-t border-hairline backdrop-blur-2xl"
        style={{
          background: 'rgba(8, 15, 33, 0.4)',
          borderTopLeftRadius: '1.25rem',
          borderTopRightRadius: '1.25rem',
          animation: 'echo-sheet-up 280ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      >
        <div ref={saveBarRef} className="mx-auto w-full max-w-md p-3.5">
          {structureFailed ? (
            <div className="flex flex-col gap-2.5">
              <GradientButton type="button" onClick={handleRetryStructuring} disabled={saving}>
                {saving ? '다시 시도 중...' : '다시 시도'}
              </GradientButton>
              <OutlineButton type="button" onClick={handleSkipStructuring}>
                구조화 없이 저장만 하고 나가기
              </OutlineButton>
            </div>
          ) : (
            <GradientButton
              type="button"
              onClick={handleSave}
              disabled={saving || !canSubmitRecord(content)}
              trailing={<ChevronRightIcon className="h-4 w-4" />}
            >
              {saving ? '저장 중...' : '기록 저장하기'}
            </GradientButton>
          )}
        </div>
      </div>
    </CosmicPage>
  );
}
