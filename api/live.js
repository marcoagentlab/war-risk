// 프론트가 읽는 최신 스냅샷. Blob live/latest.json → CDN 캐시(15분). 없으면 404 → 프론트는 빌드 시 데이터로 폴백.
import { readLive } from '../lib/blob-store.mjs';

export async function GET() {
  try {
    const data = await readLive();
    if (!data) return new Response(JSON.stringify({ error: 'no snapshot yet' }), { status: 404, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60, s-maxage=60' } });
    return new Response(JSON.stringify(data), { headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
    } });
  } catch (e) {
    console.error('[live]', e);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
}
