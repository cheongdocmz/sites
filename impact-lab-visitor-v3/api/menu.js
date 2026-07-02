/* ============================================================
   api/menu.js
   구글시트 '카페메뉴설정' 탭을 실시간으로 읽어오는 프록시.
   메뉴가 바뀌면 시트만 수정하면 되고, 이 코드나 프론트를 다시 배포할 필요가 없다.

   메모리 캐시(5분)를 두는 이유: 방문자마다 폼을 열 때 매번 Apps Script를
   호출하면 Google 쪽 호출 한도에 영향을 줄 수 있어, 짧게만 캐싱한다.
   메뉴를 급하게 반영해야 하면 Vercel에서 함수를 재배포하면 캐시가 초기화된다.
============================================================ */

let menuCache = { data: null, ts: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: '허용되지 않은 메서드입니다' });
    return;
  }

  const now = Date.now();
  if (menuCache.data && (now - menuCache.ts) < CACHE_TTL_MS) {
    res.status(200).json({ success: true, menus: menuCache.data });
    return;
  }

  const gasUrl = process.env.GAS_WEBHOOK_URL;
  const gasToken = process.env.GAS_SECRET_TOKEN;
  if (!gasUrl || !gasToken) {
    res.status(500).json({ success: false, message: '서버 설정 오류입니다. 관리자에게 문의해주세요.' });
    return;
  }

  try {
    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ action: 'getMenu', token: gasToken })
    });

    if (!gasRes.ok) {
      res.status(502).json({ success: false, message: '메뉴 서버 응답 오류입니다' });
      return;
    }

    const result = await gasRes.json();
    if (result.success && Array.isArray(result.menus)) {
      menuCache = { data: result.menus, ts: now };
    }
    res.status(200).json(result);
  } catch (err) {
    // 메뉴 조회 실패는 등록 자체를 막으면 안 되므로, 프론트가 빈 목록으로 처리하도록
    // success:false만 반환하고 500이 아닌 200으로 내려도 무방하다 (여기선 502 유지).
    res.status(502).json({ success: false, message: '메뉴 서버에 연결할 수 없습니다' });
  }
}
