import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeAtCursor } from './transcriptMerge';

// 브라우저 내장 Web Speech API 래퍼 (무료, 정확도는 낮을 수 있음).
// 지원 브라우저: Chrome 계열. 미지원 시 isSupported=false로 텍스트 입력만 안내.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// 침묵이 이어지거나 사용자가 멈출 때 Chrome이 늘 던지는 값이라 오류로 취급하지 않는다.
// 이 둘은 onend에서 이어서 재시작하는 정상 경로로 흘려보낸다.
const BENIGN_ERRORS = new Set(['no-speech', 'aborted']);

// Web Speech API의 오류 코드를 사용자에게 보여줄 문구로 옮긴다. 원인마다 취할 행동이 다르므로
// ("권한을 허용하세요" vs "마이크를 확인하세요") 하나로 뭉뚱그리지 않는다.
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.',
  'service-not-allowed': '브라우저가 음성 인식을 차단했습니다. 설정을 확인해주세요.',
  'audio-capture': '마이크를 찾지 못했습니다. 연결 상태를 확인해주세요.',
  network: '네트워크 문제로 음성 인식에 실패했습니다.',
};

function messageForError(code: string): string {
  return ERROR_MESSAGES[code] ?? '음성 인식 중 오류가 발생했습니다.';
}

// 시작하자마자 끝나는 세션이 이만큼 연속되면 자동 재시작을 포기한다 — 마이크가 사라진 경우
// (블루투스 헤드셋 분리, 다른 앱이 독점, OS 음소거) onend → start → onend가 이벤트 루프
// 속도로 무한 반복될 수 있기 때문.
const RAPID_RESTART_MS = 1000;
const MAX_RAPID_RESTARTS = 3;

export function useSpeechInput() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');
  // 사용자가 "녹음 중이길 원하는" 상태인지. 브라우저가 임의로 끊은 세션과 사용자가 멈춘 것을
  // 구분하는 데 쓴다 (아래 onend 참고).
  const wantsRecordingRef = useRef(false);
  const rapidRestartsRef = useRef(0);
  // startSession이 onend 안에서 자기 자신을 다시 부르기 위한 우회로.
  // 아직 연결되지 않았을 때는 null이며, 그 경우 onend는 재시작을 시도하지 않고 정지 처리로
  // 떨어진다 — no-op을 부르면 녹음 중이라고 표시된 채 아무 세션도 없는 상태에 갇힌다.
  const startSessionRef = useRef<(() => void) | null>(null);
  // 커서 위치부터 이어 녹음할 때, 커서 뒤에 남아있던 텍스트. start()가 호출될 때 한 번
  // 정해지고, 침묵으로 인한 자동 재시작(onend → restart) 동안에는 그대로 유지되어야
  // 새 세션마다 다시 맨 끝에 붙는 게 아니라 계속 같은 자리 앞에 삽입된다. 빈 문자열이면
  // 예전처럼 그냥 끝에 이어붙인다.
  const suffixRef = useRef('');

  const isSupported = getRecognitionCtor() !== null;

  // transcriptRef를 항상 동기적으로 맞춰둔다. effect로 미루면 onresult와 onend가 같은 틱에
  // 몰릴 때 ref가 한 렌더 뒤처져, 재시작 직전의 마지막 말이 조용히 사라진다.
  const applyTranscript = useCallback((value: string) => {
    transcriptRef.current = value;
    setTranscript(value);
  }, []);

  const startSession = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트로 입력해주세요.');
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    // 이 세션이 시작될 때까지 쌓인 텍스트. 공유 ref가 아니라 세션마다의 클로저 변수여야 한다 —
    // 공유 ref를 읽으면 다음 세션이 기준값을 바꾼 뒤 이 세션의 늦은 이벤트가 그걸 읽어
    // 앞부분을 중복해서 덧붙인다.
    // 커서 삽입 모드(suffix가 있음)일 때는 전체 텍스트의 맨 끝이 아니라 "지금까지 인식된
    // 커서 앞부분"이 기준이어야 한다 — 끝에 붙은 suffix 길이만큼만 잘라내면 된다. suffix
    // 자체는 매 결과마다 다시 덧붙기만 할 뿐 바뀌지 않는다는 불변식을 이용한다.
    const suffix = suffixRef.current;
    const fullBefore = transcriptRef.current;
    const sessionBase = suffix ? fullBefore.slice(0, Math.max(0, fullBefore.length - suffix.length)) : fullBefore;
    const startedAt = Date.now();

    // 이미 교체된 세션의 지연 이벤트는 전부 무시한다 (⏸ → ▶ 빠른 연타 시 발생).
    const isCurrent = () => recognitionRef.current === recognition;

    recognition.onresult = (event: any) => {
      if (!isCurrent()) return;
      let combined = '';
      for (let i = 0; i < event.results.length; i += 1) {
        combined += event.results[i][0].transcript;
      }
      applyTranscript(mergeAtCursor(sessionBase, combined, suffix));
    };

    recognition.onerror = (event: any) => {
      if (!isCurrent()) return;
      const code: string = event?.error ?? '';
      if (BENIGN_ERRORS.has(code)) return;
      wantsRecordingRef.current = false;
      setError(messageForError(code));
      // 명세상 onerror 뒤에는 항상 onend가 따라와 정리되지만, 그것에 기대지 않고 여기서도
      // 확실히 끊는다 — 안 그러면 죽은 객체가 ref에 남아 다음 ▶가 조용히 실패할 수 있다.
      recognitionRef.current = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.stop();
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (!isCurrent()) return;
      // Chrome은 continuous여도 침묵이 이어지면 세션을 스스로 종료한다. 사용자가 멈춘 게
      // 아니라면 새 세션으로 이어 붙여, 사용자가 모르는 사이 녹음이 끊기는 일을 막는다.
      if (wantsRecordingRef.current) {
        const wasRapid = Date.now() - startedAt < RAPID_RESTART_MS;
        rapidRestartsRef.current = wasRapid ? rapidRestartsRef.current + 1 : 0;
        const restart = startSessionRef.current;
        if (restart && rapidRestartsRef.current < MAX_RAPID_RESTARTS) {
          recognitionRef.current = null;
          restart();
          return;
        }
        if (rapidRestartsRef.current >= MAX_RAPID_RESTARTS) {
          setError('마이크 입력이 계속 끊깁니다. 마이크를 확인하고 다시 시도해주세요.');
        }
      }
      wantsRecordingRef.current = false;
      recognitionRef.current = null;
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // 이전 세션이 아직 완전히 정리되지 않은 상태에서의 start() 거부.
      wantsRecordingRef.current = false;
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }
    setIsRecording(true);
  }, [applyTranscript]);

  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  // insertAt을 주면 그 위치(문자 인덱스)부터 이어 녹음한다 — 커서 뒤에 있던 텍스트를
  // suffix로 떼어뒀다가, 새로 인식되는 말 뒤에 다시 붙인다. 생략하거나 끝 위치를 주면
  // 예전처럼 그냥 끝에 이어붙인다.
  const start = useCallback(
    (insertAt?: number) => {
      setError(null);
      wantsRecordingRef.current = true;
      rapidRestartsRef.current = 0;
      suffixRef.current =
        typeof insertAt === 'number'
          ? transcriptRef.current.slice(Math.max(0, Math.min(insertAt, transcriptRef.current.length)))
          : '';
      startSession();
    },
    [startSession],
  );

  const stop = useCallback(() => {
    wantsRecordingRef.current = false;
    rapidRestartsRef.current = 0;
    const recognition = recognitionRef.current;
    // 먼저 참조를 끊어야 이후 도착하는 이벤트가 isCurrent() 검사에서 전부 걸러진다.
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    }
    setIsRecording(false);
  }, []);

  // 화면을 떠날 때 반드시 멈춘다 — 이게 없으면 자동 재시작 루프가 언마운트 후에도 계속
  // 돌면서 마이크를 붙잡고 있게 된다.
  useEffect(() => stop, [stop]);

  return { isSupported, isRecording, transcript, error, start, stop, setTranscript: applyTranscript };
}
