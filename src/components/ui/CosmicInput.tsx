import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

// 입력 필드. 레퍼런스처럼 왼쪽에 아이콘 오브를 두고, 포커스에서만 테두리가 밝아진다.
// label을 시각적으로 감추더라도 접근성 이름은 반드시 남긴다 (§22).

const FIELD_BASE =
  'w-full rounded-2xl border border-hairline text-[15px] text-ink placeholder:text-ink-muted backdrop-blur-xl transition-colors duration-200 focus:border-hairline-active focus:outline-none';

export interface CosmicInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 왼쪽 아이콘 (선택) */
  leading?: ReactNode;
  /** 오른쪽 버튼 — 비밀번호 보기 토글 등 (선택) */
  trailing?: ReactNode;
}

export function CosmicInput({ leading, trailing, className = '', ...props }: CosmicInputProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-hairline px-4 backdrop-blur-xl transition-colors duration-200 focus-within:border-hairline-active ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.38)' }}
    >
      {leading && <span className="shrink-0 text-ink-muted">{leading}</span>}
      <input
        {...props}
        className="min-h-[3rem] flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none"
      />
      {trailing}
    </div>
  );
}

export function CosmicTextarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${FIELD_BASE} resize-none p-4 leading-relaxed ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.38)' }}
    />
  );
}
