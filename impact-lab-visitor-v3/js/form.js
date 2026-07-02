/* ============================================================
   폼 진입점 (form.js)
   [보안] 이 파일에는 Apps Script URL도, 비밀 토큰도 없다.
   브라우저는 '/api/register-visitor' 라는 우리 서버 내부 경로만 안다.
   실제 Google Apps Script 주소와 토큰은 Vercel 서버리스 함수(api/register-visitor.js)
   안, 즉 서버 환경변수에만 존재하고 클라이언트 번들에는 절대 포함되지 않는다.
============================================================ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initMonthOptions();
  initTimeOptions();
  initPurposeOptions();
  checkAndLoadSavedInfo();
  setupMemoCounter();
  setupProgressBar();
});

async function handleSubmit() {
  if (!validateForm()) {
    const firstError = document.querySelector('.error-message.show');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // ============================================================
  // [보안] Honeypot 체크 — 봇 감지 시 Silent Drop
  // ============================================================
  if (isBot()) {
    document.getElementById('recordCodeDisplay').textContent = 'V---------';
    document.getElementById('successOverlay').classList.add('show');
    return;
  }

  const disabledFields = ['staffEmail', 'staffName'];
  disabledFields.forEach(id => {
    const f = document.getElementById(id);
    if (f) { f.readOnly = false; }
  });

  const inCheongdoEl = document.querySelector('input[name="inCheongdo"]:checked');
  const cafeUsage = document.getElementById('cafeUsage').checked;

  // ============================================================
  // [보안] 텍스트 입력값 전체 sanitize 후 전송
  // 서버(api/register-visitor.js)에서도 동일 항목을 다시 검증한다 — 클라이언트 검증은
  // 사용자 편의용일 뿐, 신뢰의 기준은 항상 서버 쪽 재검증이다.
  // ============================================================
  const visitData = {
    staffEmail:   sanitizeInput(document.getElementById('staffEmail').value.trim().toLowerCase()),
    staffName:    sanitizeInput(document.getElementById('staffName').value),
    visitMonth:   document.getElementById('visitMonth').value,
    visitDay:     document.getElementById('visitDay').value,
    visitTime:    document.getElementById('visitTime').value,
    visitPurpose: document.getElementById('visitPurpose').value,
    orgName:      sanitizeInput(document.getElementById('orgName').value),
    inCheongdo:   inCheongdoEl ? inCheongdoEl.value : '',
    visitorCount: document.getElementById('visitorCount').value,
    memo:         sanitizeInput(document.getElementById('memo').value),
    cafeUsage:    cafeUsage,
    // 이용 메뉴는 등록 시점엔 받지 않는다 — 대시보드(/dashboard.html)에서 나중에 입력
    cafeCount:    cafeUsage ? document.getElementById('cafeCount').value : ''
  };

  document.getElementById('loadingOverlay').classList.add('show');
  document.getElementById('submitBtn').disabled = true;

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch('/api/register-visitor', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitData)
    });
    clearTimeout(timer);
    const result = await res.json();

    document.getElementById('loadingOverlay').classList.remove('show');

    if (result.success) {
      saveStaffInfo();
      document.getElementById('recordCodeDisplay').textContent = result.recordCode || 'V---------';
      document.getElementById('successOverlay').classList.add('show');
    } else {
      alert('저장 실패: ' + (result.message || '알 수 없는 오류가 발생했습니다.'));
      document.getElementById('submitBtn').disabled = false;
    }
  } catch (err) {
    clearTimeout(timer);
    document.getElementById('loadingOverlay').classList.remove('show');
    if (err.name === 'AbortError') {
      alert('응답 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.');
    } else {
      alert('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    document.getElementById('submitBtn').disabled = false;
  }
}

function resetAfterSuccess() {
  document.getElementById('successOverlay').classList.remove('show');
  clearForm();
  setTimeout(() => location.reload(), 200);
}

function clearForm() {
  document.getElementById('visitPurpose').value = '';
  document.getElementById('orgName').value = '';
  document.getElementById('visitorCount').value = '1';
  document.getElementById('memo').value = '';
  document.getElementById('memoCount').textContent = '0';
  document.querySelectorAll('input[name="inCheongdo"]').forEach(el => el.checked = false);
  syncRadioPillState('inCheongdo');
  document.getElementById('cafeUsage').checked = false;
  document.getElementById('cafeToggleBox').classList.remove('checked');
  document.getElementById('cafeDetailGroup').classList.remove('show');
  document.getElementById('cafeCount').value = '';
  document.getElementById('submitBtn').disabled = false;
}
