import { useCallback, useEffect, useRef, useState } from 'react';

// 곡선 파형(VoiceWaveform)이 각져 보이지 않을 만큼의 표본 수. 막대 그래프 시절엔 7이면 충분했지만,
// 가로를 가로지르는 곡선을 그리려면 점이 더 촘촘해야 한다.
const HISTORY_LENGTH = 48;

// getUserMedia + Web Audio API AnalyserNode로 마이크 입력 볼륨을 0~1 범위로 정규화해 제공한다.
// useSpeechInput과는 별도의 마이크 스트림을 연다 (Web Speech API는 내부적으로 자체 스트림을 쓰고
// 페이지 JS에는 노출하지 않으므로, 파형 표시용으로 이 훅이 독립적으로 getUserMedia를 호출한다).
// 최근 볼륨 이력(history)까지 여기서 들고 있어, 화면 쪽(VoiceWaveform)은 순수하게 렌더링만 한다.
export function useMicLevel() {
  const [history, setHistory] = useState<number[]>(() => Array(HISTORY_LENGTH).fill(0));
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  // start() 호출마다 증가하는 세대 번호. stop() 없이 start()가 두 번 불리면 이전 스트림·
  // AudioContext·rAF 루프가 참조를 잃은 채 영원히 돌아 마이크가 켜진 상태로 남는다.
  // 단순 boolean으로는 "내 차례인지"와 "다른 start()가 진행 중인지"를 구분할 수 없어
  // (getUserMedia 대기 중 stop→start가 끼면 먼저 시작한 쪽이 남의 플래그를 보고 통과한다)
  // 세대 번호로 비교한다.
  const genRef = useRef(0);

  const stop = useCallback(() => {
    genRef.current += 1;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setHistory(Array(HISTORY_LENGTH).fill(0));
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    const gen = ++genRef.current;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 권한 대기 중에 stop()이나 다른 start()가 끼어들었다면 방금 받은 스트림을 닫고 빠져나간다.
      if (gen !== genRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
        const next = Math.min(1, rms * 4); // 평범한 말소리에서도 파형이 눈에 띄게 움직이도록 게인 적용
        setHistory((prev) => [...prev.slice(1), next]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      // 내 세대가 이미 밀렸다면 남의 상태를 건드리지 않는다.
      if (gen !== genRef.current) return;
      setError(err instanceof Error ? err.message : '마이크 권한을 가져오지 못했습니다.');
    }
  }, []);

  // 화면을 떠날 때 마이크가 켜진 채 남지 않도록 훅이 직접 정리한다 (useSpeechInput과 동일한 계약).
  useEffect(() => stop, [stop]);

  return { history, error, start, stop };
}
