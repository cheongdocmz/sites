/* ============================================================
   api/cafe-menu-update.js
   Vercel 서버리스 함수 — 대시보드용 GAS 프로젝트(Code.dashboard.gs)의
   updateCafeMenu를 호출하는 프록시. 카페 담당자가 대시보드에서 실제
   이용 메뉴를 입력하면 여기를 거쳐 카페이용내역 시트를 갱신한다.
============================================================ */

// 서버 재검증 — 클라이언트 검증은 사용자 편의용일 뿐, 신뢰 기준은 항상 여기.
function validate(data) {
  if (!data || typeof data !== 'object') return '요청 형식이 올바르지 않습니다';
  if (!data.recordCode || typeof data.recordCode !== 'string') return '등록코드가 누락되었습니다';
  if (!Array.isArray(data.cafeMenu) || data.cafeMenu.length === 0) return '이용 메뉴가 누락되었습니다';
  if (data.cafeCount !== undefined && data.cafeCount !== '' &&
      (!Number.isFinite(Number(data.cafeCount)) || Number(data.cafeCount) < 1)) {
    return '카페 이용 인원수가 올바르지 않습니다';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: '허용되지 않은 메서드입니다' });
    return;
  }

  const data = req.body;
  const validationError = validate(data);
  if (validationError) {
    res.status(400).json({ success: false, message: validationError });
    return;
  }

  const gasUrl = process.env.GAS_DASHBOARD_WEBHOOK_URL;
  const gasToken = process.env.GAS_DASHBOARD_SECRET_TOKEN;
  if (!gasUrl || !gasToken) {
    res.status(500).json({ success: false, message: '서버 설정 오류입니다. 관리자에게 문의해주세요.' });
    return;
  }

  try {
    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'updateCafeMenu',
        token: gasToken,
        data: JSON.stringify(data)
      })
    });

    if (!gasRes.ok) {
      res.status(502).json({ success: false, message: '저장 서버 응답 오류입니다' });
      return;
    }

    const result = await gasRes.json();
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ success: false, message: '저장 서버에 연결할 수 없습니다' });
  }
}
