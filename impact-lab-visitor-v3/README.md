# 임팩트랩 방문 기록 등록 시스템 — 모듈 분리 + Vercel 프록시 (안 A)

`lab_list.html` 한 파일을 역할별로 분리하고, Apps Script URL·비밀 토큰을
브라우저에서 완전히 제거해 Vercel 서버리스 함수 뒤로 숨긴 버전입니다.
카페 이용은 방문 목적과 무관한 독립 체크박스로 처리합니다(안 A: 등록 폼 안에서 바로 입력).

> **v3**: 방문자 본인이 등록하는 셀프 키오스크가 아니라, **담당자가 방문
> 기관·인원 정보를 대신 기록하는 내부 도구**입니다. 방문자 개인 인적사항과
> 개인정보 수집 동의 절차는 제거되었고, 담당자 이메일(`@gbcommons.org`)로
> 담당자를 식별합니다.

## 파일 구조

```
index.html                   마크업만 (방문 등록 폼)
dashboard.html                카페 이용 현황 대시보드 (신규)
css/style.css                 기존 디자인 토큰 그대로 + 신규 필드 스타일
css/dashboard.css             대시보드 전용 스타일 (신규, style.css 토큰 재사용)
js/config.js                  방문목적 목록, 담당자 이메일 도메인 (민감정보 없음)
js/validation.js              입력 검증, sanitize, honeypot 체크
js/storage.js                 담당자 자동 인식 localStorage 처리
js/ui.js                      드롭다운 초기화, 라디오·카페 토글
js/form.js                    제출 처리 — '/api/register-visitor'만 호출
js/dashboard.js               대시보드 로직 (신규) — 목록 조회 + 메뉴 입력
api/register-visitor.js       Vercel 서버리스 함수 — 등록 프록시
api/menu.js                   Vercel 서버리스 함수 — 메뉴 목록 프록시 (등록 폼 → 이제는 대시보드만 사용)
api/cafe-requests.js          Vercel 서버리스 함수 (신규) — 카페 이용 신청 목록 프록시
api/cafe-menu-update.js       Vercel 서버리스 함수 (신규) — 이용 메뉴 입력/수정 프록시
apps-script/Code.v3.gs         참고용 스켈레톤 (실제 운영 스크립트와 병합 필요) — 방문 등록용
apps-script/Code.dashboard.gs  참고용 스켈레톤 (신규, 별도 Apps Script 프로젝트) — 대시보드용
```

### v3.1 변경 사항 — 카페 메뉴 입력 시점 변경 + 대시보드 추가

카페 이용 여부/인원수는 방문 등록 시점에 그대로 받지만, **실제 이용 메뉴는 더 이상
등록 폼에서 받지 않는다.** 현장 카페 담당자가 `dashboard.html`에서 카페 이용 신청
목록(담당자/방문기관명/인원수)을 보고, 실제 이용 시점에 메뉴를 입력한다.

대시보드는 등록 폼과 완전히 분리된 별도의 Apps Script 프로젝트
(`Code.dashboard.gs`)와 별도의 Vercel API 경로(`/api/cafe-requests`,
`/api/cafe-menu-update`)를 사용한다. 등록용 `SECRET_TOKEN`과 대시보드용
`DASHBOARD_SECRET_TOKEN`을 분리해, 한쪽이 유출돼도 다른 쪽 기능에는 영향이 없다.

대시보드는 별도 로그인 없이 **URL을 아는 담당자만 접근**하는 방식이다. 검색엔진
노출은 `<meta name="robots" content="noindex,nofollow">`로 막아뒀지만, 실제
배포 시에는 `dashboard.html` 대신 추측하기 어려운 경로로 이름을 바꾸고, URL을
내부적으로만 공유하는 것을 권장한다.

## 배포 전 준비물

1. GitHub 리포지토리 (Private 권장)
2. Vercel 계정 (GitHub 연동)
3. 기존 Apps Script A(등록용)의 웹앱 URL, Script Properties에 저장된 `SECRET_TOKEN` 값
4. 신규 Apps Script B(대시보드용)의 웹앱 URL, `DASHBOARD_SECRET_TOKEN` 값 (아래 "Apps Script B" 참고)

## 배포 순서

1. 이 폴더를 GitHub 리포지토리에 push
2. Vercel → Add New Project → 해당 리포지토리 선택 → Framework Preset: **Other**
3. Vercel 프로젝트 Settings → Environment Variables에 아래 네 개 등록
   - `GAS_WEBHOOK_URL` = 기존 Apps Script A 웹앱 배포 URL
   - `GAS_SECRET_TOKEN` = Apps Script A Script Properties의 `SECRET_TOKEN`과 동일한 값
   - `GAS_DASHBOARD_WEBHOOK_URL` = 신규 Apps Script B 웹앱 배포 URL
   - `GAS_DASHBOARD_SECRET_TOKEN` = Apps Script B Script Properties의 `DASHBOARD_SECRET_TOKEN`과 동일한 값
4. Deploy
5. 배포 후 `{프로젝트명}.vercel.app` 접속해서 등록 테스트, `{프로젝트명}.vercel.app/dashboard.html` 접속해서 대시보드 테스트

이 시점부터 브라우저 개발자도구로 소스를 봐도 Apps Script 주소나 토큰이 보이지 않습니다.
`/api/register-visitor`, `/api/menu`, `/api/cafe-requests`, `/api/cafe-menu-update`라는
우리 서버 내부 경로만 보입니다.

## Apps Script A — 등록용 (Google 쪽) 준비물

`apps-script/Code.v3.gs`는 참고용입니다. 실제 운영 중인 Apps Script 편집기에서
다음 내용을 기존 코드에 병합하세요.

> **v3 변경 사항**: 이 폼은 더 이상 방문자 본인이 자기 정보를 입력하고
> 동의하는 셀프 등록이 아니라, **담당자가 방문 기록을 대신 남기는 내부
> 관리 도구**입니다. 이름·성별·출생년도·연락처·거주지 같은 방문자 개인
> 인적사항과 개인정보 수집 동의 절차를 모두 제거하고, 대신 담당자 이메일
> (`@gbcommons.org`)과 담당자 이름을 받습니다.

### 1) 방문기록 시트 — 컬럼 구성 (A~N)

| 열 | 항목 |
|---|---|
| A | 등록일시 |
| B | 방문월 |
| C | 방문일 |
| D | 방문시간 |
| E | 방문목적 |
| F | 방문기관/업체명 |
| G | 청도군내 여부 |
| H | 방문인원수 |
| I | 담당자 이메일 |
| J | 담당자 이름 |
| K | 비고 |
| L | 등록코드 |
| M | 캘린더 이벤트ID |
| N | 캘린더 동기화 상태 |

기존에 방문자 개인정보(이름/성별/출생년도/연락처/거주지)를 담던 열은
더 이상 사용하지 않습니다. 기존 데이터가 남아있는 시트라면 별도 탭으로
백업해두고 위 구성으로 새로 시작하는 것을 권장합니다.

### 2) 카페이용내역 시트 (같은 스프레드시트의 탭, 기존과 동일한 구조)

| 열 | 항목 |
|---|---|
| A | 등록코드 (방문기록 시트 L열과 연결되는 키) |
| B | 등록일시 |
| C | 이용 메뉴 (복수 선택 시 쉼표로 연결) — **등록 시엔 빈 값**, 대시보드에서 실제 이용 시점에 채움 |
| D | 카페 이용 인원수 |

### 3) 카페메뉴설정 시트 신규 생성 (메뉴 마스터 데이터)

| 열 | 항목 | 예시 |
|---|---|---|
| A | 메뉴명 | 아메리카노 |
| B | 노출여부 | TRUE |
| C | 정렬순서 | 1 |

카페 담당자가 메뉴를 바꾸고 싶으면 이 탭만 수정하면 됩니다. 코드 재배포도,
Apps Script 재배포도 필요 없습니다 — `api/menu.js`가 5분 캐시로 자동 반영합니다.

## Apps Script B — 대시보드용 (Google 쪽) 준비물 (신규)

`apps-script/Code.dashboard.gs`는 참고용입니다. **Apps Script A와 같은 프로젝트에
넣지 말고**, script.google.com에서 새 프로젝트를 만들어 붙여넣으세요. Apps Script는
프로젝트당 `doPost` 함수가 하나뿐이라, 등록 로직과 대시보드 로직을 완전히 분리하려면
별도 프로젝트가 필요합니다.

1. script.google.com에서 새 프로젝트 생성 (이름 예: "임팩트랩 카페 대시보드")
2. `Code.dashboard.gs` 내용을 붙여넣기
3. Script Properties에 등록
   - `DASHBOARD_SECRET_TOKEN` — Apps Script A의 `SECRET_TOKEN`과 **다른 값**으로 새로 생성
   - `SPREADSHEET_ID` — 방문기록이 쌓이는 스프레드시트 ID (URL의 `/d/`와 `/edit` 사이 문자열)
4. 이 프로젝트는 스프레드시트에 컨테이너 바인딩되어 있지 않으므로, 스프레드시트에
   대한 편집 권한이 있는 계정으로 배포해야 합니다.
5. 웹앱으로 배포 → 이 URL을 Vercel의 `GAS_DASHBOARD_WEBHOOK_URL`에 등록

## 확인 체크리스트

- [ ] `GAS_WEBHOOK_URL`, `GAS_SECRET_TOKEN` 환경변수가 Vercel에 정확히 등록되었는지
- [ ] `GAS_DASHBOARD_WEBHOOK_URL`, `GAS_DASHBOARD_SECRET_TOKEN` 환경변수가 Vercel에 정확히 등록되었는지
- [ ] Apps Script A `doPost`에 `getMenu` action이 추가되었는지 (기존엔 `addVisitor`만 허용)
- [ ] Apps Script B가 Apps Script A와 별도 프로젝트로 배포되었는지, `SPREADSHEET_ID`가 올바른지
- [ ] 방문기록 시트가 A~N 컬럼(등록일시 ~ 캘린더 동기화 상태) 구성으로 정리되었는지
- [ ] 카페이용내역 / 카페메뉴설정 시트(탭)가 생성되었는지
- [ ] 카페 이용 체크 → 등록 시 카페이용내역 시트에 등록코드/인원수만 기록되고 메뉴는 빈 값인지
- [ ] 카페 이용 체크 안 함 → 방문기록 시트에만 기록되는지
- [ ] 담당자 이메일이 `@gbcommons.org`가 아니면 등록이 거부되는지
- [ ] `dashboard.html`에서 카페 이용 신청 목록(담당자/기관명/인원수)이 조회되는지, 미입력 건이 위로 정렬되는지
- [ ] 대시보드에서 메뉴 입력 후 저장하면 카페이용내역 C열이 갱신되고, 카드가 "입력완료"로 바뀌는지
- [ ] 배포 완료 후 브라우저 개발자도구에서 Apps Script 주소/토큰이 더 이상 보이지 않는지
- [ ] 담당자만 접근하도록, Vercel 배포 URL과 대시보드 URL을 외부에 공개하지 않고 내부적으로만 공유하는지
