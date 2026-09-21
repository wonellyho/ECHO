import { describe, expect, it } from 'vitest';
import { readNickname, withNickname } from './useNickname';

describe('withNickname', () => {
  it('닉네임이 있으면 개인화된 문구를 쓴다', () => {
    expect(withNickname('원호', (n) => `${n}의 경험 기록`, '내 경험 기록')).toBe('원호의 경험 기록');
  });

  it('닉네임이 없으면 기존 문구를 그대로 쓴다', () => {
    expect(withNickname('', (n) => `${n}의 경험 기록`, '내 경험 기록')).toBe('내 경험 기록');
  });
});

describe('readNickname', () => {
  it('문자열이면 앞뒤 공백을 떼고 돌려준다', () => {
    expect(readNickname({ nickname: '  원호 ' })).toBe('원호');
  });

  it('없으면 빈 문자열', () => {
    expect(readNickname({})).toBe('');
    expect(readNickname(undefined)).toBe('');
    expect(readNickname(null)).toBe('');
  });

  it('문자열이 아니면 빈 문자열 — user_metadata는 자유 형식이라 보장이 없다', () => {
    expect(readNickname({ nickname: 42 })).toBe('');
    expect(readNickname({ nickname: { first: '원호' } })).toBe('');
    expect(readNickname({ nickname: null })).toBe('');
  });
});
