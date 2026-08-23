import { describe, expect, test } from 'vitest';
import { canSubmitRecord } from './recordValidation';

describe('canSubmitRecord', () => {
  test('returns false for empty text', () => {
    expect(canSubmitRecord('')).toBe(false);
  });

  test('returns false for whitespace-only text', () => {
    expect(canSubmitRecord('   \n  ')).toBe(false);
  });

  test('returns true for non-empty text', () => {
    expect(canSubmitRecord('오늘 발표에서 있었던 일')).toBe(true);
  });
});
