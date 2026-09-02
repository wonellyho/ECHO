import { useEffect, useRef, type RefObject } from 'react';
import { smoothPath } from '../lib/smoothPath';

// ambient 배경 위에 겹쳐 얹는 음량 곡선. AmbientVoiceField가 "지금 이 순간의 소리"를 공간으로
// 표현한다면, 이쪽은 최근 몇 초의 흐름을 곡선으로 보여준다 (Figma 메모의 "음량곡선" 요구).
//
// AmbientVoiceField와 같은 원칙을 따른다:
// - 실제 마이크 데이터 기반이며 장식용 고정 애니메이션이 아니다
// - React 상태를 거치지 않고 rAF 루프에서 path의 d 속성만 직접 쓴다
// - 색은 밝은 계열만 써서, 어떤 순간에도 위에 얹힌 어두운 텍스트의 대비를 해치지 않는다

const HISTORY_LENGTH = 48;
// 표본을 고정 간격으로 밀어 넣는다. 매 프레임 밀면 120Hz 화면에서 곡선이 두 배 빨리 흘러가
// 주사율마다 다른 속도로 보인다.
const SAMPLE_INTERVAL_MS = 1000 / 30;
// 평범한 말소리에서도 곡선이 눈에 띄게 움직이도록 하는 게인.
const LEVEL_GAIN = 4;

// 같은 이력을 진폭과 시간 지연만 달리해 3겹으로 겹친다. 지연은 반드시 오래된 쪽으로 clamp해야
// 한다 — 나머지 연산으로 감으면 가장 오래된 표본이 최신 쪽 끝에 붙어 오른쪽 가장자리가 튄다.
const LAYERS = [
  { amplitude: 1, delay: 0, fill: 'rgba(251, 146, 60, 0.20)' },
  { amplitude: 0.7, delay: 2, fill: 'rgba(244, 114, 182, 0.14)' },
  { amplitude: 0.45, delay: 4, fill: 'rgba(253, 186, 116, 0.09)' },
];

const FLAT_PATH = `${smoothPath(new Array(HISTORY_LENGTH).fill(0))} L 100 100 L 0 100 Z`;

export function VoiceWaveform({
  analyserRef,
  className = '',
}: {
  analyserRef: RefObject<AnalyserNode | null>;
  className?: string;
}) {
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const paths = pathRefs.current;
    const history = new Array<number>(HISTORY_LENGTH).fill(0);
    // getByteTimeDomainData의 타입 정의가 ArrayBuffer 기반 Uint8Array를 요구하므로 명시한다.
    let samples: Uint8Array<ArrayBuffer> | null = null;
    let lastSampleAt = 0;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - lastSampleAt < SAMPLE_INTERVAL_MS) return;
      lastSampleAt = now;

      const analyser = analyserRef.current;
      let level = 0;
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
        level = Math.min(1, Math.sqrt(sumSquares / samples.length) * LEVEL_GAIN);
      }

      history.shift();
      history.push(level);

      for (let i = 0; i < LAYERS.length; i += 1) {
        const path = paths[i];
        if (!path) continue;
        const layer = LAYERS[i];
        const values = history.map(
          (_, index) => history[Math.max(0, index - layer.delay)] * layer.amplitude,
        );
        // 곡선 아래를 채우기 위해 우하단 → 좌하단으로 닫는다.
        path.setAttribute('d', `${smoothPath(values)} L 100 100 L 0 100 Z`);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {LAYERS.map((layer, index) => (
        <path
          key={layer.delay}
          ref={(el) => {
            pathRefs.current[index] = el;
          }}
          d={FLAT_PATH}
          fill={layer.fill}
        />
      ))}
    </svg>
  );
}
