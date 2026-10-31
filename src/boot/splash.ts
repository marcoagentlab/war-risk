/**
 * 첫 진입·새로고침 로딩 화면(스플래시). 빌드 시 vite 플러그인이 각 페이지 HTML에 인라인으로 넣음
 * → CSS/JS 번들보다 먼저 그려져 흰 화면 깜빡임 없음.
 * 숨김: 각 엔트리 boot()가 끝나면 window.__splashDone() 호출(DOM + /api/live 1회 시도 후).
 * 안전장치: 최대 2.8초 뒤 자동 제거(/api/live 실패·JS 오류여도 멈추지 않음). JS 꺼짐이면 noscript로 숨김.
 * 점수·판정 로직과 무관.
 */
const CSS = `html{background:#040b16}
#boot-splash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
background:radial-gradient(800px 420px at 50% 35%,rgba(34,211,238,.10),transparent 65%),#040b16;color:#e6f1ff;
font:500 15px/1.4 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR","Malgun Gothic",sans-serif;
transition:opacity .35s ease,visibility .35s ease}
#boot-splash.bs-out{opacity:0;visibility:hidden;pointer-events:none}
#boot-splash .bs-radar{position:relative;width:76px;height:76px;border-radius:50%;border:1px solid rgba(34,211,238,.38);
box-shadow:0 0 0 12px rgba(34,211,238,.04),inset 0 0 18px rgba(34,211,238,.12);overflow:hidden}
#boot-splash .bs-radar::before{content:"";position:absolute;inset:0;border-radius:50%;
background:conic-gradient(from 0deg,rgba(34,211,238,.55),rgba(34,211,238,0) 70deg,transparent 360deg);animation:bs-spin 1.4s linear infinite}
#boot-splash .bs-radar::after{content:"";position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#22d3ee;box-shadow:0 0 12px #22d3ee}
#boot-splash .bs-title{font-weight:700;letter-spacing:.02em}
#boot-splash .bs-sub{color:#8aa0bd;font-size:13px}
@keyframes bs-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){#boot-splash .bs-radar::before{animation:none}#boot-splash{transition:none}}`;

const SCRIPT = `(function(){var d=document,done=0;function off(){if(done)return;done=1;var e=d.getElementById("boot-splash");if(!e)return;e.classList.add("bs-out");setTimeout(function(){e.remove()},400)}window.__splashDone=off;setTimeout(off,2800)})()`;

export function splashHead(): string {
  return `<style id="boot-splash-css">${CSS}</style><noscript><style>#boot-splash{display:none}</style></noscript>`;
}

export function splashBody(title: string): string {
  return `<div id="boot-splash" role="status" aria-live="polite"><div class="bs-radar" aria-hidden="true"></div><div class="bs-title">${title}</div><div class="bs-sub">최신 지표 불러오는 중…</div></div><script>${SCRIPT}</script>`;
}

/** index.html에 스플래시 삽입 (</head> 앞 CSS, <body> 직후 마크업+스크립트) */
export function injectSplash(html: string, title: string): string {
  if (html.includes('id="boot-splash"')) return html;
  return html.replace('</head>', `${splashHead()}</head>`).replace(/<body([^>]*)>/, (m) => `${m}${splashBody(title)}`);
}
