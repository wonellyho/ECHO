import { useEffect, useRef, useState, type ReactNode } from 'react';

// iPhone 15 Pro 목업 프레임.
//
// 설계 의도가 두 가지 있다.
//
// 1) 3D WebGL로 렌더하지 않는다. 랜딩 첫 화면에 three.js 씬을 띄우면 모바일에서 LCP가 그대로
//    밀린다. 대신 CSS로 티타늄 레일 + 다이나믹 아일랜드까지 그린다.
//
// 2) 화면 안에는 이미지가 아니라 **실제 앱 컴포넌트**가 들어간다(AppScreens.tsx). 스크린샷
//    PNG를 끼우면 기기 해상도마다 흐려지고, 앱 디자인을 고칠 때마다 다시 찍어야 한다.
//    실제 컴포넌트는 항상 벡터처럼 선명하고 앱과 자동으로 같이 바뀐다.
//
//    그래도 실사 목업 PNG/WebP로 갈아끼울 수 있어야 하므로 두 개의 교체 슬롯을 둔다.
//      - screenSrc : 화면 안쪽만 이미지로 (앱 스크린샷)
//      - frameSrc  : 기기 프레임 전체를 이미지로 (Figma 3D 목업 렌더 등)
//    자세한 규격은 public/assets/landing/README.md 참고.

/** iPhone 15 Pro 논리 해상도. 앱 화면 컴포넌트는 항상 이 크기로 그린 뒤 축소한다. */
export const SCREEN_W = 393;
export const SCREEN_H = 852;

/** 베젤(티타늄 레일) 두께 — 논리 px. */
const BEZEL = 11;
const DEVICE_W = SCREEN_W + BEZEL * 2;
const DEVICE_H = SCREEN_H + BEZEL * 2;

/** 실제 기기의 코너는 가로/세로 반지름이 다른 타원이다. %로 주면 각 축에 맞게 휜다. */
const DEVICE_RADIUS = `${(59 / DEVICE_W) * 100}% / ${(59 / DEVICE_H) * 100}%`;
const SCREEN_RADIUS = `${(52 / SCREEN_W) * 100}% / ${(52 / SCREEN_H) * 100}%`;

export interface PhoneMockupProps {
  /** 화면 안에 그릴 실제 앱 화면. SCREEN_W × SCREEN_H 기준으로 작성하면 알아서 축소된다. */
  children?: ReactNode;
  /** 화면 안을 이미지로 대체할 때 (앱 스크린샷 교체 슬롯). */
  screenSrc?: string;
  /** 기기 프레임 전체를 이미지로 대체할 때 (실사 3D 목업 교체 슬롯). */
  frameSrc?: string;
  /**
   * frameSrc를 쓸 때 화면 영역이 이미지 안에서 차지하는 비율(%).
   * 목업 PNG마다 다르므로 넣는 쪽에서 지정한다.
   */
  frameScreenInset?: { top: number; right: number; bottom: number; left: number };
  /** 스크린리더용 설명. 장식이면 비워 둔다. */
  label?: string;
  className?: string;
}

export function PhoneMockup({
  children,
  screenSrc,
  frameSrc,
  frameScreenInset = { top: 1.6, right: 2.7, bottom: 1.6, left: 2.7 },
  label,
  className = '',
}: PhoneMockupProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  // 화면 안의 앱 컴포넌트는 논리 393px 고정폭으로 그리고, 실제로 그려진 폭에 맞춰 통째로
  // 축소한다. 이렇게 해야 폰이 커지든 작아지든 화면 안의 레이아웃 비율이 앱과 정확히 같다
  // (컨테이너 폭에 맞춰 반응형으로 다시 짜면 "앱과 다르게 생긴 화면"이 된다).
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SCREEN_W);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const screenContent = (
    <div
      ref={screenRef}
      className="absolute overflow-hidden bg-space-black"
      style={
        frameSrc
          ? {
              top: `${frameScreenInset.top}%`,
              right: `${frameScreenInset.right}%`,
              bottom: `${frameScreenInset.bottom}%`,
              left: `${frameScreenInset.left}%`,
              borderRadius: SCREEN_RADIUS,
            }
          : {
              top: `${(BEZEL / DEVICE_H) * 100}%`,
              right: `${(BEZEL / DEVICE_W) * 100}%`,
              bottom: `${(BEZEL / DEVICE_H) * 100}%`,
              left: `${(BEZEL / DEVICE_W) * 100}%`,
              borderRadius: SCREEN_RADIUS,
            }
      }
    >
      {screenSrc ? (
        <img
          src={screenSrc}
          alt={label ?? ''}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full select-none object-cover"
        />
      ) : (
        // scale이 0인 첫 프레임에는 그리지 않는다 — 393px 원본이 잠깐 튀어나왔다가
        // 줄어드는 깜빡임을 막는다.
        scale > 0 && (
          <div
            style={{
              width: SCREEN_W,
              height: SCREEN_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {children}
          </div>
        )
      )}
    </div>
  );

  return (
    <div
      className={`relative w-full select-none ${className}`}
      style={{ aspectRatio: `${DEVICE_W} / ${DEVICE_H}` }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {/* 기기 아래 은은한 접지 glow — 우주에 떠 있되 완전히 납작해 보이지는 않게. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[6%] bottom-[-4%] h-[14%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(241,74,180,0.22) 0%, rgba(255,138,76,0.10) 42%, rgba(2,4,13,0) 72%)',
          filter: 'blur(18px)',
        }}
      />

      {frameSrc ? (
        <>
          {screenContent}
          <img
            src={frameSrc}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          />
        </>
      ) : (
        <>
          {/* 티타늄 레일. 단색 테두리로 두면 플라스틱처럼 보여서, 왼쪽 위에서 빛을 받는
              그라디언트 + 안쪽 하이라이트 선으로 금속 느낌을 만든다. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              borderRadius: DEVICE_RADIUS,
              background:
                'linear-gradient(145deg, #8d93a1 0%, #4a4f5c 18%, #2b2f3a 42%, #14171f 62%, #3b404c 84%, #767c8a 100%)',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,0.10), 0 28px 60px -24px rgba(0,0,0,0.9), 0 0 70px -30px rgba(167,110,255,0.45)',
            }}
          />
          {/* 레일 안쪽의 검은 테두리 — 실제 기기의 화면 주변 검은 띠. */}
          <div
            aria-hidden
            className="absolute"
            style={{
              inset: `${(4 / DEVICE_H) * 100}% ${(4 / DEVICE_W) * 100}%`,
              borderRadius: DEVICE_RADIUS,
              background: '#05070e',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          />

          {screenContent}

          {/* 다이나믹 아일랜드 */}
          <div
            aria-hidden
            className="absolute rounded-full bg-black"
            style={{
              top: `${(23 / DEVICE_H) * 100}%`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${(124 / DEVICE_W) * 100}%`,
              height: `${(35 / DEVICE_H) * 100}%`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          />

          {/* 측면 버튼 — 왼쪽 음량/액션, 오른쪽 전원. 아주 얇게만. */}
          {[
            { side: 'left', top: 15.5, height: 3.1 },
            { side: 'left', top: 21.5, height: 5.2 },
            { side: 'left', top: 28.5, height: 5.2 },
            { side: 'right', top: 24, height: 8.4 },
          ].map((button, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute"
              style={{
                top: `${button.top}%`,
                height: `${button.height}%`,
                width: '0.7%',
                [button.side]: '-0.6%',
                borderRadius: '2px',
                background: 'linear-gradient(to right, #6f7583, #3a3f4b)',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
