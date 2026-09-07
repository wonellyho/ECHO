// 화면별 우주 배경. 사용자가 직접 준 이미지를 그대로 깐다.
//
// 이전에는 캔버스로 은하수·성운·행성을 직접 그렸지만, 사용자가 원하는 장면을 그림으로
// 확정해 주었으므로 그걸 그대로 쓰는 쪽이 결과도 낫고 코드도 단순하다.
// (절차적으로 그리던 모듈들 — clouds/Starfield/Planet/ShootingStars — 은 이 커밋에서 제거했다.
//  필요하면 git 히스토리에서 되살릴 수 있다.)
//
// 원본은 장당 941×1672 PNG, 약 2.3MB다. 그대로 쓰면 8장에 17MB라 모바일에서 쓸 수 없어서
// 빌드 전에 WebP(quality 72)로 변환해 `public/bg/*.webp`에 둔다 — 장당 50~130KB이고
// 화면 하나가 한 장만 받는다.
//
// 위젯은 전부 이 배경 **위에** 그대로 얹힌다. 배경은 `pointer-events-none`이라 클릭을 가로채지
// 않는다.

export type SpaceVariant =
  | 'login'
  | 'record-home'
  | 'recording'
  | 'archive'
  | 'detail'
  | 'detail-starwl'
  | 'pattern'
  | 'profile';

interface VariantConfig {
  /** public/bg/ 아래 파일 이름 */
  file: string;
  /**
   * cover로 잘릴 때 어느 쪽을 남길지. 이미지는 9:16인데 요즘 폰은 더 길고 데스크톱은
   * 가로로 넓어서, 무엇을 지킬지 화면마다 다르다.
   */
  position: string;
  /**
   * 상단 스크림 세기(0~1). 제목·로고가 배경의 밝은 부분(은하수 등) 위에 올 때 대비를 지킨다.
   * 화면 전체를 어둡게 하지 않고 글자가 있는 위쪽만 누른다.
   */
  topScrim: number;
}

const VARIANTS: Record<SpaceVariant, VariantConfig> = {
  // 우측 상단 행성 + 아래쪽 지평선. 둘 다 살려야 해서 가운데 정렬.
  login: { file: 'login', position: 'center', topScrim: 0.34 },
  // 아래쪽 지구 지평선 위에 마이크 오브가 떠 있어야 한다 — 아래를 우선 지킨다.
  'record-home': { file: 'record-home', position: 'center bottom', topScrim: 0.34 },
  recording: { file: 'recording', position: 'center', topScrim: 0.3 },
  archive: { file: 'archive', position: 'center', topScrim: 0.4 },
  // 은하수 띠가 위쪽에 있다.
  detail: { file: 'detail', position: 'center top', topScrim: 0.42 },
  'detail-starwl': { file: 'detail-starwl', position: 'center top', topScrim: 0.42 },
  // 별자리 군집이 화면 가운데에 있는 그림이다.
  pattern: { file: 'pattern', position: 'center', topScrim: 0.42 },
  // 우측 상단의 큰 행성 가장자리가 이 화면의 주인공.
  profile: { file: 'profile', position: 'center', topScrim: 0.3 },
};

export interface SpaceSceneProps {
  variant: SpaceVariant;
  /** 배경을 통째로 어둡게 (모달 위 등). 0~1 */
  dim?: number;
}

export function SpaceScene({ variant, dim = 0 }: SpaceSceneProps) {
  const config = VARIANTS[variant];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-space-black">
      <img
        src={`/bg/${config.file}.webp`}
        alt=""
        // 배경은 화면에 처음 보이는 것 중 하나라 lazy로 미루면 잠깐 검은 화면이 남는다.
        loading="eager"
        fetchPriority="high"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={{ objectFit: 'cover', objectPosition: config.position }}
      />

      {/* 상단 스크림 — 로고·제목이 배경의 밝은 부분 위에 올 때를 대비한다. */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: '38%',
          background: `linear-gradient(to bottom, rgba(2,4,13,${config.topScrim}) 0%, rgba(2,4,13,${
            config.topScrim * 0.45
          }) 48%, rgba(2,4,13,0) 100%)`,
        }}
      />

      {dim > 0 && <div className="absolute inset-0" style={{ background: `rgba(2,4,13,${dim})` }} />}
    </div>
  );
}
