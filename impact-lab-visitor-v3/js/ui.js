/* ============================================================
   UI 초기화 및 상호작용 (ui.js)
============================================================ */
'use strict';

function initMonthOptions() {
  const sel = document.getElementById('visitMonth');
  const now = new Date();
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m + '월';
    if (m === now.getMonth() + 1) opt.selected = true;
    sel.appendChild(opt);
  }
  updateDayOptions(now.getMonth() + 1);
}

function updateDayOptions(month) {
  const sel = document.getElementById('visitDay');
  const today = new Date().getDate();
  const curMonth = new Date().getMonth() + 1;
  const daysInMonth = new Date(new Date().getFullYear(), month, 0).getDate();
  sel.innerHTML = '<option value="">일 선택</option>';
  for (let d = 1; d <= daysInMonth; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d + '일';
    if (parseInt(month) === curMonth && d === today) opt.selected = true;
    sel.appendChild(opt);
  }
}

function initTimeOptions() {
  const sel = document.getElementById('visitTime');
  const now = new Date();
  const curHour = now.getHours();
  const curMin = now.getMinutes();
  const roundedMin = Math.round(curMin / 30) * 30 % 60;
  const adjustedHour = curMin >= 45 ? (curHour + 1) % 24 : curHour;
  const autoTime = String(adjustedHour).padStart(2,'0') + ':' + String(roundedMin).padStart(2,'0');
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const val = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (val === autoTime) opt.selected = true;
      sel.appendChild(opt);
    }
  }
}

function initPurposeOptions() {
  const sel = document.getElementById('visitPurpose');
  sel.innerHTML = '<option value="">목적 선택</option>';
  DEFAULT_PURPOSES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

/* ============================================================
   청도군내 여부 라디오 필 (segmented control)
============================================================ */
function syncRadioPillState(groupName) {
  document.querySelectorAll(`.radio-pill[data-group="${groupName}"]`).forEach(pill => {
    const input = pill.querySelector('input');
    pill.classList.toggle('checked', input.checked);
  });
}

function selectRadioPill(groupName, value) {
  const input = document.querySelector(`input[name="${groupName}"][value="${value}"]`);
  if (input) input.checked = true;
  syncRadioPillState(groupName);
  clearError(groupName + 'Group');
}

/* ============================================================
   카페 이용 여부 — 방문 목적과 무관한 독립 토글
============================================================ */
function toggleCafeUsage() {
  const cb = document.getElementById('cafeUsage');
  cb.checked = !cb.checked;
  document.getElementById('cafeToggleBox').classList.toggle('checked', cb.checked);
  document.getElementById('cafeDetailGroup').classList.toggle('show', cb.checked);
  if (cb.checked) {
    // 카페 이용 인원수 기본값 = 방문 인원수
    const visitorCount = document.getElementById('visitorCount').value;
    const cafeCount = document.getElementById('cafeCount');
    if (visitorCount && !cafeCount.value) cafeCount.value = visitorCount;
  } else {
    clearError('cafeCount');
  }
}

/* ============================================================
   메모 카운터
============================================================ */
function setupMemoCounter() {
  const memo = document.getElementById('memo');
  const cnt  = document.getElementById('memoCount');
  memo.addEventListener('input', () => { cnt.textContent = memo.value.length; });
}

/* ============================================================
   스크롤 진행 바
============================================================ */
function setupProgressBar() {
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
    document.getElementById('progressBar').style.width = pct + '%';
  });
}

/* ============================================================
   인원수 +/- 스테퍼 버튼
============================================================ */
function stepCount(inputId, delta) {
  const input = document.getElementById(inputId);
  const next = Math.max(1, (parseInt(input.value, 10) || 0) + delta);
  input.value = next;
  clearError(inputId);
}
