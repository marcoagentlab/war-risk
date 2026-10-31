// 공개 데이터 수집기(공용). scripts/fetch-data.mjs(로컬) 와 api/cron/refresh.js(Vercel Cron)가 같이 쓴다.
// 규칙: 공식/공개 API는 기준값으로 정상·주의·위험 판정. 뉴스 자동 집계는 '보조'로 최대 '주의'까지만.
// 실패한 소스는 unknown(계산 제외). 수동 판정(manual.json overrides)이 자동값을 덮어씀.
// 반환: { hub: live.json 형태, war: war-live.json 형태 }. 파일 쓰기 없음(서버리스에서도 동작).
export async function collect({ manual = { overrides: {} } } = {}) {
  const UA = 'Mozilla/5.0 (compatible; IntegratedRiskHub/0.2; +https://war-risk-dashboard.vercel.app)';
  const now = new Date();
  const iso = () => new Date().toISOString();
  const DAY = 864e5;
  const res = {}; // key -> {state, summary, evidence_url, checked_at, method}
  const events = []; // {module, date, title, url, level, source}
  const sourcesOk = {}; const sourcesFail = {};

  async function get(url, { json = false, timeout = 20000, headers = {} } = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: ctl.signal, redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return json ? await r.json() : await r.text();
    } finally { clearTimeout(t); }
  }
  function set(key, state, summary, evidence_url, method = 'auto') {
    res[key] = { state, summary, evidence_url, checked_at: iso(), method };
  }
  async function source(name, fn) {
    try { await fn(); sourcesOk[name] = iso(); }
    catch (e) { sourcesFail[name] = String(e?.message || e); console.warn('[fetch-data] FAIL', name, sourcesFail[name]); }
  }

  // ── Google News RSS (보조) ─────────────────────────────
  const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  async function news(q, { days = 3, lang = 'ko' } = {}) {
    const loc = lang === 'ko' ? 'hl=ko&gl=KR&ceid=KR:ko' : lang === 'zh' ? 'hl=zh-TW&gl=TW&ceid=TW:zh-Hant' : 'hl=en-US&gl=US&ceid=US:en';
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${days}d`)}&${loc}`;
    const xml = await get(url);
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const b = m[1]; const g = (t) => decode((b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [, ''])[1]);
      return { title: g('title'), url: g('link'), date: new Date(g('pubDate')), source: g('source') };
    }).filter((i) => i.title && now - i.date <= days * DAY + DAY / 2);
    return { url: `https://news.google.com/search?q=${encodeURIComponent(q)}&${loc}`, items };
  }
  /** 뉴스 기반 지표: must(정규식) 일치 헤드라인 수 ≥ min → 주의, 아니면 정상. exclude(훈련·과거 등) 제외. */
  const NEWS = [
    // A 사이버
    ['A', 'a-cyber-crisis-level', '사이버위기경보', /사이버\s?위기\s?경보.*(상향|격상|발령)|(상향|격상).*사이버\s?위기\s?경보/, 1],
    ['A', 'a-joint-advisory', '합동 보안권고 국가 배후 해킹', /(합동|공동).*(권고|주의보|경고)|국가\s?배후.*해킹/, 2],
    ['A', 'a-ci-incident', '해킹 공공기관 침해 확인', /(공공기관|정부|기반시설|발전소|병원|통신사).*(해킹|침해|사이버\s?공격)/, 3],
    ['A', 'a-ransom-kr', '랜섬웨어 피해 기업', /랜섬웨어/, 3],
    ['A', 'a-sw-supply', '공급망 공격 악성 패키지 업데이트 서버', /(공급망\s?공격|악성\s?패키지|업데이트\s?서버.*(해킹|악성))/, 2],
    ['A', 'a-mass-breach', '개인정보 유출 신고', /개인정보.*유출/, 3],
    ['A', 'a-ddos-major', '디도스 공격 장애', /(디도스|DDoS)/i, 2],
    ['A', 'a-phishing-alert', '스미싱 주의보', /(스미싱|피싱).*(주의|경보|기승|급증)/, 2],
    // B 공급망
    ['B', 'b-chokepoint-closure', '해협 봉쇄 운하 통항 중단', /(호르무즈|홍해|수에즈|말라카|파나마|바브엘만데브).*(봉쇄|통항\s?중단|운항\s?중단|폐쇄)/, 3],
    ['B', 'b-merchant-attack', '상선 공격 나포', /(상선|유조선|화물선|선박).*(공격|피격|나포|억류)/, 3],
    ['B', 'b-export-control', '수출통제 반도체 희토류', /(수출\s?통제|수출\s?규제|수출\s?금지).*(반도체|희토류|광물|갈륨|흑연)|(반도체|희토류|광물|갈륨|흑연).*(수출\s?통제|수출\s?규제|수출\s?금지)/, 3],
    ['B', 'b-reroute', '희망봉 우회', /희망봉.*우회|우회.*희망봉/, 2],
    ['B', 'b-war-risk-premium', '전쟁보험료 해상', /전쟁\s?(위험\s?)?보험료/, 2],
    ['B', 'b-port-strike', '항만 파업', /(항만|부두|항구|항운).*(파업|폐쇄|마비)/, 2],
    ['B', 'b-panama-draft', '파나마 운하 통항 제한', /파나마\s?운하.*(제한|감축|가뭄|흘수)/, 2],
    ['B', 'b-energy-supply', '원유 LNG 수급 차질', /(원유|LNG|가스).*(수급\s?차질|공급\s?차질|도입\s?차질|비축유\s?방출)/, 2],
    ['B', 'b-port-congestion', '항만 적체 체선', /(항만|항구).*(적체|체선|혼잡)/, 2],
    ['B', 'b-chip-lead', '반도체 공급 차질', /(반도체|칩).*(공급\s?차질|품귀|부족|리드타임)/, 3],
    ['B', 'b-strait-shipping-tw', '대만해협 해운 보험료', /대만\s?해협.*(해운|선박|보험|항로)/, 2],
    // C AI
    ['C', 'pricing_shock', 'AI API 요금 인상', /(AI|API|챗GPT|ChatGPT|클로드|Claude|제미나이|Gemini).*(요금\s?인상|가격\s?인상|요금제\s?개편)/i, 2],
    ['C', 'spend_cap_429', 'AI 사용량 제한 강화', /(AI|챗GPT|ChatGPT|클로드|Claude|제미나이|Gemini).*(사용량\s?제한|이용\s?제한|레이트\s?리밋|쿼터)/i, 2],
    ['C', 'ncii_deepfake', '딥페이크 성범죄', /딥페이크.*(성범죄|성착취|불법\s?합성|유포)/, 3],
    ['C', 'election_scam_deepfake', '딥페이크 사기 선거', /딥페이크.*(사기|선거|보이스피싱|투자)/, 3],
    ['C', 'ban_criminal', 'AI 규제 시행 금지', /(AI|인공지능).*(규제|법).*(시행|발효|금지)/, 3],
    ['C', 'labeling_duty', 'AI 워터마크 표시 의무', /(AI|인공지능).*(워터마크|표시\s?의무|라벨)/, 2],
    ['C', 'weight_leak', 'AI 모델 가중치 유출', /(모델|가중치|학습\s?데이터).*(유출)/, 2],
    ['C', 'guardrail_bypass_press', 'AI 탈옥 가드레일 우회', /(탈옥|가드레일).*(우회|뚫)/, 2],
    // D 재난 (기상특보 API 키 없을 때의 보조 경로)
    ['D', 'w-typhoon', '태풍 특보 북상', /태풍.*(특보|경보|주의보|북상|상륙)/, 3],
    ['D', 'w-rain', '호우경보 호우주의보', /호우\s?(경보|주의보)/, 3],
    ['D', 'w-snow', '대설경보 대설주의보', /대설\s?(경보|주의보)/, 3],
    ['D', 'w-wind', '강풍 풍랑 특보', /(강풍|풍랑)\s?(경보|주의보)/, 3],
    ['D', 'w-heat', '폭염경보 폭염주의보', /폭염\s?(경보|주의보)/, 3],
    ['D', 'w-cold', '한파경보 한파주의보', /한파\s?(경보|주의보)/, 3],
    ['D', 'f-large', '대형산불 대응 단계', /(대형\s?산불|산불\s?(대응|진화)\s?[1-3]단계)/, 2],
    ['D', 'f-index', '산불위험 경보', /산불\s?위험.*(높음|매우\s?높음|경보)/, 2],
    ['D', 'f-crisis', '산불 위기경보 경계 심각', /산불\s?(재난\s?)?위기\s?경보.*(경계|심각)/, 1],
    ['D', 'fl-warn', '홍수경보 홍수주의보', /홍수\s?(경보|주의보)/, 2],
    ['D', 'fl-landslide', '산사태 경보 주의보', /산사태\s?(경보|주의보|위기경보)/, 2],
    ['D', 'p-outage', '대규모 정전', /(대규모|광역|대정전).*정전|정전.*(수만|수십만)\s?가구/, 2],
    ['D', 'c-air', '공습경보 경계경보 발령', /(공습\s?경보|경계\s?경보).*(발령|울려)/, 1],
    ['D', 'c-cbs', '긴급재난문자 위급재난문자', /(긴급|위급)\s?재난\s?문자/, 3],
    ['D', 'c-crisis', '재난 위기경보 심각', /위기\s?경보.*심각.*(발령|상향|격상)/, 1],
    ['D', 'c-hq', '중대본 가동', /(중앙재난안전대책본부|중대본).*(가동|1단계|2단계|3단계)/, 1],
    // E 코인 (신호만. 투자조언 아님)
    ['E', 'e-withdraw-halt', '거래소 출금 중단', /거래소.*(출금|입출금)\s?(중단|정지|중지)/, 2],
    ['E', 'e-exchange-hack', '거래소 해킹', /거래소.*(해킹|탈취)/, 2],
    ['E', 'e-insolvency', '거래소 파산 회생 신청', /(거래소|코인|가상자산|크립토).*(파산|회생\s?신청|지급\s?불능)/, 2],
    ['E', 'e-protocol-exploit', '디파이 해킹 프로토콜', /(디파이|DeFi|프로토콜|브릿지).*(해킹|탈취|익스플로잇)/i, 2],
    ['E', 'e-reg-shock', '가상자산 영업정지 규제', /(가상자산|코인|암호화폐).*(영업\s?정지|영업\s?중단|금지\s?명령|전면\s?금지)/, 2],
    ['E', 'e-kr-exchange-notice', '유의종목 지정 입출금 중단 업비트 빗썸', /(유의\s?종목|거래\s?지원\s?종료|입출금\s?중단)/, 4],
    ['E', 'e-liquidation-cascade', '코인 강제청산 대규모', /(강제\s?청산|청산).*(조|억\s?달러|대규모|폭탄)/, 3],
  ];
  const FOREIGN = /(미국|美|일본|日|중국|中|베트남|필리핀|대만|인도|유럽|캘리포니아|플로리다|텍사스|호주|Vietnam|태국|인니|인도네시아|멕시코|브라질|파키스탄)/;
  const NEWS_EXCLUDE = /(훈련|모의|연습|과거|년\s?전|회고|예방\s?교육|캠페인)/;

  async function runNews() {
    const queue = [...NEWS]; let fails = 0;
    const worker = async () => {
      while (queue.length) {
        const [mod, id, q, re, min] = queue.shift();
        const key = `${mod}:${id}`;
        try {
          const { url, items } = await news(q);
          const hit = items.filter((i) => re.test(i.title) && !NEWS_EXCLUDE.test(i.title) && !(mod === 'D' && FOREIGN.test(i.title)));
          const state = hit.length >= min ? 'caution' : 'normal';
          set(key, state,
            hit.length ? `최근 3일 관련 헤드라인 ${hit.length}건 (기준 ${min}건↑ 주의) · 예: ${hit[0].title}` : '최근 3일 기준 헤드라인 없음',
            hit[0]?.url || url, 'news');
          for (const h of hit.slice(0, 2)) events.push({ module: mod, indicator: id, date: h.date.toISOString(), title: h.title, url: h.url, source: h.source, level: state === 'caution' ? 'caution' : 'info' });
        } catch (e) { fails++; console.warn('[news] fail', key, e.message); }
        await new Promise((r) => setTimeout(r, 350));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (fails > NEWS.length / 2) throw new Error(`news fails ${fails}/${NEWS.length}`);
  }

  // W: 전쟁 관련 헤드라인(점수 반영 없음, 홈 히어로 '최근 보도'용)
  async function warNews() {
    const qs = [['북한 미사일 발사 합참', /(북한|北).*(미사일|도발|포격|발사)/], ['중국 대만 봉쇄 훈련 군사', /(중국|中|인민해방군).*(대만|타이완).*(훈련|봉쇄|무력|군용기|포위)|(대만|타이완).*(중국|中).*(훈련|봉쇄|군용기)/]];
    for (const [q, re] of qs) {
      const { items } = await news(q, { days: 3 });
      for (const h of items.filter((i) => re.test(i.title)).slice(0, 3)) events.push({ module: 'W', indicator: 'news', date: h.date.toISOString(), title: h.title, url: h.url, source: h.source, level: 'info' });
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  // ── A: CISA KEV ───────────────────────────────────────
  const KR_COMMON = /(microsoft|apple|google|android|samsung|cisco|fortinet|ivanti|citrix|vmware|oracle|adobe|mozilla|chrome|windows|sonicwall|palo alto|f5|juniper|atlassian|zimbra|hancom|ahnlab|lg)/i;
  async function kev() {
    const url = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
    const d = await get(url, { json: true, timeout: 40000 });
    const v = d.vulnerabilities.map((x) => ({ ...x, t: new Date(x.dateAdded + 'T00:00:00Z') }));
    const last7 = v.filter((x) => now - x.t <= 7 * DAY);
    const weeks = Array.from({ length: 12 }, (_, i) => v.filter((x) => now - x.t > (i + 1) * 7 * DAY && now - x.t <= (i + 2) * 7 * DAY).length).sort((a, b) => a - b);
    const median = (weeks[5] + weeks[6]) / 2 || 1;
    const ratio = last7.length / median;
    set('A:a-kev-weekly', ratio >= 3 ? 'danger' : ratio >= 2 ? 'caution' : 'normal',
      `최근 7일 KEV 신규 ${last7.length}건 · 직전 12주 주간 중앙값 ${median}건 (×${ratio.toFixed(1)})`, 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog');
    const kr = last7.filter((x) => KR_COMMON.test(`${x.vendorProject} ${x.product}`));
    set('A:a-kev-domestic', kr.length >= 3 ? 'danger' : kr.length >= 1 ? 'caution' : 'normal',
      kr.length ? `국내 보급 제품 신규 등재 ${kr.length}건: ${kr.slice(0, 4).map((x) => `${x.vendorProject} ${x.product}`).join(', ')} — 패치 확인 권장` : '최근 7일 국내 보급 주요 제품 신규 등재 없음',
      'https://www.cisa.gov/known-exploited-vulnerabilities-catalog');
    const ransom30 = v.filter((x) => now - x.t <= 30 * DAY && x.knownRansomwareCampaignUse === 'Known');
    set('A:a-ransom-stats', ransom30.length >= 6 ? 'danger' : ransom30.length >= 3 ? 'caution' : 'normal',
      `최근 30일 KEV 중 랜섬웨어 악용 확인 ${ransom30.length}건 (대리 지표)`, 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog');
    for (const x of kr.slice(0, 3)) events.push({ module: 'A', indicator: 'a-kev-domestic', date: x.t.toISOString(), title: `KEV 등재: ${x.vendorProject} ${x.product} (${x.cveID}) — 패치 확인`, url: `https://nvd.nist.gov/vuln/detail/${x.cveID}`, source: 'CISA KEV', level: 'caution' });
  }
  async function kisa() {
    const url = 'https://www.boho.or.kr/kr/rss.do?bbsId=B0000133';
    const xml = await get(url);
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
      title: decode((m[1].match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]),
      link: decode((m[1].match(/<link>([\s\S]*?)<\/link>/) || [, ''])[1]),
      date: new Date(decode((m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [, ''])[1])),
    })).filter((i) => !isNaN(i.date) && now - i.date <= 7 * DAY);
    const urgent = items.filter((i) => /(긴급|제로데이|0-day|악용|공격\s?발생)/i.test(i.title));
    set('A:a-oob-patch', urgent.length >= 1 ? 'caution' : 'normal',
      `KISA 보안공지 최근 7일 ${items.length}건 · 긴급/악용 언급 ${urgent.length}건${urgent[0] ? ' · 예: ' + urgent[0].title : ''}`,
      urgent[0]?.link || 'https://www.boho.or.kr/kr/bbs/list.do?menuNo=205020&bbsId=B0000133');
    for (const i of items.slice(0, 2)) events.push({ module: 'A', indicator: 'a-oob-patch', date: i.date.toISOString(), title: `KISA 보안공지: ${i.title}`, url: i.link, source: 'KISA', level: urgent.includes(i) ? 'caution' : 'info' });
  }
  async function cisaAdvisories() {
    const xml = await get('https://www.cisa.gov/cybersecurity-advisories/all.xml', { timeout: 40000 });
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 120).map((m) => ({
      title: decode((m[1].match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]),
      link: decode((m[1].match(/<link>([\s\S]*?)<\/link>/) || [, ''])[1]),
      date: new Date(decode((m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [, ''])[1])),
    })).filter((i) => now - i.date <= 14 * DAY);
    const joint = items.filter((i) => /(PRC|China|Chinese|Russia|Russian|North Korea|DPRK|Iran|Iranian|state-sponsored|#StopRansomware)/i.test(i.title));
    const prev = res['A:a-joint-advisory'];
    const state = joint.length >= 1 ? 'caution' : (prev?.state ?? 'normal');
    set('A:a-joint-advisory', state,
      `CISA 권고 최근 14일 국가연계/랜섬 관련 ${joint.length}건${joint[0] ? ' · 예: ' + joint[0].title : ''}${prev?.state === 'caution' && !joint.length ? ' · 국내 보도 기준 주의' : ''}`,
      joint[0]?.link || 'https://www.cisa.gov/news-events/cybersecurity-advisories', 'auto');
    for (const i of joint.slice(0, 2)) events.push({ module: 'A', indicator: 'a-joint-advisory', date: i.date.toISOString(), title: `CISA: ${i.title}`, url: i.link, source: 'CISA', level: 'caution' });
  }

  // ── C: AI 상태 페이지 ──────────────────────────────────
  const SP = { none: 'normal', minor: 'caution', major: 'danger', critical: 'danger' };
  async function statuspage(key, name, base) {
    const d = await get(`${base}/api/v2/summary.json`, { json: true });
    const inc = (d.incidents || []).filter((i) => i.status !== 'resolved');
    set(key, SP[d.status.indicator] ?? 'unknown', `${name} 상태: ${d.status.description}${inc[0] ? ' · 진행 중: ' + inc[0].name : ''}`, base);
    for (const i of inc.slice(0, 2)) events.push({ module: 'C', indicator: key.split(':')[1], date: i.created_at, title: `${name} 장애: ${i.name}`, url: i.shortlink || base, source: name, level: SP[i.impact] === 'danger' ? 'danger' : 'caution' });
    return d;
  }
  async function aiStatus() {
    const oa = await statuspage('C:openai_api', 'OpenAI', 'https://status.openai.com');
    const img = (oa.components || []).filter((c) => /(image|sora|video|dall)/i.test(c.name));
    const bad = img.filter((c) => c.status !== 'operational');
    const worst = bad.some((c) => /major|partial/.test(c.status)) ? 'danger' : bad.length ? 'caution' : 'normal';
    set('C:image_gen_api', img.length ? worst : 'unknown',
      img.length ? `OpenAI 이미지·영상 구성요소 ${img.length}개 중 이상 ${bad.length}개` : '이미지 구성요소 정보 없음', 'https://status.openai.com');
  }
  async function claude() { await statuspage('C:anthropic_api', 'Anthropic Claude', 'https://status.claude.com'); }
  async function gemini() {
    const d = await get('https://status.cloud.google.com/incidents.json', { json: true, timeout: 40000 });
    const open = d.filter((i) => !i.end && (i.affected_products || []).some((p) => /(gemini|vertex ai)/i.test(p.title)));
    const sev = open.some((i) => i.severity === 'high') ? 'danger' : open.length ? 'caution' : 'normal';
    set('C:google_gemini', sev, open.length ? `진행 중 Vertex AI/Gemini 사고 ${open.length}건 · ${open[0].external_desc?.slice(0, 80)}` : '진행 중 Vertex AI/Gemini 사고 없음', 'https://status.cloud.google.com/');
    for (const i of open.slice(0, 2)) events.push({ module: 'C', indicator: 'google_gemini', date: i.begin, title: `Google Cloud: ${i.external_desc?.slice(0, 90)}`, url: `https://status.cloud.google.com/${i.uri || ''}`, source: 'Google Cloud', level: i.severity === 'high' ? 'danger' : 'caution' });
  }

  // ── D: 지진(USGS), 전력(KPX) ───────────────────────────
  async function quakes() {
    const start = new Date(now - 30 * DAY).toISOString().slice(0, 10);
    const kr = await get(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&minlatitude=33&maxlatitude=39&minlongitude=124&maxlongitude=131.5&minmagnitude=2`, { json: true });
    const f = kr.features.map((x) => ({ m: x.properties.mag, t: new Date(x.properties.time), place: x.properties.place, url: x.properties.url, tsu: x.properties.tsunami }));
    const w7 = f.filter((x) => now - x.t <= 7 * DAY);
    const maxM = Math.max(0, ...w7.map((x) => x.m));
    set('D:q-flash', maxM >= 5 ? 'danger' : maxM >= 3.5 ? 'caution' : 'normal', w7.length ? `최근 7일 한반도 주변 최대 M${maxM.toFixed(1)} (USGS)` : '최근 7일 한반도 주변 M2 이상 없음 (USGS)', 'https://earthquake.usgs.gov/earthquakes/map/');
    set('D:q-eew', maxM >= 5 ? 'danger' : 'normal', maxM >= 5 ? `M${maxM} 지진 — 조기경보 기준(M5) 이상` : '최근 7일 조기경보 기준(M5) 이상 지진 없음 (USGS 대리 확인)', 'https://www.weather.go.kr/w/eqk-vol/search/korea.do');
    set('D:q-freq', f.length >= 8 ? 'caution' : 'normal', `최근 30일 한반도 주변 M2 이상 ${f.length}건 (USGS 집계, 기상청보다 적게 잡힘)`, 'https://earthquake.usgs.gov/earthquakes/map/');
    const wide = await get(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(now - 2 * DAY).toISOString().slice(0, 10)}&minlatitude=28&maxlatitude=46&minlongitude=120&maxlongitude=145&minmagnitude=6.5`, { json: true });
    const tsu = wide.features.filter((x) => x.properties.tsunami === 1);
    set('D:q-tsunami', tsu.some((x) => x.properties.mag >= 7.5) ? 'danger' : tsu.length ? 'caution' : 'normal', tsu.length ? `주변 해역 지진해일 가능 지진 ${tsu.length}건 (USGS)` : '최근 48시간 주변 해역 지진해일 가능 지진 없음 (USGS)', 'https://earthquake.usgs.gov/earthquakes/map/');
    for (const x of w7.slice(0, 2)) events.push({ module: 'D', indicator: 'q-flash', date: x.t.toISOString(), title: `지진 M${x.m} · ${x.place}`, url: x.url, source: 'USGS', level: x.m >= 3.5 ? 'caution' : 'info' });
  }
  async function kpx() {
    const html = await get('https://www.kpx.or.kr/');
    const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const num = (s) => Number(String(s).replace(/,/g, ''));
    const rt = t.match(/실시간전력수급현황\s*(\S+)\s*공급능력\s*([\d,]+)\s*MW\s*현재부하\s*([\d,]+)\s*MW\s*공급예비력\s*([\d,]+)\s*MW\s*공급예비율\s*([\d.]+)\s*%/);
    const fc = t.match(/최대부하전망\s*(\S+)\s*피크예상시간[^]*?최대부하\s*([\d,]+)\s*MW\s*공급예비력\s*([\d,]+)\s*MW\s*공급예비율\s*([\d.]+)\s*%/);
    if (!rt) throw new Error('KPX parse failed');
    const reserveMW = num(rt[4]); const rate = Number(rt[5]);
    set('D:p-stage', reserveMW < 3500 ? 'danger' : reserveMW < 5500 ? 'caution' : 'normal', `실시간 공급예비력 ${rt[4]}MW (${rt[1]}) · 비상단계 기준 5,500MW`, 'https://www.kpx.or.kr/');
    set('D:p-rate', rate < 5 ? 'danger' : rate < 10 ? 'caution' : 'normal', `실시간 공급예비율 ${rate}% · 현재부하 ${rt[3]}MW / 공급능력 ${rt[2]}MW`, 'https://www.kpx.or.kr/');
    if (fc) { const fr = num(fc[3]); set('D:p-forecast', fr < 3500 ? 'danger' : fr < 5500 ? 'caution' : 'normal', `오늘 최대부하 전망 ${fc[2]}MW · 예비력 ${fc[3]}MW (${fc[4]}%)`, 'https://www.kpx.or.kr/'); }
  }

  // ── E: 스테이블코인·펀딩비·원화 프리미엄 ──────────────────
  async function stable() {
    const p = await get('https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin,dai&vs_currencies=usd', { json: true });
    const vals = { USDT: p.tether?.usd, USDC: p['usd-coin']?.usd, DAI: p.dai?.usd };
    const min = Math.min(...Object.values(vals).filter(Number.isFinite));
    set('E:e-stable-depeg', min < 0.95 ? 'danger' : min < 0.98 ? 'caution' : 'normal', `현재가 ${Object.entries(vals).map(([k, v]) => `${k} $${v}`).join(' · ')} (기준 $0.98)`, 'https://www.coingecko.com/en/categories/stablecoins');
  }
  async function stableSupply() {
    const d = await get('https://stablecoins.llama.fi/stablecoins', { json: true, timeout: 40000 });
    let cur = 0, prev = 0;
    for (const a of d.peggedAssets) { cur += a.circulating?.peggedUSD || 0; prev += a.circulatingPrevMonth?.peggedUSD || 0; }
    const ch = prev ? (cur - prev) / prev * 100 : 0;
    set('E:e-stable-supply', ch <= -10 ? 'danger' : ch <= -5 ? 'caution' : 'normal', `스테이블코인 총 발행량 $${(cur / 1e9).toFixed(1)}B · 한 달 전 대비 ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`, 'https://defillama.com/stablecoins');
  }
  async function funding() {
    const d = await get('https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP', { json: true });
    const r = Number(d.data?.[0]?.fundingRate) * 100;
    if (!Number.isFinite(r)) throw new Error('funding parse');
    const a = Math.abs(r);
    set('E:e-funding-extreme', a >= 0.1 ? 'danger' : a >= 0.05 ? 'caution' : 'normal', `BTC 무기한 펀딩비 ${r.toFixed(4)}% (OKX, 극단 기준 ±0.05%) · 방향 해석·매매 신호 아님`, 'https://www.okx.com/trade-market/funding/swap');
  }
  async function kimchi() {
    const [up, kr, fx] = await Promise.all([
      get('https://api.upbit.com/v1/ticker?markets=KRW-BTC', { json: true }),
      get('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', { json: true }),
      get('https://open.er-api.com/v6/latest/USD', { json: true }),
    ]);
    const krw = up[0].trade_price; const usd = Number(Object.values(kr.result)[0].c[0]); const rate = fx.rates.KRW;
    const prem = (krw / (usd * rate) - 1) * 100; const a = Math.abs(prem);
    set('E:e-kimchi-premium', a >= 10 ? 'danger' : a >= 5 ? 'caution' : 'normal', `원화 프리미엄 ${prem >= 0 ? '+' : ''}${prem.toFixed(2)}% (업비트 vs 크라켄·환율 ${Math.round(rate)}원) · 차익거래 안내 아님`, 'https://upbit.com/exchange?code=CRIX.UPBIT.KRW-BTC');
  }


  // ══ W: 한반도·대만 전쟁 지표 (src/data/war-live.json) ══════════════
  // 공식: 미 국무부 여행경보 RSS, 영국 FCDO 여행경보 API, 일본 외무성 해외안전 RSS, ECB 환율(frankfurter), KOSPI(Yahoo 차트)
  // 보도: Google News RSS 헤드라인 — 최대 '주의'. '위험'은 운영자 확인(manual.json "W:id") 또는 수치 기준(ADIZ 70대↑)만.
  const war = {}; const warEvents = [];
  const wset = (id, status, summary, url, label, method = 'auto') => { war[id] = { status, summary, source: { label, url }, checkedAt: iso(), method }; };
  const WAR_NEWS = [
    // id, query, regex, min, days, region
    ['neo', '주한미군 가족 대피 명령', /(비전투원|주한미군\s?가족|미군\s?가족).*(대피|소개).*(명령|지시|준비|점검)/, 1, 7],
    ['embassy', '대사관 철수 서울 인원 감축', /(주한|서울).*대사관.*(철수|폐쇄|인원\s?감축|출국\s?권고)|대사관.*서울.*(철수|폐쇄)/, 1, 7],
    ['civil-defense', '공습경보 경계경보 발령 실제', /(공습\s?경보|경계\s?경보).*(발령|오발령|울려)/, 1, 7],
    ['mobilization', '북한 병력 동원 전진 배치', /(북한|北).*(동원령|병력\s?동원|전군\s?동원|전진\s?배치|병력\s?이동)/, 2, 7],
    ['watchcon', '워치콘 상향', /워치콘.*(상향|격상|2단계|1단계)/, 1, 14],
    ['artillery', '북한 해안포 포문 개방 포병', /(북한|北).*(포문\s?개방|해안포|방사포|포병).*(개방|배치|사격|도발)|(포문\s?개방)/, 2, 7],
    ['dmz-incident', 'DMZ 지뢰 총격 비무장지대', /(DMZ|비무장지대).*(지뢰|총격|폭발|사상|부상|사망)/i, 1, 30],
    ['nll', '서해 NLL 침범 경고사격', /NLL.*(침범|경고\s?사격|교전|포격|월선)/, 1, 7],
    ['nuke-test', '풍계리 핵실험 징후', /(핵실험|풍계리).*(징후|임박|준비|복구|실시|단행)/, 1, 14],
    ['missile', '북한 탄도미사일 발사 합참', /(북한|北).*(미사일|ICBM|탄도|순항).*(발사|쐈|도발)|(합참).*(미사일).*(발사)/, 1, 30],
    ['mdl', '군사분계선 침범 경고사격', /(군사분계선|MDL).*(침범|넘어|월선|경고\s?사격)/, 1, 14],
    ['psyops', '북한 오물풍선 확성기', /(오물\s?풍선|쓰레기\s?풍선|대남\s?풍선|대북\s?확성기|대남\s?확성기|대남\s?방송)/, 2, 7],
    ['gps', 'GPS 교란 북한 서북도서', /GPS\s?(교란|전파\s?교란|재밍)/, 1, 7],
    ['taiwan-blockade', '중국 대만 봉쇄 선언 검문', /(중국|中|인민해방군).*(대만|타이완).*(봉쇄\s?(선언|개시|돌입)|해상\s?검문|무력\s?공격|침공\s?개시)/, 1, 7, 'strait'],
    ['pla-drill', '중국군 대만 포위 훈련', /(대만|타이완).*(포위|봉쇄)\s?훈련|(연합리젠|리젠|해협\s?뇌정|Strait Thunder|Joint Sword)/i, 1, 7, 'strait'],
    ['us-china', '미중 정상회담 취소 군사 채널 중단', /(미중|미·중|미국.*중국).*(회담\s?취소|채널\s?(중단|단절)|대화\s?중단|제재\s?맞불)/, 2, 7, 'strait'],
    ['usfk-role', '주한미군 대만 유사시 차출', /(주한미군).*(대만).*(차출|투입|역할|전략적\s?유연성)/, 2, 14],
    ['amphib', '중국 상륙 전력 집결 대만', /(상륙\s?(함|전력|훈련|부대)|민간\s?선박|로로선).*(집결|동원).*(대만|푸젠|저장)?/, 2, 7, 'strait'],
    ['us-deploy', '미 항모 대만 해협 긴급 배치', /(항모|항공모함).*(대만|서태평양|남중국해).*(긴급|배치|급파|전개)/, 2, 7, 'strait'],
    ['cg-inspection', '중국 해경 진먼 대만 승선 검사', /(중국\s?해경).*(진먼|금문|마쭈|대만).*(검문|승선|진입|나포|순찰)/, 1, 7, 'strait'],
    ['strait-shipping', '대만해협 해운 전쟁보험료 우회', /(대만\s?해협).*(전쟁\s?보험|할증|우회|운항\s?중단)/, 1, 7, 'strait'],
  ];
  async function warNewsIndicators() {
    const queue = [...WAR_NEWS]; let fails = 0;
    const worker = async () => {
      while (queue.length) {
        const [id, q, re, min, days, region] = queue.shift();
        try {
          const { url, items } = await news(q, { days });
          const hit = items.filter((i) => re.test(i.title) && !NEWS_EXCLUDE.test(i.title));
          wset(id, hit.length >= min ? 'caution' : 'normal',
            hit.length ? `최근 ${days}일 관련 보도 ${hit.length}건(기준 ${min}건↑ 주의, 자동 집계) · 예: ${hit[0].title}` : `최근 ${days}일 기준 관련 보도 없음(자동 집계)`,
            hit[0]?.url || url, hit[0]?.source || 'Google 뉴스 검색', 'news');
          for (const h of hit.slice(0, 2)) warEvents.push({ date: h.date.toISOString().slice(0, 10), iso: h.date.toISOString(), title: h.title, detail: `${h.source || '언론'} 보도 · 자동 수집 헤드라인(사실 확인 전)`, level: hit.length >= min ? 'caution' : 'info', direction: 'flat', region: region || 'korea', source: { label: h.source || '원문', url: h.url } });
        } catch (e) { fails++; console.warn('[war-news] fail', id, e.message); }
        await new Promise((r) => setTimeout(r, 350));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (fails > WAR_NEWS.length / 2) throw new Error(`war news fails ${fails}`);
  }
  const warForecasts = [];
  const PM = [
    ['will-north-korea-invade-south-korea-before-2027', '2026년 말까지 북한의 남한 침공'],
    ['will-china-invade-taiwan-before-2027', '2026년 말까지 중국의 대만 침공'],
    ['will-china-invade-taiwan-by-december-31-2027', '2027년 말까지 중국의 대만 침공'],
  ];
  async function polymarket() {
    for (const [slug, q] of PM) {
      const [ev] = await get(`https://gamma-api.polymarket.com/events?slug=${slug}`, { json: true });
      const m = ev?.markets?.[0]; if (!m || m.closed) continue;
      const p = Number(JSON.parse(m.outcomePrices)[0]) * 100;
      warForecasts.push({ question: q, probability: Math.round(p * 10) / 10, platform: 'Polymarket', url: `https://polymarket.com/event/${slug}`, note: `거래량 약 $${Math.round(Number(m.volume) / 1000).toLocaleString('en-US')}K · ${new Date(now).toISOString().slice(0, 10)} 기준 'Yes' 가격` });
    }
  }
  async function stateDept() {
    const xml = await get('https://travel.state.gov/_res/rss/TAsTWs.xml', { timeout: 40000 });
    const lvl = (name) => { const m = xml.match(new RegExp(`<title>${name} - Level (\\d)[^<]*</title>`)); return m ? Number(m[1]) : null; };
    const kr = lvl('South Korea'), tw = lvl('Taiwan');
    const url = 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html';
    if (kr) wset('us-advisory', kr >= 3 ? 'danger' : kr === 2 ? 'caution' : 'normal', `미 국무부 한국 여행경보 ${kr}단계`, url, '미 국무부');
    if (tw) {
      const ordered = /Taiwan[\s\S]{0,4000}ordered departure/i.test(xml);
      wset('tw-advisory', tw >= 3 || ordered ? 'danger' : tw === 2 ? 'caution' : 'normal', `미 국무부 대만 여행경보 ${tw}단계${ordered ? ' · 출국 명령 언급' : ''}`, url, '미 국무부');
    }
  }
  async function fcdo() {
    const d = await get('https://www.gov.uk/api/content/foreign-travel-advice/south-korea', { json: true });
    const a = d.details?.alert_status || [];
    wset('other-advisory', a.length ? 'caution' : 'normal', a.length ? `영국 FCDO 한국 여행경보: ${a.join(', ')}` : `영국 FCDO 한국 여행경보 상향 없음 (갱신 ${String(d.public_updated_at).slice(0, 10)}) · 다른 나라는 미확인`, 'https://www.gov.uk/foreign-travel-advice/south-korea', '영국 FCDO');
  }
  async function mofaJp() {
    const xml = await get('https://www.anzen.mofa.go.jp/rss/news.xml');
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => decode((m[1].match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]));
    const kr = items.filter((t) => /韓国/.test(t) && /(危険情報|レベル)/.test(t));
    wset('jp-info', kr.some((t) => /レベル[2-4２-４]/.test(t)) ? 'danger' : kr.length ? 'caution' : 'normal', kr.length ? `일본 외무성 공지: ${kr[0]}` : '일본 외무성 해외안전 최신 공지에 한국 위험정보 발령 없음', 'https://www.anzen.mofa.go.jp/', '일본 외무성');
  }
  const nkNewsToday = () => warEvents.some((e) => e.region === 'korea' && e.level === 'caution' && now - new Date(e.iso) <= 2 * DAY);
  async function krw() {
    const start = new Date(now - 14 * DAY).toISOString().slice(0, 10);
    const d = await get(`https://api.frankfurter.app/${start}..?from=USD&to=KRW`, { json: true });
    const days = Object.keys(d.rates).sort(); const a = d.rates[days.at(-2)].KRW, b = d.rates[days.at(-1)].KRW;
    const ch = (b / a - 1) * 100; const nk = nkNewsToday();
    wset('krw', nk && ch >= 2 ? 'danger' : nk && ch >= 1 ? 'caution' : 'normal', `원/달러 ${b.toFixed(1)}원 (${days.at(-1)}, 전일 대비 ${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%)${nk && ch >= 1 ? ' · 같은 기간 북한 관련 주의 보도 있어 주의(인과 미확인)' : ''}${!nk && Math.abs(ch) >= 1 ? ' · 북한 요인 보도 없어 정상 처리' : ''}`, 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-krw.en.html', 'ECB 기준환율');
  }
  async function kospi() {
    const d = await get('https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?range=10d&interval=1d', { json: true });
    const c = d.chart.result[0].indicators.quote[0].close.filter((x) => x != null);
    const ch = (c.at(-1) / c.at(-2) - 1) * 100; const nk = nkNewsToday();
    wset('kospi', nk && ch <= -8 ? 'danger' : nk && ch <= -2 ? 'caution' : 'normal', `KOSPI ${c.at(-1).toFixed(2)} (전일 대비 ${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%)${nk && ch <= -2 ? ' · 같은 기간 북한 관련 주의 보도 있어 주의(인과 미확인)' : ''}${!nk && ch <= -2 ? ' · 북한 요인 보도 없어 정상 처리' : ''}`, 'https://finance.yahoo.com/quote/%5EKS11/', 'Yahoo Finance');
  }
  async function adiz() {
    const { url, items } = await news('Taiwan Chinese military aircraft detected', { days: 3, lang: 'en' });
    const nums = items.map((i) => { const m = i.title.match(/(\d{1,3})\s+(Chinese\s+)?(military\s+)?(aircraft|planes|warplanes|jets)/i); return m ? { n: Number(m[1]), i } : null; }).filter(Boolean);
    const max = nums.reduce((a, b) => (b.n > (a?.n ?? -1) ? b : a), null);
    wset('adiz', max ? (max.n >= 70 ? 'danger' : max.n >= 30 ? 'caution' : 'normal') : 'normal',
      max ? `최근 3일 보도된 대만 국방부 집계 최대 ${max.n}대 (기준 30대↑ 주의, 70대↑ 위험)` : '최근 3일 대량 진입 보도 없음(자동 집계)', max?.i.url || url, max?.i.source || 'Google 뉴스', max ? 'auto' : 'news');
  }

  // ── 대만·해협 추가 지표(2026-10-31) ─────────────────────
  const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const BROWSER = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' };

  // 1) 대만 국방부 일일 「中共解放軍臺海周邊海、空域動態」 공식 발표(최근 7건) → 군용기·ADIZ 진입·군함·공무선·기종(무인기/전투기/헬기, 명시될 때만)
  const MND_LIST = 'https://www.mnd.gov.tw/news/plaactlist';
  async function mndDaily() {
    const html = await get(MND_LIST, { headers: BROWSER, timeout: 15000 });
    const ids = [...new Set([...html.matchAll(/href="\/?news\/plaact\/(\d+)"/gi)].map((m) => m[1]))].slice(0, 7);
    if (!ids.length) throw new Error('MND list parse');
    const pages = await Promise.all(ids.map(async (id) => {
      try {
        const t = strip(await get(`https://www.mnd.gov.tw/news/plaact/${id}`, { headers: BROWSER, timeout: 15000 }));
        const body = (t.match(/二、活動動態[:：]\s*(.*?)(關鍵字|$)/) || [])[1] || '';
        const date = (t.match(/日期[:：].*?至\s*(?:中華民國)?(\d+)年(\d+)月(\d+)日/) || []);
        if (!body) return null;
        const n = (re) => { const m = body.match(re); return m ? Number(m[1]) : null; };
        return {
          id, url: `https://www.mnd.gov.tw/news/plaact/${id}`, body: body.slice(0, 220),
          day: date[1] ? `${Number(date[1]) + 1911}-${String(date[2]).padStart(2, '0')}-${String(date[3]).padStart(2, '0')}` : null,
          aircraft: n(/共機\s*(\d+)\s*架/) ?? 0,
          adiz: n(/[（(][^）)]*?計\s*(\d+)\s*架/) ?? 0,
          crossed: /逾越中線/.test(body),
          ships: n(/共艦\s*(\d+)\s*艘/) ?? 0,
          official: n(/公務船\s*(\d+)\s*艘/) ?? 0,
          balloons: n(/氣球\s*(\d+)\s*[顆枚個]/) ?? 0,
          drones: n(/無人機\s*(\d+)/) , fighters: n(/戰機\s*(\d+)/), helis: n(/直升機\s*(\d+)/),
          jcrp: /聯合戰備警巡/.test(body),
        };
      } catch { return null; }
    }));
    const ok = pages.filter(Boolean);
    if (!ok.length) throw new Error('MND detail parse');
    return ok; // 최신순
  }
  let mnd = null;
  async function adizByType() {
    mnd = await mndDaily();
    const L = mnd[0]; const last3 = mnd.slice(0, 3);
    const max = (k) => Math.max(...last3.map((x) => x[k] ?? 0));
    const avg7 = mnd.reduce((a, x) => a + x.aircraft, 0) / mnd.length;
    const typed = [L.fighters != null && `전투기 ${L.fighters}`, L.drones != null && `무인기 ${L.drones}`, L.helis != null && `헬기 ${L.helis}`].filter(Boolean);
    const maxDrones = Math.max(0, ...last3.map((x) => x.drones ?? 0));
    const anyJcrp = last3.some((x) => x.jcrp);
    const danger = max('aircraft') >= 70 || max('ships') >= 25;
    const caution = max('aircraft') >= 30 || max('adiz') >= 20 || max('ships') >= 15 || maxDrones >= 10 || anyJcrp;
    wset('adiz-by-type', danger ? 'danger' : caution ? 'caution' : 'normal',
      `대만 국방부 ${L.day || '최근'} 발표: 군용기 ${L.aircraft}대(ADIZ 진입 ${L.adiz}${L.crossed ? '·중간선 넘음' : ''}) · 군함 ${L.ships}척 · 공무선 ${L.official}척${L.balloons ? ` · 풍선 ${L.balloons}개` : ''}${typed.length ? ` · 기종: ${typed.join(', ')}` : ' · 기종별 세부(전투기/무인기)는 발표문에 숫자 없음(첨부 그림만)'}${anyJcrp ? ' · 「연합 전비 경계순찰」 언급' : ''} · 최근 ${mnd.length}회 평균 군용기 ${avg7.toFixed(1)}대 (주의: 3일 내 군용기 30↑·진입 20↑·군함 15↑·무인기 10↑·연합순찰 / 위험: 군용기 70↑·군함 25↑)`,
      L.url, '대만 국방부(MND) 공식 발표');
  }

  // 2) 중국 해사국(MSA) 항행경고 — 상하이·저장·푸젠·광둥 해사국 목록에서 군사훈련·실탄사격 공고, 본문 해역에 台湾 언급 여부
  const MSA_LISTS = [['상하이', '94df14ce1110415da44e67593e76619f'], ['저장', '8e10ea74eb9e4c9690f8f891968add80'], ['푸젠', '7b08405760384570a0fb44e9204c4b1d'], ['광둥', '1e478d409e854918bf12478b8a19f4a8']];
  async function msaExclusion() {
    const lists = await Promise.all(MSA_LISTS.map(async ([name, ch]) => {
      try {
        const html = await get(`https://www.msa.gov.cn/${ch}/index.jhtml`, { headers: BROWSER, timeout: 15000 });
        return [...html.matchAll(/<a href="(\/html\/[^"]+\.html)"[^>]*>\s*<span class="name">([\s\S]*?)<\/span>\s*<span class="time">\s*(\d{4}-\d{2}-\d{2})/g)]
          .map((m) => ({ bureau: name, url: `https://www.msa.gov.cn${m[1]}`, title: strip(m[2]).trim(), date: m[3] }));
      } catch { return null; }
    }));
    const okLists = lists.filter(Boolean);
    if (!okLists.length) throw new Error('MSA lists unreachable');
    const recent = okLists.flat().filter((i) => now - new Date(i.date + 'T00:00:00+08:00') <= 7 * DAY);
    const mil = recent.filter((i) => /航警/.test(i.title) && /(军事|实弹|射击|禁航|演习|演训)/.test(i.title));
    const detail = await Promise.all(mil.slice(0, 10).map(async (i) => {
      try {
        const t = strip(await get(i.url, { headers: BROWSER, timeout: 12000 }));
        const m = t.match(/([闽浙沪粤]航警\d+\/\d+)[，,]\s*([^0-9。]{0,60})/);
        return { ...i, no: m?.[1] || i.title, area: (m?.[2] || '').trim().replace(/[，,、\s]+$/, '') };
      } catch { return { ...i, no: i.title, area: '' }; }
    }));
    const tw = detail.filter((d) => /台湾/.test(d.area));
    const island = tw.filter((d) => /台湾岛/.test(d.area));
    let state = island.length || tw.length >= 3 ? 'danger' : tw.length ? 'caution' : 'normal';
    let summary = `중국 해사국 항행경고(${okLists.length}/4개 해사국 확인) 최근 7일 군사훈련·실탄사격 ${mil.length}건, 해역에 '台湾' 명시 ${tw.length}건${tw[0] ? ` · 예: ${tw[0].no} ${tw[0].area}` : mil[0] ? ` · 예: ${detail[0].no} ${detail[0].area || '(연안)'}` : ''} (주의: 대만해협 명시 1건↑ / 위험: '台湾岛' 주변 명시 또는 대만해협 3건↑)`;
    let url = (tw[0] || detail[0])?.url || `https://www.msa.gov.cn/${MSA_LISTS[2][1]}/index.jhtml`; let label = '중국 해사국(MSA) 항행경고';
    try { // 보조: 보도(최대 주의)
      const { url: nu, items } = await news('중국 해사국 실탄 사격 항행 금지 구역 대만', { days: 7 });
      const re = /(해사국|항행\s?금지|사격\s?구역|실탄\s?사격|금항|禁航).*(대만|타이완|푸젠|동중국해|해협)|(대만|타이완|푸젠|동중국해|해협).*(해사국|항행\s?금지|사격\s?구역|실탄\s?사격|禁航)/;
      const hit = items.filter((i) => re.test(i.title) && !/(과거|년\s?전|회고)/.test(i.title));
      if (hit.length && state === 'normal') { state = 'caution'; summary += ` · 보도 ${hit.length}건으로 주의(공식 공고 미확인): ${hit[0].title}`; url = hit[0].url || nu; label = hit[0].source || 'Google 뉴스'; }
      else if (hit.length) summary += ` · 관련 보도 ${hit.length}건`;
    } catch { /* 보조 실패는 무시 */ }
    wset('msa-exclusion', state, summary, url, label, 'auto');
    for (const d of tw.slice(0, 2)) warEvents.push({ date: d.date, iso: new Date(d.date + 'T00:00:00+08:00').toISOString(), title: `중국 해사국 항행경고 ${d.no}: ${d.area}`, detail: `${d.bureau} 해사국 공식 공고 · 군사훈련/실탄사격`, level: state === 'danger' ? 'danger' : 'caution', direction: 'flat', region: 'strait', source: { label: '중국 해사국', url: d.url } });
  }

  // 3) 진먼·마쭈 해상 압박 빈도 — 최근 14일 중국 해경·민병 선박의 진먼/마쭈 수역 진입·순찰·나포 보도를 '날짜' 기준으로 집계(같은 날 여러 기사=1회)
  async function kinmenMatsu() {
    const qs = [
      ['zh', '中國海警 金門 OR 馬祖 海巡', /(海警船|海警艦|中國海警|中共海警|大陸海警|陸海警|海警局).*(金門|馬祖)|(金門|馬祖).*(海警船|海警艦|中國海警|中共海警|大陸海警|海警局)/],
      ['en', 'China coast guard Kinmen OR Matsu', /(coast guard|militia).*(Kinmen|Matsu)|(Kinmen|Matsu).*(coast guard|militia)/i],
      ['ko', '중국 해경 진먼 마쭈', /(중국\s?해경|해상\s?민병).*(진먼|금문|마쭈)|(진먼|금문|마쭈).*(중국\s?해경|해상\s?민병)/],
    ];
    const hits = []; let okN = 0;
    for (const [lang, q, re] of qs) {
      try { const { items } = await news(q, { days: 14, lang }); okN++; hits.push(...items.filter((i) => re.test(i.title) && !/(颱風|태풍|typhoon|海上警報|海警解除|發布海警|發海警)/i.test(i.title))); } catch { /* 다음 언어 */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!okN) throw new Error('news unreachable');
    const kday = (d) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
    const days = [...new Set(hits.map((h) => kday(h.date)))].sort().reverse();
    const seize = hits.filter((h) => /(扣押|押走|帶走|扣留|登檢|登船|seiz|detain|board|나포|억류|승선)/i.test(h.title));
    const state = days.length >= 4 || seize.length ? 'caution' : 'normal';
    hits.sort((a, b) => b.date - a.date);
    wset('kinmen-matsui-pressure', state,
      hits.length ? `최근 14일 진먼·마쭈 해경 압박 보도 ${days.length}일(기사 ${hits.length}건${seize.length ? `, 나포·승선 언급 ${seize.length}건` : ''}) · 최근: ${hits[0].title} (기준: 4일↑ 또는 나포·승선 보도 → 주의, 보도 집계라 최대 주의)` : '최근 14일 진먼·마쭈 해경 압박 보도 없음(자동 집계)',
      hits[0]?.url || 'https://www.cga.gov.tw/', hits[0]?.source || 'Google 뉴스(중·영·한)', 'news');
    for (const h of hits.slice(0, 2)) warEvents.push({ date: h.date.toISOString().slice(0, 10), iso: h.date.toISOString(), title: h.title, detail: `${h.source || '언론'} 보도 · 진먼·마쭈 해상 압박 자동 수집(사실 확인 전)`, level: state === 'caution' ? 'caution' : 'info', direction: 'flat', region: 'strait', source: { label: h.source || '원문', url: h.url } });
  }

  // 4) 미국 외 동맹(일·호·영) 대만 여행경보 + 동맹 공식 성명 보도(보조, 최대 주의). 미국은 tw-advisory 별도.
  async function alliesTw() {
    const out = []; let lvl = 0; // 0 정상 1 주의 2 위험
    const bump = (v) => { lvl = Math.max(lvl, v); };
    const jobs = [
      ['일본 외무성', 'https://www.anzen.mofa.go.jp/info/pcinfectionspothazardinfo_008.html', async (u) => {
        const t = strip(await get(u, { headers: BROWSER, timeout: 15000 }));
        if (/現在、危険情報は出ておりません/.test(t)) return ['일본: 위험정보 없음', 0];
        const m = t.match(/レベル\s*([1-4１-４])/); if (!m) throw new Error('jp parse');
        const n = Number(String(m[1]).replace(/[１-４]/, (c) => '1234'['１２３４'.indexOf(c)]));
        return [`일본: 위험정보 레벨${n}`, n >= 2 ? 2 : 1];
      }],
      ['호주 Smartraveller', 'https://www.smartraveller.gov.au/destinations/asia/taiwan', async (u) => {
        const t = strip(await get(u, { headers: BROWSER, timeout: 15000 }));
        const m = t.match(/(Do not travel|Reconsider your need to travel|Exercise a high degree of caution|Exercise normal safety precautions)/i); if (!m) throw new Error('au parse');
        const k = m[1].toLowerCase(); const v = k.startsWith('exercise normal') ? 0 : k.startsWith('exercise a high') ? 1 : 2;
        return [`호주: ${['일반 주의(1단계)', '높은 주의(2단계)', '여행 재고 이상(3~4단계)'][v]}`, v];
      }],
      ['영국 FCDO', 'https://www.gov.uk/api/content/foreign-travel-advice/taiwan', async (u) => {
        const d = await get(u, { json: true, timeout: 15000 });
        const a = d.details?.alert_status || [];
        const v = a.some((x) => /avoid_all_travel|avoid_all_but_essential_travel_to_whole/.test(x)) ? 2 : a.length ? 1 : 0;
        return [`영국: ${a.length ? a.join(', ') : '여행 자제 권고 없음'}`, v];
      }],
    ];
    const r = await Promise.all(jobs.map(async ([name, u, fn]) => { try { const [s, v] = await fn(u); bump(v); return { name, u, s, v }; } catch { return { name, u, s: `${name.split(' ')[0]}: 확인 실패`, v: null }; } }));
    const ok = r.filter((x) => x.v != null);
    if (!ok.length) throw new Error('allied advisories all failed');
    const raised = ok.filter((x) => x.v >= 1).length; const high = ok.filter((x) => x.v >= 2).length;
    let state = high >= 2 ? 'danger' : raised >= 1 ? 'caution' : 'normal';
    out.push(...r.map((x) => x.s));
    let note = '';
    try { // 보조: 동맹 공식 성명 보도
      const { items } = await news('대만 해협 일본 호주 미국 공동성명 경고', { days: 7 });
      const re = /(미국|일본|호주|미·일|미일|미일호|G7|美|日|濠).*(대만|타이완|대만\s?해협).*(공동\s?성명|성명|경고|규탄|우려\s?표명)|(대만|타이완|대만\s?해협).*(미국|일본|호주|G7).*(공동\s?성명|성명|경고|규탄)/;
      const hit = items.filter((i) => re.test(i.title));
      if (hit.length >= 3 && state === 'normal') { state = 'caution'; note = ` · 동맹 성명 보도 ${hit.length}건(7일, 3건↑ 보조 주의): ${hit[0].title}`; }
      else if (hit.length) note = ` · 동맹 성명 보도 ${hit.length}건(7일)`;
    } catch { /* 보조 실패 무시 */ }
    const top = r.find((x) => x.v === Math.max(...ok.map((y) => y.v))) || ok[0];
    wset('allies-tw-advisory', state, `${out.join(' · ')}${note} (미국은 '미국의 대만 여행경보' 별도) · 주의: 1개국↑ 상향 / 위험: 2개국↑ 여행 재고·자제 이상`, top.u, top.name);
  }

  // ── 실행 ─────────────────────────────────────────────
  await source('google-news-rss', runNews);
  await source('google-news-war', warNews);
  await Promise.all([
    source('cisa-kev', kev), source('kisa-boho-rss', kisa), source('cisa-advisories', cisaAdvisories),
    source('openai-status', aiStatus), source('claude-status', claude), source('google-cloud-status', gemini),
    source('usgs-earthquakes', quakes), source('kpx', kpx),
    source('coingecko', stable), source('defillama-stablecoins', stableSupply), source('okx-funding', funding), source('upbit-kraken-fx', kimchi),
  ]);

  await source('war-news', warNewsIndicators);
  await Promise.all([source('state-dept', stateDept), source('uk-fcdo', fcdo), source('mofa-jp', mofaJp), source('frankfurter-krw', krw), source('yahoo-kospi', kospi), source('adiz-news', adiz), source('polymarket', polymarket),
    source('mnd-tw-daily', adizByType), source('msa-cn-warnings', msaExclusion), source('kinmen-matsu-news', kinmenMatsu), source('allies-tw-advisory', alliesTw)]);
  // ADIZ: 대만 국방부 공식 수치가 있으면 보도 수치보다 우선(최근 3회 최대)
  if (mnd?.length) {
    const top = mnd.slice(0, 3).reduce((a, b) => (b.aircraft > a.aircraft ? b : a));
    wset('adiz', top.aircraft >= 70 ? 'danger' : top.aircraft >= 30 ? 'caution' : 'normal', `대만 국방부 최근 3회 발표 최대 군용기 ${top.aircraft}대(${top.day || ''}, ADIZ 진입 ${top.adiz}) (기준 30대↑ 주의, 70대↑ 위험)`, top.url, '대만 국방부(MND) 공식 발표');
  }


  // 수동 판정(운영자 확인) 우선
  for (const [key, v] of Object.entries(manual.overrides || {})) {
    if (key.startsWith('W:')) war[key.slice(2)] = { status: v.state, summary: v.summary, source: { label: '운영자 확인', url: v.evidence_url }, checkedAt: v.checked_at, method: 'manual' };
    else res[key] = { ...v, method: 'manual' };
  }
  warEvents.sort((a, b) => b.iso.localeCompare(a.iso));
  const wseen = new Set();
  events.sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set();
  const dedup = events.filter((e) => (seen.has(e.title) ? false : seen.add(e.title)));
  return {
    war: { generated_at: iso(), indicators: war, forecasts: warForecasts, events: warEvents.filter((e) => (wseen.has(e.title) ? false : wseen.add(e.title))).slice(0, 20) },
    hub: { generated_at: iso(), sources_ok: sourcesOk, sources_failed: sourcesFail, states: res, events: dedup.slice(0, 80) },
  };
  }
