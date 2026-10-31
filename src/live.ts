/**
 * 런타임 최신 스냅샷: /api/live (Vercel Cron이 매일 정오 KST에 Blob에 갱신).
 * 실패·시간초과·형식 이상이면 null → 각 페이지는 빌드 시 번들 데이터 그대로 사용.
 * 데이터 모듈을 import하지 않음(페이지별 번들 크기 유지).
 */
export interface LiveSnapshot {
  schema: number; refreshed_at: string;
  hub: { generated_at: string; sources_ok: Record<string, string>; sources_failed: Record<string, string>; states: Record<string, unknown>; events: unknown[] };
  war: { generated_at: string; indicators: Record<string, unknown>; forecasts: unknown[]; events: unknown[] };
}
export const LIVE_ENDPOINT = '/api/live';

let pending: Promise<LiveSnapshot | null> | null = null;
export function fetchLive(timeoutMs = 2500): Promise<LiveSnapshot | null> {
  if (pending) return pending;
  pending = (async () => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(LIVE_ENDPOINT, { signal: ctl.signal, headers: { accept: 'application/json' } });
      if (!r.ok) return null;
      const d = (await r.json()) as LiveSnapshot;
      const ok = d && d.hub && typeof d.hub.generated_at === 'string' && d.hub.states && typeof d.hub.states === 'object' && Array.isArray(d.hub.events)
        && d.war && typeof d.war.generated_at === 'string' && d.war.indicators && typeof d.war.indicators === 'object' && Array.isArray(d.war.events);
      return ok ? d : null;
    } catch { return null; } finally { clearTimeout(t); }
  })();
  return pending;
}
/** ISO 시각 비교: a가 b보다 새로우면 true */
export const isNewer = (a: string | undefined | null, b: string | undefined | null) => !!a && (!b || new Date(a).getTime() > new Date(b).getTime());
