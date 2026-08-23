# 세션 기록 — 2026-08-23 (2차): 슬라이스 02 기록 상세 탭 + 패턴 영속화

같은 날 두 번째 세션. 1차 세션 기록은 `docs/2026-08-23-session-handoff.md` 참고.
이번 세션은 **브레인스토밍 → 스펙 → 플랜 → 서브에이전트 구현 → 리뷰 → 병합 → 배포**를
한 사이클 완주했고, **끝까지 완료됐습니다.**

## 오늘 목표와 결과

목표: 기록 상세 화면에 STAR 탭 + 패턴 탭을 만들고, 구조화 결과에 "깨달음" 필드 추가.
결과: **완료.** main에 병합 후 GitHub에 푸시(`d491d35..ef5c96e`)까지 끝냄.

## 들어간 기능 (슬라이스 02)

| 기능 | 내용 |
|---|---|
| 깨달음(realization) 필드 | `entries_structured.realization` 컬럼 → `api/structure.ts` 프롬프트/스키마 → `EntryStructured` 타입 → RecordPage 저장 → 상세 화면 표시. 근거성 원칙에 따라 기록에 없으면 null. |
| 인사이트 영속화 | 기존엔 InsightsPage 진입할 때마다 LLM을 새로 호출하고 결과를 로컬 state에만 담았음(= `insights` 테이블이 한 번도 안 쓰였음). 이제 DB에 저장하고, **진입 시엔 조회만**, "다시 분석하기" 클릭 시에만 재생성(기존 것 삭제 후 교체, 누적 안 함). |
| 기록 상세 탭 | `구조화/STAR` ↔ `패턴` 두 탭. 패턴 탭은 **읽기 전용** — `insights`에서 `evidence_entry_ids`에 이 기록이 포함된 항목만 조회. LLM 호출/생성/삭제 일절 안 함. 관련 항목 없으면 빈 상태 + `/insights` 링크. |
| `/insights` 연결 | `InsightsPage.tsx`는 코드로 존재했지만 라우트/네비 어디에도 안 걸려 있던 **죽은 코드**였음. 이번에 `/insights` 라우트 + 하단 네비 "패턴" 링크로 처음 살림. |
| 가벼운 UI | Tailwind 유틸리티로 탭/카드/태그칩/버튼 스타일링. **EntryDetailPage, InsightsPage, NavBar만** — RecordPage/EntriesPage/LoginPage는 1차 세션에서 의도적으로 스켈레톤으로 되돌린 상태라 손대지 않음. |

## 리뷰에서 잡아 고친 것 (중요)

최종 whole-branch 리뷰가 **데이터 손실 버그 2건**을 찾아냈고 `2a0af83`에서 고쳤습니다.
둘 다 "delete가 이미 커밋된 뒤에 insert가 실패하는" 같은 경로였습니다:

1. **검증 없는 LLM 응답을 delete 후에 insert.** 모델이 실제 UUID 대신 `"entry_1"` 같은
   플레이스홀더를 주거나 `summary`를 빠뜨리면, DELETE는 이미 끝난 뒤라 INSERT가 제약
   위반으로 실패하고 **사용자의 기존 인사이트가 영구 소실**됨.
2. **부분 응답에서 TypeError.** 모델이 `drainers` 키를 통째로 빼먹으면(프롬프트가
   "근거 부족하면 항목 수를 줄여라"라고 지시하므로 충분히 있을 법함) `.map`에서 throw →
   역시 delete 이후라 같은 소실 경로.

**고친 방식**: 검증을 `src/lib/buildInsightRows.ts`(순수 함수)로 옮기고 **delete 전에** 실행.
- `summary`가 빈 문자열/없으면 그 항목 버림
- `evidence_entry_ids`를 실제 기록 id 집합과 교집합 → 존재하지 않는 id 제거, 근거가 0개로
  남은 항목은 버림
- 검증 결과가 비면 **delete 자체를 안 하고** 에러 메시지만 띄움 (기존 데이터 보존)
- `Array.isArray` 가드로 부분 응답 방어

이 검증은 **근거성(PRD §7) 방어선**이기도 합니다 — 이제 실재하지 않는 기록을 "근거"로 단
인사이트는 저장되지 않습니다. 자동 롤백/트랜잭션은 의도적으로 범위 밖으로 뒀습니다.

## 사용자 결정 사항 (다음 세션에서 뒤집지 말 것)

- **탭 위치**: 전역 네비가 아니라 **기록 상세 페이지 내부**에 두 탭
- **인사이트 저장**: DB에 저장, 상세 탭은 조회만 (진입할 때마다 LLM 재호출 안 함)
- **재생성 방식**: 기존 것 삭제 후 교체 (이력/버전 누적 안 함)
- **깨달음 필드**: 추가함
- **UI 수준**: "중간" — 카드/버튼/태그칩에 색상·그림자·간단한 전환 애니메이션까지
- **insert 실패 시**: 화면의 이전 카드를 **비우고** 에러+재시도 안내 (스펙대로. 플랜 코드가
  이와 어긋나 있어서 사용자에게 물어 결정한 사안)

## 지금 상태

- **main**: `ef5c96e`. GitHub `origin/main`에 푸시 완료 → Vercel 자동 배포 트리거됨.
- **테스트**: 3파일 14개 통과. `npm run build` 통과.
- **Supabase 마이그레이션**: 사용자가 직접 실행 완료
  (`alter table entries_structured add column if not exists realization text;`)
- **수동 확인**: 사용자가 로컬 `npm run dev:vercel`로 동작 확인 완료.
- **워크트리**: `worktree-entry-detail-patterns` 브랜치와 워크트리 폴더 모두 삭제됨.
  이제 `C:\ECHO` 하나만 사용.
- **미커밋 변경**: `.env.example`에 빈 줄 하나 추가된 것이 남아있음 (의도 불명, 사용자 확인 필요)

## 남은 일 / 다음 세션 후보

1. **배포 결과 확인 안 함.** Vercel CLI가 미설치라 이 세션에서 배포 상태를 확인하지 못했습니다.
   https://echo-seven-phi-26.vercel.app/ 에서 하단 네비 "패턴" 링크가 보이는지 확인 필요.
2. **프로덕션 `OPENROUTER_MODEL` 미설정.** 1차 세션 기록대로 프로덕션엔 이 환경변수가 없어
   코드 기본값(`z-ai/glm-5.2:free`, **미검증 모델**)을 씁니다. Preview에는 디버깅용으로
   일부러 깨뜨린 값(`invalid/force-claude-fallback-test`)이 남아있음 — 정리 필요.
3. **`/api/*` 함수에 인증 체크 없음** (이번 브랜치 이전부터 있던 문제, 최종 리뷰가 발견).
   미인증 호출자가 `/api/structure`, `/api/star`, `/api/insights`를 직접 때려 LLM 쿼터를
   소모할 수 있습니다. **다음 슬라이스 후보 1순위.**
4. **CLAUDE.md 미갱신.** 이번 변경(깨달음 필드, 패턴 탭, 인사이트 영속화, insights.ts가
   이제 실제로 쓰인다는 점)이 프로젝트 가이드에 반영 안 됨. "코드와 문서가 어긋나면 문서를
   갱신한다"는 규칙이 있으므로 처리 필요.
5. **머지 무방하다고 판단해 남긴 minor 3건** (최종 리뷰 결과):
   - `EntryDetailPage`의 패턴 탭 effect가 `id` 변경 시 `patternLoaded`를 리셋하지 않음
     (현재 UI 동선으로는 도달 불가 — 상세→상세 이동 경로가 없음)
   - 패턴 탭 Supabase 쿼리에 에러 처리가 없어, 쿼리 실패가 "패턴 없음" 빈 상태와 구분 안 됨
   - `InsightsPage`에 early return 직전 불필요한 `setLoading(false)` 한 줄
6. **1차 세션 미해결 이슈였던 OpenRouter 무료 모델 신뢰성**은 이번 범위 밖이라 손대지 않음.
   다만 이번에 구조화가 정상 동작하는 걸 확인했으므로, 1차 세션의 "모델이 내용을 지어낸다"는
   판단은 **curl 인코딩 문제였을 가능성이 큽니다.** (1차 세션 기록의 추측이 맞았던 셈)

## 참고 문서

- 원본 요구사항: `PRD_ECHO.md`
- 프로젝트 가이드: `CLAUDE.md` (갱신 필요 — 위 4번)
- 1차 세션 기록: `docs/2026-08-23-session-handoff.md`
- 이번 슬라이스 스펙: `docs/slices/02-entry-detail-patterns.md`
- 이번 실행 플랜: `docs/superpowers/plans/2026-08-23-entry-detail-patterns.md`
  (Task 1은 실행 시점에 이미 해소돼 no-op 처리됨 — 문서에 주석으로 표시해둠)
