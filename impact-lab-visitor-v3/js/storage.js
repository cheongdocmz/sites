/* ============================================================
   담당자 자동 인식 (storage.js)
   주의: 여기서 다루는 값은 브라우저 localStorage에 평문 저장된다.
   담당자 이메일·이름만 다루며, 서버 토큰류는 절대 이 파일에 두지 않는다.
   (기존 버전은 방문자 개인정보를 저장했으나, 이제는 방문 기록을
   대신 입력하는 담당자 본인의 정보만 기억한다.)
============================================================ */
'use strict';

function checkAndLoadSavedInfo() {
  const raw = localStorage.getItem('staffInfo');
  if (!raw) return;
  try {
    const info = JSON.parse(raw);
    if (!info.staffEmail && !info.staffName) return;

    document.getElementById('staffEmail').value = info.staffEmail || '';
    document.getElementById('staffName').value  = info.staffName  || '';

    document.getElementById('returningName').textContent = info.staffName || info.staffEmail || '';
    document.getElementById('returningBanner').classList.add('show');
    enableReturningStaffMode();
  } catch (e) { localStorage.removeItem('staffInfo'); }
}

function enableReturningStaffMode() {
  ['staffEmail', 'staffName'].forEach(id => {
    const f = document.getElementById(id);
    if (!f || !f.value) return;
    f.readOnly = true;
    f.style.backgroundColor = '#f1f5f9';
    f.style.cursor = 'not-allowed';
  });
}

function enableEditMode() {
  ['staffEmail', 'staffName'].forEach(id => {
    const f = document.getElementById(id);
    if (!f) return;
    f.readOnly = false;
    f.style.backgroundColor = '';
    f.style.cursor = '';
  });
  document.getElementById('returningBanner').classList.remove('show');
}

function clearSavedInfo() {
  localStorage.removeItem('staffInfo');
  location.reload();
}

function saveStaffInfo() {
  const info = {
    staffEmail: document.getElementById('staffEmail').value.trim(),
    staffName:  document.getElementById('staffName').value.trim()
  };
  localStorage.setItem('staffInfo', JSON.stringify(info));
}
