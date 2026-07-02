/* ============================================================
   apps-script/Code.v3.gs — 참고용 스켈레톤
   (v3: 방문자 개인정보 제거 → 담당자·기관 중심 데이터 모델 + 캘린더 자동등록)

   [중요] 이 파일은 실제 운영 중인 Apps Script A의 전체 코드를 대체하는
   것이 아니다. 기존 Code.gs에 아래 내용을 병합할 것.

   ------------------------------------------------------------
   v3에서 바뀐 점 (v2 → v3)
   - 방문자 개인 인적사항(이름/성별/출생년도/연락처/거주지) 필드를 전부 제거.
     이제 이 폼은 "방문자 본인 등록"이 아니라 "담당자가 방문 기록을 대신
     입력하는" 용도이므로, 개인정보 수집 동의 절차도 함께 제거되었다.
   - 대신 담당자 이메일(staffEmail, @gbcommons.org)과 담당자 이름(staffName)을
     새로 받는다. 담당자 이메일 도메인은 서버(api/register-visitor.js)에서도
     한 번 더 검증하지만, Apps Script 쪽에서도 방어적으로 한 번 더 확인한다.
   - 응답 필드명을 visitorCode → recordCode로 변경했다 (개인 방문자 식별이
     아니라 "방문 기록"의 식별자라는 의미를 명확히 하기 위함).
   - 방문기록 시트 컬럼 구성이 A~R(18개)에서 A~N(14개)로 줄어든다.
     기존 시트를 그대로 쓰지 말고, 아래 "배포 전 준비"에 따라 시트를
     다시 구성할 것을 권장한다 (기존 데이터는 별도 탭으로 보관 후 참고).

   ------------------------------------------------------------
   [배포 전 준비]
   1. 방문기록 시트 컬럼을 아래 순서로 재구성한다 (헤더 행 포함):
      A 등록일시   B 방문월   C 방문일   D 방문시간   E 방문목적
      F 방문기관/업체명   G 청도군내여부   H 방문인원수
      I 담당자이메일   J 담당자이름   K 비고   L 등록코드
      M 캘린더이벤트ID   N 캘린더동기화상태
   2. 카페이용내역 / 카페메뉴설정 탭은 기존과 동일하게 유지
      (카페이용내역 A열의 "방문자코드"는 이제 "등록코드"와 같은 값)
   3. 공유 캘린더 준비 → 캘린더 ID를 Script Properties의 CALENDAR_ID로 등록
   4. 프로젝트 시간대가 Asia/Seoul인지 확인
   5. 웹앱 재배포 시 최초 1회 캘린더 접근 권한 재승인 필요
   ------------------------------------------------------------
============================================================ */

const VALID_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
const CALENDAR_ID = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');

const SHEET_NAME_VISIT = '방문기록';
const SHEET_NAME_CAFE  = '카페이용내역';
const SHEET_NAME_MENU  = '카페메뉴설정';

const STAFF_EMAIL_DOMAIN = '@gbcommons.org';

// 방문 목적별 기본 소요 시간(분) — 실제 운영 패턴에 맞춰 조정
const DURATION_BY_PURPOSE_MIN = {
  '프로그램 참여': 120,
  '행사운영 및 주최': 180,
  '장비 및 시설이용(회의)': 60,
  '비즈니스 미팅(투자/MOU)': 60
};
const DEFAULT_DURATION_MIN = 60;

// 방문 목적별 캘린더 색상 (선택 사항)
const EVENT_COLOR_BY_PURPOSE = {
  '프로그램 참여': CalendarApp.EventColor.PALE_BLUE,
  '행사운영 및 주최': CalendarApp.EventColor.PALE_RED,
  '장비 및 시설이용(회의)': CalendarApp.EventColor.PALE_GREEN,
  '비즈니스 미팅(투자/MOU)': CalendarApp.EventColor.MAUVE
};

function doPost(e) {
  try {
    const token = e.parameter.token;
    if (token !== VALID_TOKEN) {
      return jsonResponse({ success: false, message: '인증 실패' });
    }

    const action = e.parameter.action;
    if (action === 'addVisitor') {
      return handleAddVisit(JSON.parse(e.parameter.data));
    }
    if (action === 'getMenu') {
      return handleGetMenu();
    }

    // [보안] 허용 action 화이트리스트 — 그 외 전부 차단
    return jsonResponse({ success: false, message: '허용되지 않은 요청입니다' });
  } catch (err) {
    // [보안] 상세 에러 대신 단순 메시지만 반환 (내부 구조 노출 방지)
    return jsonResponse({ success: false, message: '처리 중 오류가 발생했습니다' });
  }
}

function handleAddVisit(data) {
  // 방어적 재검증 — 서버(api/register-visitor.js)에서 이미 걸러지지만
  // Apps Script가 다른 경로로 직접 호출될 가능성에도 대비한다.
  const staffEmail = String(data.staffEmail || '').trim().toLowerCase();
  if (!staffEmail.endsWith(STAFF_EMAIL_DOMAIN)) {
    return jsonResponse({ success: false, message: '담당자 이메일이 올바르지 않습니다' });
  }

  const recordCode = generateRecordCode(data.orgName, staffEmail);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_VISIT);

  // [fail-soft] 캘린더 등록이 실패해도 방문 기록(시트 기록) 자체는 막지 않는다.
  const calendarResult = tryCreateCalendarEvent(data, recordCode);

  sheet.appendRow([
    new Date(),                          // A 등록일시
    data.visitMonth,                     // B
    data.visitDay,                       // C
    data.visitTime,                      // D
    data.visitPurpose,                   // E
    data.orgName,                        // F
    data.inCheongdo,                     // G
    data.visitorCount,                   // H
    staffEmail,                          // I 담당자 이메일
    data.staffName,                      // J 담당자 이름
    data.memo,                           // K
    recordCode,                          // L 등록코드
    calendarResult.eventId || '',        // M 캘린더 이벤트ID
    calendarResult.success ? '성공' : '실패'  // N 캘린더 동기화 상태
  ]);

  // 카페 이용 체크 시에만 카페이용내역 시트에 추가 기록.
  // 이용 메뉴(C열)는 등록 시점엔 비워두고, 대시보드(Code.dashboard.gs의
  // updateCafeMenu)에서 실제 이용 시점에 채운다.
  if (data.cafeUsage) {
    const cafeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_CAFE);
    cafeSheet.appendRow([
      recordCode,                        // A 등록코드 (방문기록 시트와 연결)
      new Date(),                        // B 등록일시
      (data.cafeMenu || []).join(', '),  // C 이용 메뉴 — 등록 시엔 빈 값
      data.cafeCount                     // D 카페 이용 인원수
    ]);
  }

  return jsonResponse({ success: true, recordCode: recordCode });
}

/* ============================================================
   구글 캘린더 자동 등록
============================================================ */
function tryCreateCalendarEvent(data, recordCode) {
  if (!CALENDAR_ID) {
    Logger.log('CALENDAR_ID가 설정되지 않아 캘린더 등록을 건너뜁니다.');
    return { success: false, eventId: null };
  }

  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) {
      Logger.log('CALENDAR_ID로 캘린더를 찾을 수 없습니다: ' + CALENDAR_ID);
      return { success: false, eventId: null };
    }

    const { startTime, endTime } = buildEventTimeRange(data);
    const title = buildEventTitle(data);
    const description = buildEventDescription(data, recordCode);

    const event = calendar.createEvent(title, startTime, endTime, {
      description: description,
      location: '청도혁신센터 임팩트랩'
    });

    const colorId = EVENT_COLOR_BY_PURPOSE[data.visitPurpose];
    if (colorId) event.setColor(colorId);

    return { success: true, eventId: event.getId() };
  } catch (err) {
    Logger.log('캘린더 등록 실패: ' + err);
    return { success: false, eventId: null };
  }
}

// 폼은 연도를 받지 않으므로 현재 연도 기준으로 날짜를 구성한다.
function buildEventTimeRange(data) {
  const year  = new Date().getFullYear();
  const month = Number(data.visitMonth) - 1; // JS Date는 0-based month
  const day   = Number(data.visitDay);
  const [hour, minute] = String(data.visitTime).split(':').map(Number);

  const startTime = new Date(year, month, day, hour, minute);
  const durationMin = DURATION_BY_PURPOSE_MIN[data.visitPurpose] || DEFAULT_DURATION_MIN;
  const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

  return { startTime, endTime };
}

function buildEventTitle(data) {
  const count = Number(data.visitorCount) || 1;
  return `[방문] ${data.orgName} (${count}명) · 담당 ${data.staffName}`;
}

function buildEventDescription(data, recordCode) {
  const lines = [
    `방문 목적: ${data.visitPurpose}`,
    `방문 기관/업체: ${data.orgName} (${data.inCheongdo})`,
    `방문 인원: ${data.visitorCount}명`,
    `담당자: ${data.staffName} (${data.staffEmail})`
  ];
  if (data.cafeUsage) {
    lines.push(`카페 이용: ${(data.cafeMenu || []).join(', ') || '-'} (${data.cafeCount}명)`);
  }
  if (data.memo) {
    lines.push(`비고: ${data.memo}`);
  }
  lines.push(`등록 코드: ${recordCode}`);
  return lines.join('\n');
}

function handleGetMenu() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_MENU);
  const rows = sheet.getDataRange().getValues();
  const menus = rows.slice(1)
    .filter(r => r[1] === true || r[1] === 'TRUE')
    .sort((a, b) => (Number(a[2]) || 0) - (Number(b[2]) || 0))
    .map(r => r[0]);
  return jsonResponse({ success: true, menus: menus });
}

// [참고] 실제 운영 중인 해시 로직으로 교체할 것 — 이건 예시 구현.
// 더 이상 개인 방문자를 식별하는 코드가 아니라 "이 방문 기록 한 건"을
// 가리키는 코드이므로, 기관명 + 담당자 이메일 + 타임스탬프로 생성한다.
function generateRecordCode(orgName, staffEmail) {
  const raw = String(orgName) + String(staffEmail) + new Date().getTime();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  const hex = digest.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0')).join('');
  return 'V-' + hex.substring(0, 9).toUpperCase();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   [향후 확장 아이디어 — 이번 버전엔 미포함]
   - 슬롯 정원 체크: 같은 시간대에 등록된 방문 인원 합산 후 정원 초과 시 알림
   - 방문 하루 전 리마인더: 트리거(시간 기반)로 다음날 방문 목록을 모아
     담당자에게 이메일/슬랙 발송
   - 담당자 이메일 화이트리스트: STAFF_EMAIL_DOMAIN만으로는 재직 여부까지는
     확인할 수 없으므로, 필요하면 사내 인사 시트와 대조하는 로직 추가
============================================================ */
