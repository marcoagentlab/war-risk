// 최신 스냅샷이 프리렌더 HTML보다 새로울 때만 동적 로드되는 청크: 데이터 교체 → 재계산 → #app 다시 그림.
import type { LiveSnapshot } from '../live';
import { isNewer } from '../live';
import { applyHubLive, GENERATED_AT, type HubLive } from './scoring';
import { applyWarIndicators } from '../data/indicators';
import { applyWarEvents } from '../data/events';
import { meta as warMeta } from '../data/meta';
import { recompute, renderHome, renderModule, HUB_PATHS } from './render';

export function applySnapshot(snap: LiveSnapshot): boolean {
  let changed = false;
  if (isNewer(snap.hub.generated_at, GENERATED_AT)) { applyHubLive(snap.hub as unknown as HubLive); changed = true; }
  if (isNewer(snap.war.generated_at, warMeta.updatedAt)) {
    applyWarIndicators(snap.war as unknown as Parameters<typeof applyWarIndicators>[0]);
    applyWarEvents(snap.war as unknown as Parameters<typeof applyWarEvents>[0]);
    warMeta.updatedAt = snap.war.generated_at; changed = true;
  }
  if (!changed) return false;
  recompute();
  const path = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  if (!HUB_PATHS.includes(path)) return false;
  const app = document.getElementById('app');
  if (!app) return false;
  app.innerHTML = path === '/' ? renderHome() : renderModule(path.slice(1));
  document.documentElement.dataset.live = snap.refreshed_at;
  return true;
}
