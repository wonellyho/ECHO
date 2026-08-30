# Google / Kakao 소셜 로그인 설정 가이드

Task 1~4에서 만든 로그인 화면의 Google/Kakao 버튼은 이미 `supabase.auth.signInWithOAuth`를
호출하는 실제 코드로 연결돼 있다. 아래 절차대로 Supabase 프로젝트에 provider를 등록하면
**코드 수정 없이 바로 동작한다.**

## Google

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성(또는 기존 프로젝트 사용).
2. "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID" → 애플리케이션 유형
   "Web application" 선택.
3. "Authorized redirect URIs"에 Supabase 프로젝트의 콜백 URL을 등록:
   `https://<프로젝트 참조 ID>.supabase.co/auth/v1/callback`
   (Supabase 대시보드의 Authentication → Providers → Google 화면에 정확한 URL이 표시된다.)
4. 발급된 Client ID / Client Secret을 Supabase 대시보드 → Authentication → Providers → Google에
   입력하고 토글을 켠다.

## Kakao

1. [Kakao Developers](https://developers.kakao.com/)에서 애플리케이션 생성.
2. "제품 설정" → "카카오 로그인" 활성화, "Redirect URI"에 위와 동일한 Supabase 콜백 URL 등록.
3. "앱 키" 화면에서 REST API 키를 확인.
4. Supabase 대시보드 → Authentication → Providers → Kakao에 REST API 키(Client ID)를 입력하고
   토글을 켠다. (Kakao는 Client Secret이 선택사항인 provider이므로, Kakao Developers의 보안 설정에서
   Client Secret을 발급했다면 그것도 함께 입력한다.)

## 확인

두 provider 모두 등록 후, 로그인 화면에서 각 버튼을 눌러 OAuth 동의 화면으로 리다이렉트되는지
확인한다. 에러가 뜬다면 redirect URI가 정확히 일치하는지부터 다시 확인한다.
