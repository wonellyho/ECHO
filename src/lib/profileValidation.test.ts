import { describe, expect, it } from 'vitest';
import { canSubmitNickname, NICKNAME_MAX_LENGTH, normalizeNickname } from './profileValidation';

describe('canSubmitNickname', () => {
  it('빈 문자열은 저장할 수 없다', () => {
    expect(canSubmitNickname('')).toBe(false);
  });

  it('공백만 있으면 저장할 수 없다', () => {
    expect(canSubmitNickname('   ')).toBe(false);
    expect(canSubmitNickname('\n\t ')).toBe(false);
  });

  it('한 글자면 저장할 수 있다', () => {
    expect(canSubmitNickname('원')).toBe(true);
  });

  it('앞뒤 공백을 뺀 길이로 판단한다', () => {
    expect(canSubmitNickname('  원호  ')).toBe(true);
  });

  it('최대 길이까지는 저장할 수 있다', () => {
    expect(canSubmitNickname('가'.repeat(NICKNAME_MAX_LENGTH))).toBe(true);
  });

  it('최대 길이를 넘으면 저장할 수 없다', () => {
    expect(canSubmitNickname('가'.repeat(NICKNAME_MAX_LENGTH + 1))).toBe(false);
  });

  it('길이 판단도 앞뒤 공백을 뺀 뒤에 한다', () => {
    // 공백 포함 22자지만 실제 닉네임은 20자이므로 저장 가능해야 한다.
    expect(canSubmitNickname(` ${'가'.repeat(NICKNAME_MAX_LENGTH)} `)).toBe(true);
  });
});

describe('normalizeNickname', () => {
  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeNickname('  원호  ')).toBe('원호');
  });

  it('가운데 공백은 그대로 둔다', () => {
    expect(normalizeNickname('  원 호  ')).toBe('원 호');
  });

  it('공백만 있으면 빈 문자열이 된다', () => {
    expect(normalizeNickname('   ')).toBe('');
  });
});
