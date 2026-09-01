# 녹화화면 리디자인 (Figma `녹화화면` 프레임 반영)

Figma 파일 `ECHO`(`ty3Jt8ZekM631WrZjJGgzJ`)의 `녹화화면` 프레임(`5:2423`)과 사용자 메모(`5:2425`,
`5:2460`)를 반영해 `RecordPage`의 voice 단계를 다시 만든다.

원본 메모:
> 녹화화면은 이것처럼 좀 더 연한디자인. 정지버튼을 놔서 사용자가 잠깐 끊었다가 멈출수있게.
> 사용자 음성 듣는 음량곡선 이 화면처럼 좀 더 부드럽게. 버튼 3개와 기능 그대로 구현
> / 사용자가 입력한 거 대본나오게

이 문서는 Figma 메모 4개 항목 중 **녹화화면 하나만** 다룬다. 하단 아이콘 네비게이션, 내 경험 탭
순환 스택, 컬렉션 스와이프, 카드 색상은 각각 별도 슬라이스로 뺐다 (`feature-slicing-approach` 관례).

---

# 기능 1: 사용자가 레퍼런스처럼 연한 그라디언트 배경의 녹화 화면에서 녹음할 수 있다

## 완료 조건
- [ ] 녹화 화면 배경이 위(연한 피치) → 아래(진한 오렌지)로 흐르고, 상단 텍스트는 어두운 slate,
      하단 텍스트는 흰색으로 보인다
- [ ] 파형이 각진 막대가 아니라 부드러운 곡선 3겹으로 흐르고, 말하면 실제로 높이가 움직인다
- [ ] 녹음 중 경과 시간이 `0:06` 형식으로 표시되고 1초마다 올라간다
- [ ] 하단에 `⏸` / `✓` / `🗑` 세 버튼이 있고, 상단 우측에 타이핑 전환 버튼이 있다
- [ ] `✓`를 누르면 화면이 바로 넘어가지 않고 가운데 버튼이 `넘어가기`로 바뀐다
- [ ] 말한 내용이 화면에 실시간 대본으로 계속 보인다

## 안 되는 경우
- 마이크 권한이 거부됐을 때 → 기존과 동일하게 `{error} (파형만 비활성됩니다)` 안내가 뜨고,
  파형은 0으로 눕지만 화면 나머지는 정상 동작한다
- 음성 인식이 실패했을 때 → 기존 에러 박스 그대로 유지 (`! 음성을 인식하지 못했습니다...`),
  이미 받아쓴 내용이 있으면 `여기까지는 저장되어 있습니다` 안내도 유지
- 브라우저가 Web Speech API를 지원하지 않을 때 → 기존과 동일하게 choice 단계에서 voice로
  진입 자체가 막힌다 (`goToVoice`의 `isSupported` 가드 유지)

## 이번에 안 하는 것
- 녹음 시간 상한 / 자동 정지 — 레퍼런스의 `of 3:00 limit` 줄은 만들지 않는다 (사용자 결정)
- 오디오 파일 저장, Whisper 등 유료 STT 도입 (CLAUDE.md 기준 유지)
- choice / typing / details 단계의 디자인 — voice 단계만 건드린다
- 하단 네비게이션 바 (별도 슬라이스)

## 건드릴 파일
| 파일 | 신규/수정 | 내용 |
|---|---|---|
| `src/pages/RecordPage.tsx` | 수정 | voice 단계(현 334~408행) 전체 교체 + 타이머 상태 + 버튼 핸들러 |
| `src/components/VoiceWaveform.tsx` | 수정 | 막대 `div` → SVG `<path>` 3겹 곡선 |
| `src/components/icons.tsx` | 수정 | `PauseIcon` / `PlayIcon` / `CheckIcon` / `TrashIcon` / `KeyboardIcon` 추가 |
| `src/lib/useMicLevel.ts` | 수정 | `HISTORY_LENGTH` 7 → 48 (한 줄) |
| `src/lib/formatDuration.ts` | **신규** | `formatDuration(ms) → "M:SS"` |
| `src/lib/formatDuration.test.ts` | **신규** | 경계값 테스트 |
| `src/lib/smoothPath.ts` | **신규** | 점 배열 → Catmull-Rom 기반 cubic bezier `d` 문자열 |
| `src/lib/smoothPath.test.ts` | **신규** | 빈 배열/1점/2점/N점 |
| `design.md` | 수정 | "음성 녹음 화면 배경" 절을 새 값으로 갱신 |

## 확인 방법
1. `npm test` — `formatDuration`, `smoothPath` 테스트 포함 전부 통과
2. `npm run build` 통과
3. 배포 URL(https://echo-seven-phi-26.vercel.app/)에서 직접:
   - 기록 탭 → "음성으로 기록" → 배경이 위 연함/아래 진함으로 보이는지
   - 말해보고 파형이 부드러운 곡선으로 움직이는지, 대본이 실시간으로 쌓이는지
   - 타이머가 올라가는지 → `⏸` → 타이머 멈추는지, 가운데가 `넘어가기`로 바뀌는지
   - `▶` → 타이머가 0이 아니라 멈춘 지점부터 이어지는지, 가운데가 다시 `✓`로 돌아오는지
   - 아무 말도 안 한 상태에서 `✓` → `넘어가기`가 비활성이고 힌트가 뜨는지
   - `🗑` → 선택 화면으로 돌아가고 내용이 비워지는지
   - 상단 우측 타이핑 버튼 → 받아쓴 내용이 타이핑 화면에 그대로 들어오는지

## 물어볼 것
없음 — 아래 결정 사항은 브레인스토밍에서 전부 확정됨.

---

## 결정 사항

### 배경 그라디언트

`bg-gradient-to-b from-orange-100 via-orange-400 to-orange-700`

레퍼런스는 "상단 연함 → 하단 진함"이고 사용자가 그대로 가기로 결정했다.

**대비 기준을 잡을 때 주의할 점**: `via-orange-400`은 컨테이너 **높이의 50% 지점**에 놓인다.
따라서 화면 위쪽 절반은 `orange-100`~`orange-400` 사이의 밝은 색이고, 흰 텍스트가 4.5:1을
넘기려면 대략 92% 지점보다 아래로 내려가야 한다. 각 요소가 실제로 앉는 **세로 위치**를 기준으로
계산해야 하며, "하단이 orange-700이니 흰 글씨 5.1:1"이라고 뭉뚱그리면 틀린다
(이 화면은 같은 실수로 이미 두 번 되돌린 이력이 있다).

요소별 실측 (sRGB 그라디언트 보간 + WCAG 상대휘도, 844px 뷰포트 기준):

| 영역 | 세로 위치 | 배경색 | 텍스트 | 대비 | 기준 |
|---|---|---|---|---|---|
| 상단 바 (뒤로 / 타이핑) | ~0.05 | #ffedd5 근처 | `text-slate-800` | ~14:1 | 4.5:1 ✅ |
| 상태 라벨 | ~0.11 | orange-200대 | `text-slate-800` | 11.00:1 | 4.5:1 ✅ |
| 파형 | 0.14~0.30 | orange-300대 | `fill-white/25~60` | — | 장식, 미적용 |
| 타이머 (text-4xl) | ~0.33 | #fcb170 | `text-slate-800` | **~8.1:1** | 3:1(큰 글씨) ✅ |
| 대본 (text-sm) | ~0.43 | #fc9f51 | `text-slate-800` | **~7.1:1** | 4.5:1 ✅ |
| 마이크 오류 | 위치 가변 | `bg-white/60` 박스 | `text-slate-800` | 위치 무관 고정 | 4.5:1 ✅ |
| 하단 버튼 3개 | ~0.83 | #d55c1c | `bg-white` + `text-orange-700` | 5.18:1 (글리프)<br>3.90:1 (버튼 경계) | 4.5:1 / 3:1 ✅ |
| `먼저 녹음해주세요` | ~0.99 | #c2410c | `text-white` | 5.09:1 | 4.5:1 ✅ |

즉 **흰 텍스트는 화면 맨 아래 힌트에만 쓰고, 그 위 본문은 전부 `text-slate-800`**이다.
레퍼런스가 상단 문구("How do you feel?")를 어두운 회색으로 쓴 것과 같은 논리다.

하단 좌우 컨트롤은 반투명(`bg-white/25`)으로 두면 배경을 밝히기만 해서 흰 아이콘이 2.74:1까지
떨어진다. 가운데 버튼과 동일하게 **솔리드 `bg-white` + `text-orange-700`**으로 통일한다 —
크기만 다르고 스타일은 같아져 시각적으로도 한 세트로 읽힌다.

상단의 반투명 유리 버튼은 배경이 밝아졌으므로 기존 `bg-white/50 border-white/60 text-slate-700`
대신 `bg-white/60 border-white/80 text-slate-800`으로 살짝 올린다.

### 파형 (`VoiceWaveform.tsx`)

- 데이터 소스는 **그대로** `useMicLevel.history` — 실제 마이크 RMS 기반이며 장식용 고정
  애니메이션이 아니라는 원칙 유지
- `useMicLevel`의 `HISTORY_LENGTH`를 7 → 48로 올린다. 막대 7개엔 충분했지만 가로를 가로지르는
  곡선에는 점이 너무 적어 각져 보인다. 훅의 공개 인터페이스(`history: number[]`)는 안 바뀌므로
  다른 호출부 영향 없음
- SVG `viewBox="0 0 100 100"` + `preserveAspectRatio="none"`, `<path>` 3개를 겹친다
- 곡선은 좌우 대칭이 아니라 **아래 기준선에서 위로 솟는 산맥** 형태 (레퍼런스와 동일).
  각 path는 마지막에 우하단 → 좌하단으로 닫아 면을 채운다
- 3겹은 같은 `history`에 진폭 배율 `1.0 / 0.7 / 0.45`와 x축 위상 오프셋(`0 / 2 / 4` 샘플)을
  달리 적용해 그리고 `fill-white/60`, `fill-white/40`, `fill-white/25`로 겹친다.
  전부 같은 실제 음량에서 나오므로 "실제 음량 반영"은 유지된다
- `aria-hidden="true"` 유지 (장식 요소)
- `barClassName` prop은 제거한다 — 막대가 사라지므로 의미가 없다. 유일한 호출부인 voice 단계에서
  같이 제거

**`smoothPath.ts`**: `smoothPath(values: number[]): string`. 값 배열(0~1)을 받아 Catmull-Rom
스플라인을 cubic bezier로 변환한 SVG `d` 문자열을 돌려준다. 순수 함수라 단위 테스트 가능.
빈 배열이면 빈 문자열, 1~2점이면 직선으로 폴백.

### 하단 버튼 3개

화면은 **녹음 중 / 일시정지 / 완료** 3상태를 가진다:

| 상태 | 왼쪽 (h-11 w-11) | 가운데 (h-28 w-28) | 오른쪽 (h-11 w-11) |
|---|---|---|---|
| 녹음 중 (`isRecording`) | `⏸` 일시정지 | `✓` 완료 | `🗑` 삭제 |
| 일시정지 (`!isRecording && !voiceDone`) | `▶` 이어 녹음 | `✓` 완료 | `🗑` 삭제 |
| 완료 (`!isRecording && voiceDone`) | `▶` 이어 녹음 | `넘어가기` | `🗑` 삭제 |

일시정지와 완료를 **별도 상태로 나눈 이유**: `✓`가 화면을 전환하지 않게 되면서, "녹음을 멈춘다"는
동작만으로는 `⏸`와 `✓`가 완전히 같아진다. 둘을 구분하려면 "사용자가 끝났다고 선언했는가"를 별도
플래그(`voiceDone`)로 들고 있어야 하고, 그 플래그가 가운데 버튼이 `✓` → `넘어가기`로 바뀌는 시점을
결정한다. 그래서 상태가 2개가 아니라 3개다.

- `⏸` → `pauseVoiceRecording()`: 녹음만 멈춘다. `voiceDone`은 false 유지 → 가운데는 계속 `✓`
- `✓` → `finishVoiceRecording()`: 녹음을 멈추고 `voiceDone = true`. **화면 전환 없음.**
  타이머 멈추고 대본은 남는다
- `넘어가기` → `goToDetailsFromVoice()`: `setStep('details')`.
  `canSubmitRecord(speech.transcript)`가 false면 버튼이 `disabled`이고 그 아래에
  `먼저 녹음해주세요` 힌트를 보여준다.
  (기존 `stopVoiceAndContinue`는 조건 미달 시 조용히 아무것도 안 해서 사용자가 이유를 알 수 없었다 —
  이 기회에 고친다)
- `▶` → `resumeVoiceRecording()`: `voiceDone = false`로 되돌리고 다시 녹음 시작
- `🗑` → `cancelVoice()` + 타이머·`voiceDone` 리셋
- 상단 우측 `⌨` → `switchVoiceToTyping()` (기존 함수 그대로)

`stopVoiceAndContinue`는 "정지 + 다음 단계"를 한 번에 하던 함수라 셋으로 쪼갠다:
`pauseVoiceRecording()` / `finishVoiceRecording()` / `goToDetailsFromVoice()`.

기존 안내 문구 `가운데 버튼 = 녹음 정지 · 정지하면 저장 정보 입력으로`는 제거한다 — `✓`/`넘어가기`
라벨로 의미가 자명해져 불필요하다.

아이콘은 `icons.tsx`에 기존 `MicIcon`과 같은 Lucide 기반 stroke 스타일로 추가한다:
`PauseIcon`, `PlayIcon`, `CheckIcon`, `TrashIcon`, `KeyboardIcon`.
기존 `StopIcon`은 voice 단계가 유일한 호출부였으므로 함께 제거한다.

### 타이머

- `RecordPage`에 `elapsedMs` 상태 신설. `speech.isRecording`이 true인 동안에만 `setInterval`로
  200ms마다 증가시킨다(표시는 초 단위지만 일시정지 지점을 자연스럽게 잡기 위해 조금 더 촘촘히)
- 일시정지하면 멈추고, 이어 녹음하면 **리셋하지 않고 멈춘 지점부터** 계속된다 —
  받아쓰기 내용이 이어붙는 `useSpeechInput`의 동작과 일관되게
- `goToVoice`와 `cancelVoice`에서 0으로 리셋
- 화면을 떠날 때 interval 정리 (기존 `micLevel.stop()` cleanup과 같은 위치)

**`formatDuration.ts`**: `formatDuration(ms: number): string` → `"M:SS"`.
- `0` → `"0:00"`, `6_000` → `"0:06"`, `59_000` → `"0:59"`, `60_000` → `"1:00"`,
  `630_000` → `"10:30"`, 음수는 `"0:00"`으로 클램프
- 시간 단위(H:MM:SS)는 만들지 않는다 — 상한은 없지만 실제 사용은 분 단위이고,
  필요해지면 그때 넓힌다 (YAGNI)

### 유지되는 것

- 실시간 받아쓰기 대본 표시 (메모의 "사용자가 입력한 거 대본나오게")
- `speech.error` 에러 박스와 `micLevel.error` 안내
- `useSpeechInput`의 이어붙이기 동작 (정지 후 재시작해도 기존 내용 보존)
- choice 단계에서 voice 진입 시 `isSupported` 가드
