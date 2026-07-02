/* ============================================================
   대시보드 (dashboard.js)
   카페 이용 신청 목록 조회 + 실제 이용 메뉴 입력.
   [보안] 이 파일에는 GAS 주소도 토큰도 없다 — '/api/cafe-requests',
   '/api/cafe-menu-update'라는 우리 서버 내부 경로만 안다.
============================================================ */
'use strict';

let currentRequests = [];
let currentRecordCode = null;

document.addEventListener('DOMContentLoaded', loadRequests);

async function loadRequests() {
  const list = document.getElementById('dashList');
  const summary = document.getElementById('dashSummary');
  const refreshBtn = document.getElementById('refreshBtn');

  refreshBtn.disabled = true;
  summary.textContent = '불러오는 중...';

  try {
    const res = await fetch('/api/cafe-requests');
    const data = await res.json();

    if (!data.success || !Array.isArray(data.requests)) {
      list.innerHTML = '<div class="dash-error">목록을 불러오지 못했습니다. 새로고침해주세요.</div>';
      summary.textContent = '';
      return;
    }

    currentRequests = data.requests;
    renderList(currentRequests);

    const pending = currentRequests.filter(r => !r.filled).length;
    summary.textContent = `전체 ${currentRequests.length}건 · 메뉴 미입력 ${pending}건`;
  } catch (e) {
    list.innerHTML = '<div class="dash-error">서버에 연결할 수 없습니다. 새로고침해주세요.</div>';
    summary.textContent = '';
  } finally {
    refreshBtn.disabled = false;
  }
}

function renderList(requests) {
  const list = document.getElementById('dashList');

  if (requests.length === 0) {
    list.innerHTML = '<div class="dash-empty">카페 이용 신청 내역이 없습니다.</div>';
    return;
  }

  list.innerHTML = requests.map(r => `
    <div class="dash-card ${r.filled ? 'filled' : ''}" onclick="openMenuModal('${escapeAttr(r.recordCode)}')">
      <div class="dash-card-top">
        <div class="dash-card-org">${escapeHtml(r.orgName || '(기관명 없음)')}</div>
        <span class="dash-badge ${r.filled ? 'filled' : 'pending'}">${r.filled ? '입력완료' : '메뉴 미입력'}</span>
      </div>
      <div class="dash-card-meta">
        <span>담당 ${escapeHtml(r.staffName || '-')}</span>
        <span>${escapeHtml(String(r.visitMonth || ''))}월 ${escapeHtml(String(r.visitDay || ''))}일 ${escapeHtml(r.visitTime || '')}</span>
        <span>방문 ${escapeHtml(String(r.visitorCount || '-'))}명 · 카페 ${escapeHtml(String(r.cafeCount || '-'))}명</span>
      </div>
      ${r.filled ? `<div class="dash-card-menu">${escapeHtml(r.menu)}</div>` : ''}
    </div>
  `).join('');
}

/* ============================================================
   메뉴 입력 모달
============================================================ */
function openMenuModal(recordCode) {
  const req = currentRequests.find(r => r.recordCode === recordCode);
  if (!req) return;

  currentRecordCode = recordCode;
  document.getElementById('menuModalSub').textContent =
    `${req.orgName || ''} · 담당 ${req.staffName || ''}`;
  document.getElementById('dashCafeCount').value = req.cafeCount || '';
  document.getElementById('dashMenuGroupError').classList.remove('show');

  loadMenuOptionsForModal(req.menu ? req.menu.split(',').map(s => s.trim()) : []);

  document.getElementById('menuModalOverlay').classList.add('show');
}

function closeMenuModal() {
  document.getElementById('menuModalOverlay').classList.remove('show');
  currentRecordCode = null;
}

async function loadMenuOptionsForModal(preChecked) {
  const group = document.getElementById('dashMenuChipGroup');
  group.innerHTML = '<span class="menu-chip loading">메뉴 불러오는 중...</span>';
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    const menus = (data.success && Array.isArray(data.menus)) ? data.menus : [];
    if (menus.length === 0) {
      group.innerHTML = '<span class="menu-chip empty">등록된 메뉴가 없습니다</span>';
      return;
    }
    group.innerHTML = menus.map((name, i) => `
      <label class="menu-chip ${preChecked.includes(name) ? 'checked' : ''}" data-index="${i}">
        <input type="checkbox" name="dashCafeMenu" value="${escapeAttr(name)}"
               ${preChecked.includes(name) ? 'checked' : ''}
               onchange="this.closest('.menu-chip').classList.toggle('checked', this.checked)">
        ${escapeHtml(name)}
      </label>
    `).join('');
  } catch (e) {
    group.innerHTML = '<span class="menu-chip empty">메뉴를 불러오지 못했습니다 (다시 시도해주세요)</span>';
  }
}

function stepDashCount(delta) {
  const input = document.getElementById('dashCafeCount');
  const next = Math.max(1, (parseInt(input.value, 10) || 0) + delta);
  input.value = next;
}

async function submitMenu() {
  if (!currentRecordCode) return;

  const menus = Array.from(document.querySelectorAll('input[name="dashCafeMenu"]:checked')).map(el => el.value);
  if (menus.length === 0) {
    document.getElementById('dashMenuGroupError').classList.add('show');
    return;
  }

  const saveBtn = document.getElementById('menuModalSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중...';

  try {
    const res = await fetch('/api/cafe-menu-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordCode: currentRecordCode,
        cafeMenu: menus,
        cafeCount: document.getElementById('dashCafeCount').value
      })
    });
    const result = await res.json();

    if (result.success) {
      const req = currentRequests.find(r => r.recordCode === currentRecordCode);
      if (req) {
        req.menu = menus.join(', ');
        req.filled = true;
        if (document.getElementById('dashCafeCount').value) {
          req.cafeCount = document.getElementById('dashCafeCount').value;
        }
      }
      renderList(currentRequests);
      closeMenuModal();
    } else {
      alert('저장 실패: ' + (result.message || '알 수 없는 오류가 발생했습니다.'));
    }
  } catch (e) {
    alert('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '저장';
  }
}

/* ============================================================
   XSS 방지 — 서버 응답값을 innerHTML에 꽂기 전에 escape
============================================================ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
function escapeAttr(str) {
  return escapeHtml(str);
}
