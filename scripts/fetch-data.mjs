// 로컬/수동 수집: 공개 데이터 → src/hub/data/live.json + src/data/war-live.json (빌드 시 번들되는 폴백 데이터).
// 수집 로직은 lib/collect.mjs(공용) — 배포된 사이트는 같은 로직을 /api/cron/refresh(Vercel Cron, 매일 정오 KST)로 돌린다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../lib/collect.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/hub/data/live.json');
const WAR_OUT = resolve(here, '../src/data/war-live.json');
const MANUAL = resolve(here, '../src/hub/data/manual.json');
const manual = existsSync(MANUAL) ? JSON.parse(readFileSync(MANUAL, 'utf8')) : { overrides: {} };

const t0 = Date.now();
const { hub, war } = await collect({ manual });
writeFileSync(WAR_OUT, JSON.stringify(war, null, 2));
console.log(`[fetch-data] war indicators=${Object.keys(war.indicators).length}`);
writeFileSync(OUT, JSON.stringify(hub, null, 2));
console.log(`[fetch-data] states=${Object.keys(hub.states).length} events=${hub.events.length} ok=${Object.keys(hub.sources_ok).length} fail=${Object.keys(hub.sources_failed).length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
