// 녹음 버튼용 아이콘 2종. 대기 상태(=마이크, 눌러서 녹음 시작)와 녹음 중 상태(=정지 사각형,
// 눌러서 녹음을 멈추고 저장 정보 화면으로 넘어감)를 구분해서 보여주기 위한 것 (design.md 참고).
// 마이크 아이콘은 Lucide의 "mic" 글리프를 기반으로 함.
export function MicIcon({ className = 'h-7 w-7 text-white' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function StopIcon({ className = 'h-7 w-7 rounded-sm bg-white' }: { className?: string }) {
  return <span className={className} aria-hidden="true" />;
}

// 소셜 로그인 버튼용 브랜드 아이콘. 공식 브랜드 색을 그대로 사용한다(그라디언트 팔레트 아님).
export function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function KakaoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#000000"
        fillOpacity={0.85}
        d="M12 3C6.48 3 2 6.48 2 10.7c0 2.71 1.85 5.08 4.63 6.44-.2.75-.73 2.73-.84 3.15-.13.53.19.52.4.38.17-.11 2.65-1.8 3.73-2.54.68.1 1.38.15 2.08.15 5.52 0 10-3.48 10-7.58C22 6.48 17.52 3 12 3Z"
      />
    </svg>
  );
}
