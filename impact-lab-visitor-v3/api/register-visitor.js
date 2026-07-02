/* ============================================================
   api/register-visitor.js
   Vercel 서버리스 함수 — 브라우저와 Google Apps Script 사이의 프록시.

   [보안] GAS_WEBHOOK_URL, GAS_SECRET_TOKEN은 Vercel 프로젝트의
   환경변수(Settings > Environment Variables)에만 저장한다.
   이 파일 안에 실제 URL이나 토큰 값을 절대 하드코딩하지 않는다.
   클라이언트(js/form.js)는 이 함수의 경로('/api/register-visitor')만 알고,
   Apps Script 주소 자체를 모른다 — 브라우저에서 직접 Apps Script를
   호출할 방법이 없어진다.
============================================================ */

// 최소한의 요청 빈도 제한 (best-effort)
// 주의: Vercel 서버리스 함수는 인스턴스가 재사용되지 않을 수 있어
// 이 in-memory Map은 완벽한 rate limit이 아니다. 트래픽이 늘어나면
// Vercel KV 또는 Upstash Redis 같은 외부 저장소로 교체할 것.
const requestLog = new Map();
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 5;

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

// 담당자 이메일은 이 도메인 소속만 허용한다. 프론트(js/config.js)와 값을 맞춰둔다.
const STAFF_EMAIL_DOMAIN = '@gbcommons.org';

// 서버 재검증 — 클라이언트 검증은 사용자 편의용일 뿐, 신뢰 기준은 항상 여기.
function validate(data) {
  if (!data || typeof data !== 'object') return '요청 형식이 올바르지 않습니다';

  const staffEmail = String(data.staffEmail || '').trim().toLowerCase();
  if (!staffEmail.endsWith(STAFF_EMAIL_DOMAIN) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) {
    return '담당자 이메일이 올바르지 않습니다';
  }
  if (!data.staffName || String(data.staffName).trim().length < 2) return '담당자 이름이 누락되었습니다';

  if (!data.visitMonth || !data.visitDay || !data.visitTime) return '방문 일시가 누락되었습니다';
  if (!data.visitPurpose) return '방문 목적이 누락되었습니다';
  if (!data.orgName || String(data.orgName).trim().length < 2) return '방문 기관/업체명이 누락되었습니다';
  if (data.inCheongdo !== '청도군내' && data.inCheongdo !== '청도군외') return '청도군내 여부가 올바르지 않습니다';
  if (!Number.isFinite(Number(data.visitorCount)) || Number(data.visitorCount) < 1) return '방문 인원수가 올바르지 않습니다';

  // 이용 메뉴는 등록 시점엔 받지 않는다 — 대시보드에서 나중에 입력한다.
  if (data.cafeUsage) {
    if (!Number.isFinite(Number(data.cafeCount)) || Number(data.cafeCount) < 1) return '카페 이용 인원수가 올바르지 않습니다';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: '허용되지 않은 메서드입니다' });
    return;
  }

  if (isRateLimited(getClientIp(req))) {
    res.status(429).json({ success: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' });
    return;
  }

  const data = req.body;
  const validationError = validate(data);
  if (validationError) {
    res.status(400).json({ success: false, message: validationError });
    return;
  }

  const gasUrl = process.env.GAS_WEBHOOK_URL;
  const gasToken = process.env.GAS_SECRET_TOKEN;
  if (!gasUrl || !gasToken) {
    // 환경변수 미설정 상태 — 배포 설정 실수를 조용히 삼키지 않고 바로 알린다.
    res.status(500).json({ success: false, message: '서버 설정 오류입니다. 관리자에게 문의해주세요.' });
    return;
  }

  try {
    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'addVisitor',
        token: gasToken,
        data: JSON.stringify(data)
      })
    });

    if (!gasRes.ok) {
      res.status(502).json({ success: false, message: '등록 서버 응답 오류입니다' });
      return;
    }

    const result = await gasRes.json();
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ success: false, message: '등록 서버에 연결할 수 없습니다' });
  }
}
