import { useEffect, useRef, type RefObject } from 'react';
import { smoothPath } from '../lib/smoothPath';
import { wavePeaks } from '../lib/standingWave';
import { bandEnergies, envelopeCoefficient, followEnvelope, type BandEnergies } from '../lib/voiceEnergy';

// Figma `녹화화면` 프레임의 음량 곡선. 얇은 가로선이 화면을 가로지르고, 그 위로 좁은 봉우리가
// 솟으며, 선 아래로는 희미하게 반사된다. 선 아래를 통째로 채우지 않는다 —
// 채우면 화면에 큰 네모 덩어리가 얹힌 것처럼 보인다.
//
// 형태 계산은 standingWave.ts가 맡고(흐르지 않는 정상파), 여기서는 마이크 스펙트럼으로 진폭만
// 밀어준다. 세 겹(LAYERS)은 전체 음량 하나가 아니라 voiceEnergy.ts의 저/중/고 대역별 에너지로
// 각각 따로 움직인다(voiceEnergy.ts의 대역 정의) — 그래서 목소리 톤에 따라 세 겹이
// 서로 다르게 반응한다. React 상태를 거치지 않고 rAF 루프에서 path의 d 속성만 직접 쓴다.

// 기준선의 세로 위치 (viewBox 0~100). 봉우리가 위로 솟을 공간을 넉넉히 남긴다.
const LINE_Y = 62;
// 봉우리가 선 위로 솟는 최대 높이. LINE_Y(62)가 주는 headroom 안에서 최대한 키웠다
// ("파동이 더 크게, 지금의 3배까지 움직이게" 요청 — 나머지는 BAND_GAIN이 담당한다).
const PEAK_HEIGHT = 78;
// 선 아래 반사의 높이 비율 — 물에 비친 것처럼 훨씬 낮고 흐리게.
const REFLECTION_RATIO = 0.34;
// 무음일 때도 남겨두는 아주 작은 일렁임 — 화면이 죽어 보이지 않게.
const IDLE_DRIVE = 0.12;
// bandEnergies()가 돌려주는 0~1 값에 곱해 평범한 말소리에서도 곡선이 크게 요동치게 만드는 게인.
// 예전(1.5)에는 보통 크기로 말해도 최대치 근처까지 잘 안 갔다 — 3배 가까이 올려서 같은
// 목소리 크기에도 훨씬 크게 움직이게 했다(1.0에서 clamp되므로 조용할 때는 그대로 작다).
const BAND_GAIN = 4.2;
// 어택은 빠르고 릴리즈는 느리게 (60fps 한 프레임 기준값 — envelopeCoefficient로 환산해서 쓴다).
const ATTACK = 0.22;
const RELEASE = 0.06;

// 이전엔 세 겹 모두 같은 전체 음량(RMS) 하나로 움직여, 위상만 다를 뿐 사실상 한 덩어리처럼
// 보였다. 이제 각 겹을 저/중/고 대역에 따로
// 물려, 대역별로 실제로 다르게 반응한다 — 예를 들어 낮은 목소리는 안쪽 겹만, 치찰음 섞인
// 말은 바깥 겹까지 크게 움직인다.
// 색은 안쪽(작고 밝은 코어) → 바깥(넓고 옅은 코럴·바이올렛) 순으로 겹친다. 이 겹침 자체가
// glow 역할을 한다 — blur 필터를 쓰면 파형이 매 프레임 바뀌므로 필터가 매 프레임 다시
// 계산되어 모바일에서 바로 체감된다. 반투명 레이어를 포개는 쪽이 사실상 공짜다.
const LAYERS: { band: keyof BandEnergies; amplitude: number; phase: number; fill: string }[] = [
  { band: 'low', amplitude: 1, phase: 0, fill: 'rgba(255, 226, 214, 0.5)' },
  { band: 'mid', amplitude: 0.72, phase: 1.9, fill: 'rgba(255, 122, 158, 0.34)' },
  { band: 'high', amplitude: 0.46, phase: 3.7, fill: 'rgba(186, 140, 255, 0.28)' },
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
    // getByteFrequencyData의 타입 정의가 ArrayBuffer 기반 Uint8Array를 요구하므로 명시한다.
    let spectrum: Uint8Array<ArrayBuffer> | null = null;
    const levels: BandEnergies = { low: 0, mid: 0, high: 0 };
    let raf = 0;
    const startedAt = performance.now();
    let lastNow = startedAt;

    const frame = (now: number) => {
      const seconds = (now - startedAt) / 1000;
      const deltaSeconds = (now - lastNow) / 1000;
      lastNow = now;

      const analyser = analyserRef.current;
      let target: BandEnergies = { low: 0, mid: 0, high: 0 };
      if (analyser) {
        if (!spectrum || spectrum.length !== analyser.frequencyBinCount) {
          spectrum = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(spectrum);
        target = bandEnergies(spectrum);
      }
      const attack = envelopeCoefficient(ATTACK, deltaSeconds);
      const release = envelopeCoefficient(RELEASE, deltaSeconds);
      levels.low = followEnvelope(levels.low, target.low, attack, release);
      levels.mid = followEnvelope(levels.mid, target.mid, attack, release);
      levels.high = followEnvelope(levels.high, target.high, attack, release);

      for (let i = 0; i < LAYERS.length; i += 1) {
        const layer = LAYERS[i];
        const energy = Math.min(1, levels[layer.band] * BAND_GAIN);
        const drive = IDLE_DRIVE + energy * (1 - IDLE_DRIVE);
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
        stroke="rgba(255, 232, 224, 0.8)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
