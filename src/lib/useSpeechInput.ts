import { useCallback, useEffect, useRef, useState } from 'react';

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

export function useSpeechInput() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // 정지/에러 이후 재시작해도 기존 받아쓰기 내용을 지우지 않고 이어붙이기 위한 기준값.
  const baseTranscriptRef = useRef('');
  const transcriptRef = useRef('');

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const isSupported = getRecognitionCtor() !== null;

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트로 입력해주세요.');
      return;
    }
    setError(null);
    baseTranscriptRef.current = transcriptRef.current;

    const recognition = new Ctor();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i += 1) {
        combined += event.results[i][0].transcript;
      }
      const base = baseTranscriptRef.current;
      setTranscript(base && combined ? `${base} ${combined}` : base + combined);
    };
    recognition.onerror = (event: any) => {
      setError(event.error ?? '음성 인식 중 오류가 발생했습니다.');
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  return { isSupported, isRecording, transcript, error, start, stop, setTranscript };
}
