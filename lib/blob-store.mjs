// Vercel Blob에 최신 스냅샷 1개(live/latest.json)를 덮어쓰기로 보관. 토큰: BLOB_READ_WRITE_TOKEN(스토어 연결 시 자동 주입).
import { put, get } from '@vercel/blob';

export const LIVE_PATH = 'live/latest.json';
const access = () => (process.env.BLOB_ACCESS === 'private' ? 'private' : 'public');

export async function saveLive(payload) {
  return put(LIVE_PATH, JSON.stringify(payload), {
    access: access(), addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json; charset=utf-8', cacheControlMaxAge: 60,
  });
}
/** 없으면 null */
export async function readLive({ fresh = false } = {}) {
  const r = await get(LIVE_PATH, { access: access(), useCache: !fresh });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}
