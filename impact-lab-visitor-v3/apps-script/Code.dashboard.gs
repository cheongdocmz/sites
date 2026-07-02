/* ============================================================
   apps-script/Code.dashboard.gs — 참고용 스켈레톤

   [중요] 이 파일은 Code.v3.gs(방문 등록용)와 같은 Apps Script
   프로젝트에 넣지 않는다. Apps Script는 프로젝트당 doPost 함수가
   하나뿐이라, 등록 로직과 대시보드 로직을 완전히 분리하려면
   **새 Apps Script 프로젝트**(script.google.com에서 새로 생성)에
   이 코드를 붙여넣어야 한다.

   이 프로젝트는 방문기록 스프레드시트에 컨테이너 바인딩되어 있지
   않으므로 SpreadsheetApp.openById(SPREADSHEET_ID)로 접근한다.

   ------------------------------------------------------------
   [배포 전 준비]
   1. script.google.com에서 새 프로젝트 생성 (기존 등록용 프로젝트와 별개)
   2. 이 파일 내용을 붙여넣는다
   3. Script Properties에 등록:
      - DASHBOARD_SECRET_TOKEN (등록용 SECRET_TOKEN과는 다른 값 사용)
      - SPREADSHEET_ID (방문기록이 쌓이는 스프레드시트 ID)
   4. 웹앱으로 배포 → 이 URL은 Code.v3.gs 쪽 웹앱 URL과 별개
   5. 배포 URL/토큰을 Vercel의 GAS_DASHBOARD_WEBHOOK_URL,
      GAS_DASHBOARD_SECRET_TOKEN 환경변수에 등록
   ------------------------------------------------------------
============================================================ */

const VALID_TOKEN   = PropertiesService.getScriptProperties().getProperty('DASHBOARD_SECRET_TOKEN');
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

const SHEET_NAME_VISIT = '방문기록';
const SHEET_NAME_CAFE  = '카페이용내역';

// 방문기록 시트 컬럼 인덱스 (0-based) — Code.v3.gs의 A~N 구성과 동일해야 한다.
const VISIT_COL = {
  MONTH: 1, DAY: 2, TIME: 3, ORG_NAME: 5, VISITOR_COUNT: 7,
  STAFF_NAME: 9, RECORD_CODE: 11
};

function doPost(e) {
  try {
    const token = e.parameter.token;
    if (token !== VALID_TOKEN) {
      return jsonResponse({ success: false, message: '인증 실패' });
    }

    const action = e.parameter.action;
    if (action === 'listCafeRequests') return handleListCafeRequests();
    if (action === 'updateCafeMenu') return handleUpdateCafeMenu(JSON.parse(e.parameter.data));

    // [보안] 허용 action 화이트리스트 — 그 외 전부 차단
    return jsonResponse({ success: false, message: '허용되지 않은 요청입니다' });
  } catch (err) {
    return jsonResponse({ success: false, message: '처리 중 오류가 발생했습니다' });
  }
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/* ============================================================
   카페 이용 신청 목록 — 카페이용내역 ⋈ 방문기록 (등록코드로 join)
============================================================ */
function handleListCafeRequests() {
  const ss = getSpreadsheet();
  const cafeSheet  = ss.getSheetByName(SHEET_NAME_CAFE);
  const visitSheet = ss.getSheetByName(SHEET_NAME_VISIT);

  const cafeRows  = cafeSheet.getDataRange().getValues().slice(1);   // A등록코드 B등록일시 C이용메뉴 D인원수
  const visitRows = visitSheet.getDataRange().getValues().slice(1);

  const visitByCode = new Map();
  visitRows.forEach(row => visitByCode.set(row[VISIT_COL.RECORD_CODE], row));

  const requests = cafeRows.map(row => {
    const [recordCode, registeredAt, menu, cafeCount] = row;
    const visit = visitByCode.get(recordCode);
    return {
      recordCode: recordCode,
      registeredAt: registeredAt instanceof Date ? registeredAt.toISOString() : String(registeredAt),
      staffName:    visit ? visit[VISIT_COL.STAFF_NAME] : '',
      orgName:      visit ? visit[VISIT_COL.ORG_NAME] : '',
      visitMonth:   visit ? visit[VISIT_COL.MONTH] : '',
      visitDay:     visit ? visit[VISIT_COL.DAY] : '',
      visitTime:    visit ? visit[VISIT_COL.TIME] : '',
      visitorCount: visit ? visit[VISIT_COL.VISITOR_COUNT] : '',
      cafeCount:    cafeCount,
      menu:         menu || '',
      filled:       !!menu
    };
  });

  // 메뉴 미입력 건이 위로 오도록, 그 안에서는 최근 등록순
  requests.sort((a, b) => {
    if (a.filled !== b.filled) return a.filled ? 1 : -1;
    return a.registeredAt < b.registeredAt ? 1 : -1;
  });

  return jsonResponse({ success: true, requests: requests });
}

/* ============================================================
   실제 이용 메뉴 입력/수정 — 등록코드로 카페이용내역 행을 찾아 갱신
============================================================ */
function handleUpdateCafeMenu(data) {
  const recordCode = String(data.recordCode || '').trim();
  const menus = Array.isArray(data.cafeMenu) ? data.cafeMenu : [];
  if (!recordCode || menus.length === 0) {
    return jsonResponse({ success: false, message: '요청이 올바르지 않습니다' });
  }

  const ss = getSpreadsheet();
  const cafeSheet = ss.getSheetByName(SHEET_NAME_CAFE);
  const values = cafeSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === recordCode) {
      cafeSheet.getRange(i + 1, 3).setValue(menus.join(', ')); // C열 이용메뉴
      if (data.cafeCount) {
        cafeSheet.getRange(i + 1, 4).setValue(Number(data.cafeCount)); // D열 인원수
      }
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, message: '해당 등록코드를 찾을 수 없습니다' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
