#!/usr/bin/env bash
# MCP 파일 배포(호출당 $file 4개 제한)용 소스 번들 생성 → /tmp/deploy-bundle.b64
# 배포 파일: vercel.json, package.json, api/cron/refresh.js, api/live.js, lib/*.mjs, scripts/unpack.mjs, src/hub/data/manual.json, deploy-bundle.b64
set -euo pipefail; cd "$(dirname "$0")/.."
tar czf /tmp/deploy-bundle.tgz .env.production index.html privacy.html war cyber supply ai disaster crypto public src vite.config.ts tsconfig.json scripts/sync-schema.mjs scripts/fetch-data.mjs package-lock.json DATA.md
base64 -w0 /tmp/deploy-bundle.tgz > /tmp/deploy-bundle.b64 && ls -la /tmp/deploy-bundle.b64
