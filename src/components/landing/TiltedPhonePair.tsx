import { PhoneMockup } from './PhoneMockup';
import { EntriesCollectionScreen, VoiceRecordScreen } from './AppScreens';

// 히어로의 주인공 — 서로를 향해 비스듬히 기울어진 아이폰 두 대.
//
// 왼쪽은 말하고 있는 순간(녹음 화면), 오른쪽은 그렇게 쌓인 결과(프로젝트별 경험 카드 뭉치)다.
// 두 대를 나란히 세우면 "기록한다 → 쌓인다"는 서비스의 한 문장이 설명 없이 읽힌다.
//
// 두 대는 **겹치지 않는다.** 겹쳐 놓으면 앞 기기가 뒤 기기의 화면을 가려서, 정작 보여주려던
// 앱 화면이 반쪽만 보인다. 대신 사이를 띄우고 오른쪽을 더 크고 앞으로(아래로) 배치해
// 원근만으로 앞뒤를 만든다.
//
// 3D는 WebGL이 아니라 CSS perspective + rotateY/rotateZ다. 기울인 건 껍데기뿐이고 화면 안은
// 여전히 실제 앱 컴포넌트라 각도를 줘도 글자가 뭉개지지 않는다. rotate는 레이아웃을 바꾸지
// 않으므로 PhoneMockup이 ResizeObserver로 재는 화면 폭(=축소 비율)에도 영향이 없다.

/** 왼쪽 — 뒤쪽. 오른쪽을 향해 기울고, 조금 위로 물러나 있다. */
const LEFT_TRANSFORM = 'rotateY(17deg) rotateZ(-6deg) translateY(-3%)';
/** 오른쪽 — 앞쪽. 왼쪽을 향해 기울고, 조금 아래로 나와 있다. */
const RIGHT_TRANSFORM = 'rotateY(-13deg) rotateZ(5deg) translateY(3%)';

export function TiltedPhonePair({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[20rem] sm:max-w-[27rem] lg:max-w-[32rem] ${className}`}
      // perspective가 있어야 rotateY가 "돌아간 판"이 아니라 "멀어지는 면"으로 보인다.
      style={{ perspective: '1600px' }}
    >
      {/* 두 대 아래에 깔리는 공통 glow — 각자 그림자를 가지면 두 덩어리로 따로 놀아서,
          바닥 빛 하나를 공유해 한 장면으로 묶는다. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[-6%] h-[22%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(241,74,180,0.24) 0%, rgba(255,138,76,0.12) 40%, rgba(2,4,13,0) 72%)',
          filter: 'blur(26px)',
        }}
      />

      {/* gap-[4%]가 두 기기 사이의 실제 간격이다. 합이 100%를 넘지 않아야 작은 화면에서
          기기가 잘리지 않는다 — 44 + 4 + 50 = 98%. */}
      <div
        className="relative flex items-center justify-center gap-[4%]"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* 왼쪽 — 녹음 중 */}
        <div
          className="relative z-10 w-[44%] shrink-0"
          style={{ transform: LEFT_TRANSFORM, transformStyle: 'preserve-3d' }}
        >
          <PhoneMockup label="ECHO 음성 기록 화면">
            <VoiceRecordScreen />
          </PhoneMockup>
          {/* 뒤에 있는 기기라는 걸 밝기로도 알려준다 — 크기만 줄이면 그냥 작은 폰으로 보인다. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'rgba(2,4,13,0.24)', borderRadius: '14% / 6.5%' }}
          />
        </div>

        {/* 오른쪽 — 프로젝트별로 쌓인 경험 카드 뭉치. 더 크고, 앞에 있다. */}
        <div
          className="relative z-20 w-[50%] shrink-0"
          style={{ transform: RIGHT_TRANSFORM, transformStyle: 'preserve-3d' }}
        >
          <PhoneMockup label="ECHO 내 경험 화면 — 프로젝트별 경험 카드 뭉치">
            <EntriesCollectionScreen />
          </PhoneMockup>
        </div>
      </div>
    </div>
  );
}
