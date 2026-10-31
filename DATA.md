# 허브 데이터 갱신 (A~E)

```bash
node scripts/fetch-data.mjs   # 공개 소스 수집 → src/hub/data/live.json
npm run build                 # 프리렌더(HTML에 점수·지표 포함) → dist/
```
- 키 불필요 소스: CISA KEV·Advisories, KISA 보안공지 RSS, OpenAI/Claude 상태 페이지, Google Cloud incidents, USGS 지진, 전력거래소(KPX) 홈 수치, CoinGecko, DefiLlama stablecoins, OKX 펀딩비, Upbit+Kraken+open.er-api 환율, Google News RSS(보조·최대 '주의').
- 수동 판정: `src/hub/data/manual.json`의 overrides(`"A:a-ci-incident": {state, summary, evidence_url, checked_at}`)가 자동 판정을 덮어씀.
- 미연결(확인 불가): b-freight-index(SCFI), e-reserve-outflow(온체인 순유출). 
- 있으면 정확도↑(미구현·예정): DATA_GO_KR_SERVICE_KEY(기상특보·산불·재난문자 공식 API), KMA_APIHUB_KEY, SURF_API_KEY(AskSurf 온체인), COINGLASS_API_KEY(청산 규모).
- 배포된 사이트는 **스스로 매일 정오(KST) 갱신**(아래 '자동 갱신'). 빌드 때 번들된 JSON은 폴백.

## W 전쟁(/war, 홈 히어로) — src/data/war-live.json
- 공식: 미 국무부 여행경보 RSS(us-advisory, tw-advisory) · 영국 FCDO content API(other-advisory) · 일본 외무성 해외안전 RSS(jp-info)
- 시장: ECB 기준환율 via frankfurter(krw) · Yahoo 차트 ^KS11(kospi) — 북한 관련 '주의' 보도가 같은 2일 안에 있을 때만 주의/위험(인과 미확인 표기)
- 보도: Google News RSS 21개 지표 — 조건 정규식 + 최소 건수, 최대 '주의'. ADIZ는 보도된 대만 국방부 집계 수치(30↑ 주의, 70↑ 위험)
- 예측: Polymarket gamma API 3개 시장(점수 미반영)
- 대만·해협 추가(2026-10-31, 모두 해협 전용 scope=strait):
  - adiz-by-type(C): 대만 국방부 `mnd.gov.tw/news/plaactlist` 일일 발표 최근 7건 본문(군용기·ADIZ 진입·군함·공무선·풍선, 무인기/전투기/헬기는 본문에 숫자가 있을 때만 — 보통은 첨부 그림에만 있음). 공식 수치라 '위험' 가능. 같은 수치로 기존 `adiz`도 보도 대신 공식값 우선(실패 시 보도 폴백).
  - msa-exclusion(B): 중국 해사국 상하이·저장·푸젠·광둥 航行警告 목록 → 군사훈련/실탄사격 공고 본문 해역에 '台湾' 명시 여부. 보도(Google News)는 보조·최대 주의. 해외 IP 차단 시 unknown.
  - kinmen-matsui-pressure(B): Google News 중(zh-TW)·영·한 14일, 중국 해경·민병+진먼/마쭈 헤드라인을 '날짜' 단위로 집계(같은 날 기사 여러 건=1). 4일↑ 또는 나포·승선 언급 → 주의. 보도라 최대 주의.
  - allies-tw-advisory(B): 일본 외무성 대만 위험정보 페이지 · 호주 Smartraveller 대만 · 영국 FCDO 대만 API(미국은 tw-advisory 별도) + 동맹 성명 보도(보조, 3건↑ 주의). 일부 실패는 '확인 실패' 표기, 전부 실패 시 unknown.
- 수집 경로 없음 → unknown(점수 제외): dialogue(남북 연락채널), cds(한국 CDS)
- 운영자 판정: manual.json overrides에 "W:<id>" 키(state/summary/evidence_url/checked_at) — 자동값보다 우선, '위험'은 이 경로로

## 자동 갱신 (Vercel Hobby Cron, 재배포 없음)
- `vercel.json` crons: `/api/cron/refresh` · `0 3 * * *`(UTC 03시 = 정오 KST, Hobby는 하루 1회·해당 시간대 안에서 실행 시각이 조금 밀릴 수 있음). Cron은 **Production 배포에서만** 돈다.
- 흐름: `api/cron/refresh.js` → `lib/collect.mjs`(로컬 `scripts/fetch-data.mjs`와 같은 수집기, ~25초) → Vercel Blob `live/latest.json` 덮어쓰기(`{schema, refreshed_at, hub, war}`). 결과가 이전보다 크게 줄면(대량 실패) 덮어쓰지 않고 이전 스냅샷 유지.
- 읽기: `api/live.js`(`GET /api/live`, CDN 15분 캐시) → 허브(`src/hub/client.ts`, 더 새로우면 `#app` 다시 그림)·`/war`(`src/main.ts`, 렌더 전 최대 2.5초 대기). 실패·없음이면 빌드 때 번들 JSON 그대로.
- 환경변수(Vercel 프로젝트):
  - `CRON_SECRET` — 필수. Vercel Cron이 `Authorization: Bearer <값>`을 자동 전송. 없거나 틀리면 401/500으로 수집 안 함.
  - `BLOB_READ_WRITE_TOKEN` — 필수. Blob 스토어(`war-risk-live`)를 프로젝트에 연결하면 자동 생성.
  - `BLOB_ACCESS` — 선택. 스토어가 private이면 `private`(기본 `public`).
- 수동 실행: `curl -H "Authorization: Bearer $CRON_SECRET" https://<배포주소>/api/cron/refresh` → `{ok:true, hub_states, war_indicators, ...}`. 확인: `curl https://<배포주소>/api/live | head -c 300`.
- 운영자 판정(`manual.json`)은 함수 번들에 포함되므로, 바꾸면 재배포해야 크론에도 반영된다.
- 배포(MCP 파일 업로드): `scripts/pack-deploy.sh`로 소스 번들(`deploy-bundle.b64`)을 만들고, vercel.json의 buildCommand가 `scripts/unpack.mjs`로 풀어서 `npm run build`. 정적 dist만 올리면 `/api`·Cron이 빠지니 주의.
