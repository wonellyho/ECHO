import { useCallback, useRef, useState } from 'react';

const HISTORY_LENGTH = 7;

// getUserMedia + Web Audio API AnalyserNode로 마이크 입력 볼륨을 0~1 범위로 정규화해 제공한다.
// useSpeechInput과는 별도의 마이크 스트림을 연다 (Web Speech API는 내부적으로 자체 스트림을 쓰고
// 페이지 JS에는 노출하지 않으므로, 파형 표시용으로 이 훅이 독립적으로 getUserMedia를 호출한다).
// 최근 볼륨 이력(history)까지 여기서 들고 있어, 화면 쪽(VoiceWaveform)은 순수하게 렌더링만 한다.
export function useMicLevel() {
  const [level, setLevel] = useState(0);
  const [history, setHistory] = useState<number[]>(() => Array(HISTORY_LENGTH).fill(0));
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
    setHistory(Array(HISTORY_LENGTH).fill(0));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i += 1) {
          const centered = (data[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        const next = Math.min(1, rms * 4); // 평범한 말소리에서도 막대가 눈에 띄게 움직이도록 게인 적용
        setLevel(next);
        setHistory((prev) => [...prev.slice(1), next]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      setError(err instanceof Error ? err.message : '마이크 권한을 가져오지 못했습니다.');
    }
  }, []);

  return { level, history, error, start, stop };
}
