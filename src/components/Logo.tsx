import logoSrc from '../assets/logo.png';

// ECHO 워드마크. 그려서 만든 SVG 대신 실제 로고 이미지(logo.png)를 그대로 쓴다
// ("우리 로고 logo.png로 다 바꿔줘" 요청).
//
// logo.png는 1254×420(약 3:1) 가로로 긴 이미지다 — 정사각형 박스(h-N w-N)에 object-cover로
// 욱여넣으면 좌우가 잘려 "ECHO" 글자 일부가 날아간다("로고가 잘린다" 버그의 원인이었다).
// 높이만 지정하고 너비는 auto로 두어 원본 비율 그대로 보이게 한다 — 원 모양으로 자를 이유도
// 없는 사각형 워드마크라 rounded-full·object-cover 둘 다 뺐다.
const SIZE_CLASSES = {
  // 여러 차례 키웠다가 잘림 문제로 다시 원래 크기로 되돌렸다.
  default: 'h-10 w-auto',
  // 기록 탭처럼 로고가 조금 더 존재감 있어야 할 때.
  lg: 'h-14 w-auto',
  // 로그인 화면 — 로고 하나가 화면의 주인공일 때.
  xl: 'h-20 w-auto',
} as const;

export function Logo({
  size = 'default',
  className = '',
}: {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <img src={logoSrc} alt="ECHO" className={`${SIZE_CLASSES[size]} shrink-0 object-contain ${className}`} />
  );
}
