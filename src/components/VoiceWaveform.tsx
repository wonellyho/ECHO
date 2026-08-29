// 마이크 볼륨(0~1)의 최근 이력을 막대 그래프로 표시한다. 실제 오디오 레벨 기반(useMicLevel)이며
// 장식용 고정 애니메이션이 아니다. history는 useMicLevel이 이미 정해진 길이로 관리해 넘겨준다.
// barClassName은 배경에 따라 막대 색 대비를 맞추기 위한 오버라이드 (design.md 참고).
export function VoiceWaveform({ history, barClassName = 'bg-slate-400' }: { history: number[]; barClassName?: string }) {
  return (
    <div className="flex h-32 items-end justify-center gap-2" aria-hidden="true">
      {history.map((value, index) => (
        <div
          key={index}
          className={`w-3 rounded-full shadow-sm transition-[height] duration-75 ${barClassName}`}
          style={{ height: `${Math.max(6, value * 100)}%` }}
        />
      ))}
    </div>
  );
}
