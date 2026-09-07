import { TAG_HEX } from '../../lib/tagColors';
import type { ExperienceTag } from '../../types';

// 태그 칩. 레퍼런스처럼 "색으로 채운 배지"가 아니라 **테두리와 글자에만 색이 있는 유리 캡슐**이다.
// 네온처럼 과하게 빛나지 않게 glow는 선택됐을 때만, 그것도 아주 약하게 준다.

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export interface TagChipProps {
  tag: ExperienceTag;
  active?: boolean;
  /** 없으면 버튼이 아니라 표시 전용 span으로 그린다 (상세 화면의 읽기 전용 태그 등). */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function TagChip({ tag, active = false, onClick, disabled, className = '' }: TagChipProps) {
  const rgb = hexToRgb(TAG_HEX[tag]);
  const style = {
    color: active ? '#fff' : TAG_HEX[tag],
    borderColor: `rgba(${rgb}, ${active ? 0.9 : 0.45})`,
    background: active ? `rgba(${rgb}, 0.28)` : 'rgba(10, 20, 40, 0.5)',
    boxShadow: active ? `0 0 14px -4px rgba(${rgb}, 0.8)` : 'none',
  };
  const base = `shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-200 ${className}`;

  if (!onClick) {
    return (
      <span className={base} style={style}>
        #{tag}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`${base} disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmic-violet focus-visible:ring-offset-2 focus-visible:ring-offset-space-black`}
      style={style}
    >
      #{tag}
    </button>
  );
}
