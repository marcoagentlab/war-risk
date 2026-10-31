// Vercel Cron(매일 03:00 UTC = 정오 KST, vercel.json) → 공개 소스 재수집 → Blob live/latest.json 갱신.
// 페이지 재배포 없음. CRON_SECRET이 있어야만 실행(Vercel Cron은 Authorization: Bearer <CRON_SECRET>을 자동 전송).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collect } from '../../lib/collect.mjs';
import { saveLive, readLive } from '../../lib/blob-store.mjs';

export const maxDuration = 60;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function loadManual() {
  const p = join(process.cwd(), 'src/hub/data/manual.json');
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { overrides: {} }; } catch { return { overrides: {} }; }
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json(500, { ok: false, error: 'CRON_SECRET not configured' });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { ok: false, error: 'unauthorized' });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return json(500, { ok: false, error: 'Blob store not connected (BLOB_READ_WRITE_TOKEN missing)' });

  const t0 = Date.now();
  const { hub, war } = await collect({ manual: loadManual() });
  const hubN = Object.keys(hub.states).length, warN = Object.keys(war.indicators).length;
  const failed = Object.keys(hub.sources_failed);

  // 대량 실패(차단·네트워크)면 이전 스냅샷 유지: 덮어쓰지 않음
  let prev = null;
  try { prev = await readLive({ fresh: true }); } catch { /* 첫 실행 */ }
  const prevHubN = prev ? Object.keys(prev.hub?.states ?? {}).length : 0;
  const prevWarN = prev ? Object.keys(prev.war?.indicators ?? {}).length : 0;
  if (hubN < Math.max(10, prevHubN * 0.6) || warN < Math.max(5, prevWarN * 0.6)) {
    console.warn('[refresh] too few results, keeping previous', { hubN, warN, prevHubN, prevWarN, failed });
    return json(502, { ok: false, kept_previous: Boolean(prev), hub_states: hubN, war_indicators: warN, sources_failed: hub.sources_failed });
  }
  const payload = { schema: 1, refreshed_at: new Date().toISOString(), hub, war };
  const blob = await saveLive(payload);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[refresh] ok hub=${hubN} war=${warN} fail=${failed.length} ${secs}s`);
  return json(200, { ok: true, url: blob.url, refreshed_at: payload.refreshed_at, hub_states: hubN, war_indicators: warN, events: hub.events.length + war.events.length, sources_failed: hub.sources_failed, seconds: Number(secs) });
}
