/* ============================================================
   api/cafe-requests.js
   Vercel 서버리스 함수 — 대시보드용 GAS 프로젝트(Code.dashboard.gs)의
   listCafeRequests를 호출하는 프록시. 카페 이용 신청 목록을 그대로 반환한다.

   [보안] GAS_DASHBOARD_WEBHOOK_URL, GAS_DASHBOARD_SECRET_TOKEN은
   등록용(GAS_WEBHOOK_URL, GAS_SECRET_TOKEN)과 별개의 환경변수다.
   대시보드는 인증 없이 URL 공유만으로 접근하므로, 이 토큰이 유출돼도
   방문 등록 쪽(addVisitor)에는 영향이 없도록 분리해둔다.
============================================================ */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: '허용되지 않은 메서드입니다' });
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
      body: new URLSearchParams({ action: 'listCafeRequests', token: gasToken })
    });

    if (!gasRes.ok) {
      res.status(502).json({ success: false, message: '목록 서버 응답 오류입니다' });
      return;
    }

    const result = await gasRes.json();
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ success: false, message: '목록 서버에 연결할 수 없습니다' });
  }
}
