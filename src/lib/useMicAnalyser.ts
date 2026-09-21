import { useCallback, useEffect, useRef, useState } from 'react';

// getUserMedia + Web Audio API AnalyserNode로 마이크 입력을 열고, AnalyserNode 자체를 ref로 넘긴다.
// useSpeechInput과는 별도의 마이크 스트림을 연다 (Web Speech API는 내부적으로 자체 스트림을 쓰고
// 페이지 JS에는 노출하지 않으므로, 시각화용으로 이 훅이 독립적으로 getUserMedia를 호출한다).
//
// 이전 버전(useMicLevel)은 매 애니메이션 프레임 setState를 호출해 화면 전체를 초당 60번
// 리렌더했다. 여기서는 상태를 전혀 들지 않고 AnalyserNode만 넘겨, 그리는 쪽이 자기 rAF 루프에서
// 직접 읽어 DOM 스타일만 건드리게 한다 (React 렌더 경로를 아예 타지 않는다).
export function useMicAnalyser() {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // start() 호출마다 증가하는 세대 번호. 단순 boolean으로는 "내 차례인지"와 "다른 start()가
  // 진행 중인지"를 구분할 수 없어(getUserMedia 대기 중 stop→start가 끼면 먼저 시작한 쪽이 남의
  // 플래그를 보고 통과한다) 세대 번호로 비교한다.
  const genRef = useRef(0);

  const stop = useCallback(() => {
    genRef.current += 1;
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    const gen = ++genRef.current;
    setError(null);
    try {
      // 자동 게인 보정은 침묵 구간의 잡음을 끌어올려 "말 안 할 땐 잠잠하다"는 전제를 깬다.
      // 이 스트림은 통화용이 아니라 측정용이므로 끈다.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: true, echoCancellation: true },
      });
      // 권한 대기 중에 stop()이나 다른 start()가 끼어들었다면 방금 받은 스트림을 닫고 빠져나간다.
      if (gen !== genRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      // 512개 bin으로 대역을 충분히 갈라 보면서도 프레임당 비용이 크지 않은 크기.
      analyser.fftSize = 1024;
      // AnalyserNode 자체의 시간 평활. 뒤에 엔벨로프 팔로워를 한 번 더 씌우지만, 여기서 미리
      // 눌러두면 원시 스펙트럼의 프레임 단위 깜빡임이 줄어든다.
      // AnalyserNode 자체 평활은 "프레임당" 적용이라 주사율에 따라 시간 상수가 달라진다.
      // 평활은 주사율에 무관하게 환산되는 followEnvelope 쪽에서 전담하고, 여기서는 원시
      // 스펙트럼의 거친 부분만 살짝 눌러둔다 (두 곳에서 세게 걸면 튜닝 지점이 둘로 갈린다).
      analyser.smoothingTimeConstant = 0.3;
      // 기본값(-100 ~ -30dB)은 범위가 너무 넓어, 조용한 방의 암소음(-70dB 근처)조차 0~255
      // 눈금의 40% 언저리로 올라온다. 사람 목소리 구간에 맞춰 좁혀야 무음과 발화가 갈린다.
      analyser.minDecibels = -75;
      analyser.maxDecibels = -20;
      audioCtx.createMediaStreamSource(stream).connect(analyser);

      // Safari는 사용자 제스처 밖에서 만든 AudioContext를 suspended로 두는 경우가 있다.
      // 이 상태로는 getByteFrequencyData가 계속 0만 돌려줘 시각화가 조용히 죽는다.
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
        if (gen !== genRef.current) return;
      }

      analyserRef.current = analyser;
    } catch (err) {
      // 내 세대가 이미 밀렸다면 남의 상태를 건드리지 않는다.
      if (gen !== genRef.current) return;
      // getUserMedia는 성공했는데 그 뒤(AudioContext 생성 등)에서 실패한 경우, 스트림이 열린 채
      // 남아 마이크 표시등이 계속 켜져 있게 된다. 게다가 start()는 streamRef가 차 있으면
      // 곧바로 빠져나오므로 이후 재시도도 전부 무시돼 시각화가 영영 살아나지 않는다.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setError(err instanceof Error ? err.message : '마이크 권한을 가져오지 못했습니다.');
    }
  }, []);

  // 화면을 떠날 때 마이크가 켜진 채 남지 않도록 훅이 직접 정리한다 (useSpeechInput과 동일한 계약).
  useEffect(() => stop, [stop]);

  return { analyserRef, error, start, stop };
}
