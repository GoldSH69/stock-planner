// stock-planner 전용 CORS 프록시 (Cloudflare Worker)
// ============================================================
// 왜 필요한가?
//  - Yahoo Finance는 브라우저 직접 호출을 CORS로 차단하고,
//    corsproxy.io(키 요구 전환)/allorigins/codetabs 등 공용 프록시는
//    Yahoo 봇 차단·속도 제한으로 사실상 전멸 상태입니다.
//  - 이 Worker를 본인 계정에 배포하면 빠르고 안정적인 시세 갱신이 가능합니다.
//
// 배포 (5분, 무료):
//  1. https://dash.cloudflare.com → Workers & Pages → Create → Hello World
//  2. 아래 코드를 worker.js에 붙여넣고 Deploy
//  3. 발급된 https://xxx.workers.dev 주소를
//     stock-planner [설정] → [전용 프록시 URL]에 입력 후 저장
//
// 보안: Yahoo chart API로만 전달되도록 allowlist 고정 + https 강제.
// ============================================================

const ALLOWLIST = /^(query1|query2)\.finance\.yahoo\.com$/;

export default {
  async fetch(req) {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const target = new URL(req.url).searchParams.get("url") || "";
    let dest;
    try {
      dest = new URL(target);
      if (dest.protocol !== "https:" || !ALLOWLIST.test(dest.hostname)) {
        throw new Error("bad url");
      }
    } catch {
      return new Response("bad url (허용: Yahoo Finance chart API만)", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    try {
      const upstream = await fetch(dest.toString(), {
        headers: {
          // Yahoo 봇 차단을 피하기 위한 일반 브라우저 UA
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
      });
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(),
          "Content-Type":
            upstream.headers.get("Content-Type") || "application/json",
          "Cache-Control": "max-age=30",
        },
      });
    } catch (e) {
      return new Response("upstream error", {
        status: 502,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
