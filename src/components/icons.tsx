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
