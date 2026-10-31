// /workspace/integrated-risk-hub/schema/indicators.json(기획 원본) → src/hub/data/indicators.json. 원본이 없으면(예: Vercel 빌드) 기존 사본 유지.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const src = process.env.HUB_SCHEMA_PATH || resolve(here, '../../integrated-risk-hub/schema/indicators.json');
const dst = resolve(here, '../src/hub/data/indicators.json');
if (existsSync(src)) { copyFileSync(src, dst); console.log('[sync-schema] copied', src); }
else console.log('[sync-schema] source missing, keeping', dst);
