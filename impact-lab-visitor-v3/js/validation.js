/* ============================================================
   입력 검증 (validation.js)
============================================================ */
'use strict';

/* ============================================================
   [보안] 입력값 Sanitize (XSS 방지)
============================================================ */
function sanitizeInput(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/* ============================================================
   [보안] Honeypot 감지
============================================================ */
function isBot() {
  return document.getElementById('website').value.length > 0;
}

/* ============================================================
   담당자 이메일 형식 검증 — STAFF_EMAIL_DOMAIN 도메인만 허용
============================================================ */
function isValidStaffEmail(email) {
  const domain = STAFF_EMAIL_DOMAIN.toLowerCase();
  const value = String(email || '').trim().toLowerCase();
  if (!value.endsWith(domain)) return false;
  // 아주 기본적인 이메일 형식 체크 (도메인 앞에 최소 1글자 이상)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(fieldId + 'Error');
  if (field) field.classList.add('error');
  if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
}

function clearError(fieldId) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(fieldId + 'Error');
  if (field) field.classList.remove('error');
  if (errEl) errEl.classList.remove('show');
}

/* ============================================================
   폼 전체 검증
============================================================ */
function validateForm() {
  let isValid = true;

  const staffEmail = document.getElementById('staffEmail').value.trim();
  if (!isValidStaffEmail(staffEmail)) {
    showError('staffEmail', `${STAFF_EMAIL_DOMAIN} 형식의 이메일을 입력해주세요`); isValid = false;
  }
  const staffName = document.getElementById('staffName').value.trim();
  if (staffName.length < 2) {
    showError('staffName', '담당자 이름을 2자 이상 입력해주세요'); isValid = false;
  }

  if (!document.getElementById('visitMonth').value) {
    showError('visitMonth', '방문 월을 선택해주세요'); isValid = false;
  }
  if (!document.getElementById('visitDay').value) {
    showError('visitDay', '방문 일을 선택해주세요'); isValid = false;
  }
  if (!document.getElementById('visitTime').value) {
    showError('visitTime', '방문 시간을 선택해주세요'); isValid = false;
  }
  if (!document.getElementById('visitPurpose').value) {
    showError('visitPurpose', '방문 목적을 선택해주세요'); isValid = false;
  }

  const orgName = document.getElementById('orgName').value.trim();
  if (orgName.length < 2) {
    showError('orgName', '방문 기관/업체명을 입력해주세요'); isValid = false;
  }
  if (!document.querySelector('input[name="inCheongdo"]:checked')) {
    showError('inCheongdoGroup', '청도군내 여부를 선택해주세요'); isValid = false;
  }
  const visitorCount = parseInt(document.getElementById('visitorCount').value, 10);
  if (!visitorCount || visitorCount < 1) {
    showError('visitorCount', '방문 인원수를 입력해주세요'); isValid = false;
  }

  // 카페 이용 체크 시에만 검증 (방문목적과 무관한 독립 항목)
  // 메뉴는 등록 시점에 받지 않는다 — 실제 이용 메뉴는 대시보드에서 나중에 입력한다.
  if (document.getElementById('cafeUsage').checked) {
    const cafeCount = parseInt(document.getElementById('cafeCount').value, 10);
    if (!cafeCount || cafeCount < 1) {
      showError('cafeCount', '카페 이용 인원수를 입력해주세요'); isValid = false;
    }
  }

  return isValid;
}
