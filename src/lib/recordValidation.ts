// 기록 텍스트가 제출 가능한 상태인지 판단한다 (공백만 있는 경우는 제출 불가).
export function canSubmitRecord(text: string): boolean {
  return text.trim().length > 0;
}
