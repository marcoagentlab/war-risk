// 허브 클라이언트 JS(최소): 본문은 빌드 시 HTML에 있음. 최신 스냅샷(/api/live)이 더 새로우면 그걸로 다시 그림. 오래됐으면 표시.
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import '../styles.css';
import './hub.css';
import { fetchLive, isNewer } from '../live';

// Hub home and module pages (cyber, supply, ai, disaster, crypto) share this entry.
inject();
injectSpeedInsights();

function staleCheck() {
  const t = document.getElementById('generated-at')?.getAttribute('datetime');
  if (!t) return;
  const h = (Date.now() - new Date(t).getTime()) / 36e5;
  const bar = document.getElementById('stale-bar');
  if (bar && h > 36) { bar.hidden = false; bar.textContent = `데이터가 ${Math.floor(h / 24)}일 전 기준입니다. 최신 상황은 각 지표의 근거 링크를 확인하세요.`; }
}

async function boot() {
  const built = document.getElementById('generated-at')?.getAttribute('datetime');
  const snap = await fetchLive(4000);
  if (snap && (isNewer(snap.hub.generated_at, built) || isNewer(snap.war.generated_at, built))) {
    try { const { applySnapshot } = await import('./live-apply'); applySnapshot(snap); } catch (e) { console.warn('[live] apply failed, keeping build data', e); }
  }
  staleCheck();
}
boot().finally(() => (window as unknown as { __splashDone?: () => void }).__splashDone?.());
