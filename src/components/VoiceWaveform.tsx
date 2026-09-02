import { useEffect, useRef, type RefObject } from 'react';
import { smoothPath } from '../lib/smoothPath';
import { wavePeaks } from '../lib/standingWave';
import { envelopeCoefficient, followEnvelope } from '../lib/voiceEnergy';

// Figma `녹화화면` 프레임의 음량 곡선. 얇은 가로선이 화면을 가로지르고, 그 위로 좁은 봉우리가
// 솟으며, 선 아래로는 희미하게 반사된다. 선 아래를 통째로 채우지 않는다 —
// 채우면 화면에 큰 네모 덩어리가 얹힌 것처럼 보인다.
//
// 형태 계산은 standingWave.ts가 맡고(흐르지 않는 정상파), 여기서는 마이크 음량으로 진폭만
// 밀어준다. React 상태를 거치지 않고 rAF 루프에서 path의 d 속성만 직접 쓴다.

// 기준선의 세로 위치 (viewBox 0~100). 봉우리가 위로 솟을 공간을 넉넉히 남긴다.
const LINE_Y = 62;
// 봉우리가 선 위로 솟는 최대 높이.
const PEAK_HEIGHT = 58;
// 선 아래 반사의 높이 비율 — 물에 비친 것처럼 훨씬 낮고 흐리게.
const REFLECTION_RATIO = 0.34;
// 무음일 때도 남겨두는 아주 작은 일렁임 — 화면이 죽어 보이지 않게.
const IDLE_DRIVE = 0.1;
// 평범한 말소리에서도 곡선이 눈에 띄게 움직이도록 하는 게인.
const LEVEL_GAIN = 4;
// 어택은 빠르고 릴리즈는 느리게 (60fps 한 프레임 기준값 — envelopeCoefficient로 환산해서 쓴다).
const ATTACK = 0.16;
const RELEASE = 0.04;

// 같은 정상파를 위상만 달리해 3겹으로 겹친다.
const LAYERS = [
  { amplitude: 1, phase: 0, fill: 'rgba(255, 255, 255, 0.5)' },
  { amplitude: 0.72, phase: 1.9, fill: 'rgba(255, 255, 255, 0.34)' },
  { amplitude: 0.46, phase: 3.7, fill: 'rgba(255, 252, 240, 0.24)' },
];

// 봉우리 높이 배열을 선 기준의 닫힌 path로 바꾼다.
// `direction`이 -1이면 위로 솟고, +1이면 아래로 반사된다.
function peakPath(
  seconds: number,
  drive: number,
  amplitude: number,
  phase: number,
  direction: -1 | 1,
): string {
  const peaks = wavePeaks(seconds, drive, amplitude, phase);
  const reach = direction === -1 ? PEAK_HEIGHT : PEAK_HEIGHT * REFLECTION_RATIO;
  // smoothPath는 0~1 값을 y = 100 - v*100으로 매핑하므로, 원하는 y를 역산해서 넘긴다.
  const values = peaks.map((peak) => (100 - (LINE_Y + direction * peak * reach)) / 100);
  const lineValue = (100 - LINE_Y) / 100;
  const lineY = 100 - lineValue * 100;
  // 곡선의 양 끝을 기준선으로 닫는다 — 화면 바닥까지 내려가 채우지 않는다.
  return `${smoothPath(values)} L 100 ${lineY} L 0 ${lineY} Z`;
}

const FLAT_PATH = peakPath(0, 0, 1, 0, -1);

export function VoiceWaveform({
  analyserRef,
  className = '',
}: {
  analyserRef: RefObject<AnalyserNode | null>;
  className?: string;
}) {
  const upperRefs = useRef<(SVGPathElement | null)[]>([]);
  const lowerRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const upper = upperRefs.current;
    const lower = lowerRefs.current;
    // getByteTimeDomainData의 타입 정의가 ArrayBuffer 기반 Uint8Array를 요구하므로 명시한다.
    let samples: Uint8Array<ArrayBuffer> | null = null;
    let level = 0;
    let raf = 0;
    const startedAt = performance.now();
    let lastNow = startedAt;

    const frame = (now: number) => {
      const seconds = (now - startedAt) / 1000;
      const deltaSeconds = (now - lastNow) / 1000;
      lastNow = now;

      const analyser = analyserRef.current;
      let target = 0;
      if (analyser) {
        if (!samples || samples.length !== analyser.fftSize) {
          samples = new Uint8Array(analyser.fftSize);
        }
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        target = Math.min(1, Math.sqrt(sumSquares / samples.length) * LEVEL_GAIN);
      }
      level = followEnvelope(
        level,
        target,
        envelopeCoefficient(ATTACK, deltaSeconds),
        envelopeCoefficient(RELEASE, deltaSeconds),
      );
      const drive = IDLE_DRIVE + level * (1 - IDLE_DRIVE);

      for (let i = 0; i < LAYERS.length; i += 1) {
        const layer = LAYERS[i];
        upper[i]?.setAttribute('d', peakPath(seconds, drive, layer.amplitude, layer.phase, -1));
        lower[i]?.setAttribute('d', peakPath(seconds, drive, layer.amplitude, layer.phase, 1));
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef]);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} aria-hidden="true">
      {/* 선 아래 반사 — 위쪽 봉우리보다 훨씬 흐리게. */}
      {LAYERS.map((layer, index) => (
        <path
          key={`reflection-${layer.phase}`}
          ref={(el) => {
            lowerRefs.current[index] = el;
          }}
          d={FLAT_PATH}
          fill={layer.fill}
          opacity={0.4}
        />
      ))}
      {LAYERS.map((layer, index) => (
        <path
          key={`peak-${layer.phase}`}
          ref={(el) => {
            upperRefs.current[index] = el;
          }}
          d={FLAT_PATH}
          fill={layer.fill}
        />
      ))}
      {/* 항상 깔려 있는 얇은 가로선. preserveAspectRatio="none"이라 세로로 늘어나므로
          vector-effect로 두께를 고정한다. */}
      <line
        x1="0"
        y1={LINE_Y}
        x2="100"
        y2={LINE_Y}
        stroke="rgba(255, 255, 255, 0.75)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
