/**
 * 허브 페이지 HTML을 빌드 시 문자열로 만든다(프리렌더). 브라우저 JS 없이도 본문이 보이도록.
 * vite.config.ts의 prerender 플러그인이 #app 자리에 넣는다.
 */
import { MODULES, CONTACT, type ModuleMeta } from './data/modules';
import { indicators as warIndicators } from '../data/indicators';
import { events as warEvents } from '../data/events';
import { meta as warMeta } from '../data/meta';
import { computeKoreaRisk, computeStraitRisk, STATUS_LABEL as WAR_STATUS } from '../scoring';
import {
  computeModule, indicatorsOf, stageInfo, STAGES, domainScore, bandOf, EVENTS, GENERATED_AT, SOURCES_OK, SOURCES_FAILED,
  type Indicator, type ModuleResult,
} from './scoring';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const kst = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
const kstDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
let UPDATED = '';
const STATE_TXT = { normal: '정상', caution: '주의', danger: '위험', unknown: '확인 불가' } as const;
const METHOD_TXT = { auto: '공개 API', news: '뉴스 자동 집계(보조)', manual: '운영자 확인', none: '미연결' } as const;
const TIER_TXT = { A: 'A ×4', B: 'B ×2', C: 'C ×1' } as const;

let results = new Map<string, ModuleResult | null>();

function stageChip(r: ModuleResult | null) {
  const s = stageInfo(r?.stage ?? null);
  return s ? `<span class="stage-pill stage-${s.cls}">${s.label}</span>` : `<span class="stage-pill stage-none">${r ? '확인 불가' : '전용 페이지'}</span>`;
}
function stageScale(code: string | null) {
  return `<ol class="stage-scale" aria-label="판정 단계">${STAGES.map((s) => `<li class="stage-${s.cls}${s.code === code ? ' is-current' : ''}">${s.label}<small>${s.min}–${s.max}</small></li>`).join('')}</ol>`;
}
function coverage(r: ModuleResult) {
  const parts = [`공개 API ${r.byMethod.auto}`, `뉴스 보조 ${r.byMethod.news}`];
  if (r.byMethod.manual) parts.push(`운영자 확인 ${r.byMethod.manual}`);
  if (r.byMethod.none) parts.push(`미연결 ${r.byMethod.none}`);
  return `지표 ${r.known}/${r.total}개 판정 · ${parts.join(' · ')}`;
}
function liveBadge(r: ModuleResult | null) {
  if (!r) return '<span class="data-badge">별도 페이지 데이터</span>';
  const partial = r.byMethod.none > 0 || r.byMethod.news > r.byMethod.auto;
  return `<span class="data-badge ${partial ? 'is-partial' : 'is-live'}">${partial ? '공개 데이터 · 일부 보조 판정' : '공개 데이터 자동 판정'}</span>`;
}

export function topbar(active?: string) {
  const order = [MODULES.find((m) => m.code === 'W')!, ...MODULES.filter((m) => m.code !== 'W')];
  const tabs = order.map((m) => {
    const st = m.code === 'W' ? WAR_TAB : stageInfo(results.get(m.code)?.stage ?? null);
    const cur = active === m.slug;
    return `<a href="/${m.slug}" class="tab${cur ? ' is-active' : ''}"${cur ? ' aria-current="page"' : ''}><i class="tab-dot ${st ? 'dot-' + st.cls : 'dot-none'}" aria-hidden="true"></i>${esc(m.name.split('·')[0])}</a>`;
  }).join('');
  return `<div class="notice-bar">공식 경보가 아니며, 점수는 발생 확률이 아닙니다 · 데이터 기준 ${UPDATED} (KST)</div>
<header class="topbar"><a class="brand" href="/"><span class="brand-dot" aria-hidden="true"></span>통합 리스크 허브</a><nav class="hub-tabs" aria-label="모듈">${tabs}</nav></header>
<div class="stale-bar" id="stale-bar" hidden></div>`;
}
export function footer() {
  const ok = Object.keys(SOURCES_OK).length, fail = Object.keys(SOURCES_FAILED).length;
  return `<footer class="footer"><div class="footer-inner">
<div><p class="footer-title">통합 리스크 허브</p><p class="muted">공개 정보만 사용하며 실제 위험은 이 점수보다 높거나 낮을 수 있습니다. 투자·법률 조언이 아닙니다.</p></div>
<div><nav aria-label="하단"><a href="/#hub-method">분석 방법</a> · <a href="/war">전쟁 위험</a> · <a href="mailto:${CONTACT}">문의·정정 요청</a> · <a href="/privacy">개인정보처리방침</a></nav>
<p class="fine">데이터 기준 <time datetime="${GENERATED_AT}" id="generated-at">${UPDATED}</time> (KST) · 정상 수집 소스 ${ok}개${fail ? ` · 실패 ${fail}개(해당 지표 확인 불가 처리)` : ''}</p></div>
</div></footer>`;
}
const CRYPTO_BANNER = `<p class="crypto-banner" role="note">이 페이지는 거래소·코인 시스템의 위기 신호만 보여줍니다. <b>매수·매도 판단에 쓰지 마세요.</b></p>`;

function eventList(list: typeof EVENTS, withModule: boolean) {
  if (!list.length) return '<p class="empty">최근 수집된 관련 사건이 없습니다.</p>';
  return `<ol class="ev-list">${list.map((e) => {
    const m = MODULES.find((x) => x.code === e.module);
    return `<li class="ev lv-${e.level}"><time datetime="${e.date}">${kstDate(e.date)}</time>${withModule && m ? `<a class="ev-mod" href="/${m.slug}">${m.code}</a>` : ''}<a href="${esc(e.url)}" rel="noopener nofollow" target="_blank">${esc(e.title)}</a><span class="ev-src">${esc(e.source || '')}</span></li>`;
  }).join('')}</ol>
<p class="fine">헤드라인은 자동 수집이며 사실 확인 전일 수 있습니다. 원문 출처를 확인하세요.</p>`;
}


// ── 전쟁(한반도+대만) 메인 히어로: 기존 /war 모듈 데이터·규칙 그대로 ──
const WAR_CLS: Record<string, string> = { peace: 'peace', tension: 'tension', alert: 'alert', danger: 'danger' };
let KR = computeKoreaRisk(warIndicators);
let TW = computeStraitRisk(warIndicators);
let WAR_TAB = { cls: WAR_CLS[KR.stage.id] };
let krSignals = warIndicators.filter((i) => i.keySignal);
let twSignals = warIndicators.filter((i) => i.straitKey);
/** 데이터(번들 또는 런타임 최신 스냅샷)가 바뀐 뒤 파생값 재계산. 프리렌더·클라이언트 공용 */
export function recompute() {
  UPDATED = kst(GENERATED_AT);
  results = new Map<string, ModuleResult | null>(MODULES.map((m) => [m.code, m.code === 'W' ? null : computeModule(indicatorsOf(m.code))]));
  KR = computeKoreaRisk(warIndicators);
  TW = computeStraitRisk(warIndicators);
  WAR_TAB = { cls: WAR_CLS[KR.stage.id] };
  krSignals = warIndicators.filter((i) => i.keySignal);
  twSignals = warIndicators.filter((i) => i.straitKey);
}
recompute();
function gauge(score: number, cls: string, label: string, stageLabel: string) {
  return `<div class="wgauge stage-${cls}" style="--p:${score}" role="img" aria-label="${label} ${score}점 ${stageLabel}"><div class="wgauge-in"><span class="gauge-kicker">${label}</span><span class="gauge-score">${score}<small>/100</small></span><span class="stage-pill stage-${cls}">${stageLabel}</span></div></div>`;
}
function warSignalList(list: typeof warIndicators) {
  return `<ul class="signal-list">${list.map((i) => `<li class="signal status-${i.status}"><span class="lamp" aria-hidden="true"></span><span class="signal-name">${esc(i.name)}</span><span class="signal-state">${WAR_STATUS[i.status]}</span></li>`).join('')}</ul>`;
}
function warHero() {
  const krOn = krSignals.filter((i) => i.status === 'danger').length;
  const twOn = twSignals.filter((i) => i.status === 'danger').length;
  const sample = warMeta.isSampleData;
  const wNews = EVENTS.filter((e) => e.module === 'W').slice(0, 4);
  const linked = warEvents.slice(0, 4);
  const recent = linked.length
    ? linked.map((e) => `<li><time datetime="${e.date}">${e.date}</time> ${e.source ? `<a href="${esc(e.source.url)}" target="_blank" rel="noopener nofollow">${esc(e.title)}</a>` : esc(e.title)}</li>`).join('')
    : wNews.map((e) => `<li><time datetime="${e.date}">${kstDate(e.date)}</time> <a href="${esc(e.url)}" target="_blank" rel="noopener nofollow">${esc(e.title)}</a></li>`).join('') || '<li>최근 지표 조건에 걸린 보도 없음</li>';
  const unk = warIndicators.filter((i) => i.status === 'unknown').length;
  return `<section class="hero war-hero" aria-labelledby="hub-title"><div class="hero-inner">
<p class="eyebrow">KOREA · TAIWAN WAR RISK MONITOR</p>
<h1 id="hub-title">한반도·대만 전쟁 위기 감지</h1>
<p class="hero-lead">공식 여행경보·시장 지표와 공개 보도로 한반도와 대만 해협(중국)의 전쟁 위험 신호를 함께 봅니다. 공식 경보가 아니며, 점수는 전쟁 확률이 아닙니다.</p>
<p class="fine">데이터 기준 <time datetime="${warMeta.updatedAt}">${kst(warMeta.updatedAt)}</time> (KST) · 지표 ${warIndicators.length - unk}/${warIndicators.length}개 자동 판정 · 확인 불가 ${unk}개는 점수 제외 · 보도 기반 지표는 최대 '주의'</p>
${sample ? '<p class="sample-badge">⚠ 전쟁 지표는 현재 <b>예시 데이터</b>로 표시됩니다(운영자 판정 갱신 전).</p>' : ''}
<div class="war-grid">
<div class="panel war-panel"><h2 class="war-h">한반도</h2>${gauge(KR.score, WAR_CLS[KR.stage.id], 'RISK SCORE', KR.stage.label)}
<p class="lit-count">${krOn}<small> / ${krSignals.length} 전면전 직전 신호 켜짐</small></p>${warSignalList(krSignals)}
<p class="quick-links"><a class="btn btn-primary" href="/war">한반도 지표 전체 보기</a></p></div>
<div class="panel war-panel"><h2 class="war-h">대만 해협 (중국)</h2>${gauge(TW.score, WAR_CLS[TW.stage.id], 'STRAIT RISK', TW.stage.label)}
<p class="lit-count">${twOn}<small> / ${twSignals.length} 해협 직전 신호 켜짐</small></p>${warSignalList(twSignals)}
<p class="quick-links"><a class="btn btn-primary" href="/war#taiwan">대만 해협 지표 보기</a></p></div>
</div>
<div class="panel war-recent"><h2 class="war-h">최근 한반도·대만 관련 보도</h2><ul class="war-news">${recent}</ul>
<p class="fine">${linked.length ? '지표 조건에 걸린 헤드라인(자동 수집, 사실 확인 전)입니다.' : '자동 수집 헤드라인입니다.'} · <a href="/war#shelter">근처 대피소 찾기</a> · <a href="/war#emergency">비상시 행동 요령</a></p></div>
</div></section>`;
}

// ── 홈 ─────────────────────────────────────────────
export function renderHome() {
  const scored = MODULES.filter((m) => results.get(m.code)?.stage).map((m) => ({ m, r: results.get(m.code)! }));
  const top = [...scored].sort((a, b) => STAGES.findIndex((s) => s.code === b.r.stage) - STAGES.findIndex((s) => s.code === a.r.stage) || (b.r.score ?? 0) - (a.r.score ?? 0))[0];
  const alert = scored.filter((x) => x.r.stage === 'L2' || x.r.stage === 'L3').length;
  const card = (m: ModuleMeta) => {
    const r = results.get(m.code) ?? null; const st = stageInfo(r?.stage ?? null);
    const ev = EVENTS.find((e) => e.module === m.code && e.level !== 'info') ?? EVENTS.find((e) => e.module === m.code);
    return `<li><a class="hub-card band-${st ? st.cls : 'unknown'}" href="/${m.slug}">
<span class="hub-card-top"><span class="hub-code">${m.code}</span><h3>${esc(m.name)}</h3>${liveBadge(r)}</span>
<span class="hub-desc">${esc(m.desc)}</span>
<span class="hub-score-row"><span class="cat-score" aria-label="RISK SCORE">${r?.score ?? '—'}<small>/100</small></span>${stageChip(r)}</span>
<span class="hub-meta"><span>직전 신호</span><b>${r ? `${r.signalsOn ?? '—'}/${r.signalsTotal}` : '전용 페이지'}</b><span>최근</span><b class="hub-ev">${ev ? esc(ev.title) : '—'}</b><span>확인</span><b>${r ? UPDATED : '페이지 참조'}</b></span>
<span class="hub-action">→ ${esc(m.action)}</span>${m.code === 'E' ? '<span class="hub-nofin">투자 조언 아님</span>' : ''}<span class="hub-more">자세히 보기 →</span></a></li>`;
  };
  return `${topbar()}
<main id="main">
${warHero()}
<section class="section hub-summary" aria-labelledby="hub-sum"><h2 id="hub-sum" class="sr-only">다른 위험 요약</h2>
<p class="headline-main">전쟁 외 가장 높은 단계: <b>${top ? `${esc(top.m.name)} · ${stageInfo(top.r.stage)!.label}` : '— · —'}</b> <span class="headline-sub">· 경계 이상 ${alert}/${scored.length}개 모듈 · 데이터 기준 ${UPDATED} (KST)</span></p></section>
<section class="section" aria-labelledby="hub-mods"><div class="section-head"><h2 id="hub-mods">그 밖의 위험 모듈 A~E</h2>
<p class="section-sub">사이버·공급망·AI·재난·코인 위험. 카드를 누르면 지표·근거·최근 사건이 있는 세부 대시보드로 이동합니다.</p></div>
<ul class="hub-grid">${MODULES.filter((m) => m.code !== 'W').map(card).join('')}</ul></section>
<section class="section" aria-labelledby="hub-events"><div class="section-head"><h2 id="hub-events">최근 사건 (A~E)</h2><p class="section-sub">A~E 모듈의 최근 신호를 최신순으로 모았습니다.</p></div>
${eventList(EVENTS.filter((e) => e.module !== 'W' && e.level !== 'info').slice(0, 10), true)}</section>
<section class="section" aria-labelledby="hub-prep"><div class="section-head"><h2 id="hub-prep">지금 미리 해둘 것</h2></div>
<ol class="steps">${[MODULES.find((m) => m.code === 'W')!, ...MODULES.filter((m) => m.code !== 'W')].map((m) => `<li><b>${esc(m.name)}</b> — ${esc(m.prep[0])}</li>`).join('')}</ol></section>
<section class="section longread" id="hub-method" aria-labelledby="hub-method-h"><div class="section-head"><h2 id="hub-method-h">분석 방법</h2></div>
<ol class="steps">
<li>공개 정보 수집 — 공식 API(CISA KEV, KISA, 전력거래소, USGS, 각 AI 상태 페이지, CoinGecko·DefiLlama 등)와 공개 뉴스 헤드라인.</li>
<li>지표별 판정 — 미리 정한 기준으로 정상·주의·위험. 뉴스 자동 집계는 보조 판정이라 최대 '주의'까지만 올립니다. 근거가 없으면 '확인 불가'로 계산에서 뺍니다.</li>
<li>점수 — 정상 0 · 주의 0.5 · 위험 1, 가중치 A×4 · B×2 · C×1의 가중 평균(0–100)을 판정 단계 범위 안으로 맞춥니다.</li>
<li>홈 헤드라인 — 서로 다른 위험을 평균하지 않고, 가장 높은 단계 모듈을 보여줍니다.</li>
</ol>
<h3 class="sub-h">이 페이지의 한계</h3>
<ul class="limits"><li>공개 정보만 사용 → 실제 위험은 점수보다 높거나 낮을 수 있습니다.</li><li>빌드 시점에 수집한 값이며 실시간이 아닙니다. 데이터 기준 시각을 확인하세요.</li><li>점수는 발생 확률이 아니고 공식 경보가 아닙니다. 코인 모듈은 투자 판단 근거가 아닙니다.</li></ul>
</section>
</main>
${footer()}`;
}

// ── 모듈 상세 ────────────────────────────────────────
export function renderModule(slug: string) {
  const m = MODULES.find((x) => x.slug === slug)!;
  const r = results.get(m.code)!;
  const list = indicatorsOf(m.code);
  const signals = list.filter((i) => i.key_signal);
  const sig = (i: Indicator) => `<li class="signal status-${i.state}"><span class="lamp" aria-hidden="true"></span><span class="signal-name">${esc(i.name_ko)}</span><span class="signal-state">${STATE_TXT[i.state]}</span><span class="signal-sum">${esc(i.summary)}</span></li>`;
  const domainCards = Object.entries(m.domains).map(([k, label]) => {
    const sub = list.filter((i) => i.domain === k); const sc = domainScore(sub); const b = bandOf(sc);
    return `<a class="cat-card band-${b ? b.cls : 'unknown'}" href="#d-${k}"><span class="cat-name">${esc(label)}</span><span class="cat-score">${sc ?? '—'}<small>/100</small></span><span class="cat-bar"><i style="width:${sc ?? 0}%"></i></span><span class="cat-meta">지표 ${sub.length}개 · ${b ? b.label : '확인 불가'}</span></a>`;
  }).join('');
  const ind = (i: Indicator) => `<article class="ind-card status-${i.state}"><div class="ind-top"><span class="tier tier-${i.tier}">${i.tier}</span><h4>${esc(i.name_ko)}</h4><span class="status-chip">${STATE_TXT[i.state]}</span></div>
<p class="ind-sum">${esc(i.summary)}</p><details><summary>판정 기준</summary><p class="ind-sum">${esc(i.notes)}</p></details>
<div class="ind-foot"><span>${TIER_TXT[i.tier]} · ${METHOD_TXT[i.method]}${i.mode === 'deeplink_only' ? ' · 점수 제외' : ''}</span>${i.evidence_url ? `<a href="${esc(i.evidence_url)}" target="_blank" rel="noopener nofollow">근거</a>` : '<span>근거 없음</span>'}</div></article>`;
  const indTable = Object.entries(m.domains).map(([k, label]) => {
    const rows = list.filter((i) => i.domain === k);
    return rows.length ? `<h3 class="sub-h" id="d-${k}">${esc(label)}</h3><div class="ind-grid">${rows.map(ind).join('')}</div>` : '';
  }).join('');
  const st = stageInfo(r.stage);
  return `${topbar(m.slug)}
<main id="main">
<nav class="crumb" aria-label="위치"><a href="/">홈</a> › ${esc(m.name)}</nav>
${m.code === 'E' ? CRYPTO_BANNER : ''}
<section class="hero hero--module" aria-labelledby="mod-title"><div class="hero-inner">
<p class="eyebrow">MODULE ${m.code}</p>
<h1 id="mod-title">${esc(m.name)}</h1>
<p class="hero-lead">${esc(m.desc)}${m.note ? `<br><span class="muted">${esc(m.note)}</span>` : ''}</p>
<div class="hero-grid">
<div class="panel"><div class="gauge-static"><span class="gauge-kicker">RISK SCORE</span><span class="gauge-score">${r.score ?? '—'}<small>/100</small></span>${stageChip(r)}</div>
${stageScale(r.stage)}
<p class="meta-line">데이터 기준 ${UPDATED} (KST) · ${st ? st.hint : '근거 부족'}</p>
<p class="meta-line">${coverage(r)}</p><p class="sample-badge">${liveBadge(r)}</p></div>
<div class="panel"><div class="panel-head"><h2>직전 신호</h2><p class="lit-count">${r.signalsOn ?? '—'}<small> / ${r.signalsTotal} 켜짐</small></p></div>
<ul class="signal-list">${signals.map(sig).join('')}</ul>
<p class="fine">램프는 '위험' 판정일 때만 켜집니다. 모두 꺼져 있어도 안전이 보장되는 것은 아닙니다.</p>
<p class="quick-links"><a class="btn btn-ghost" href="#indicators">지표 전체 보기</a></p></div>
</div></div></section>
<section class="section" aria-labelledby="domains-h"><div class="section-head"><h2 id="domains-h">분야별 점수</h2><p class="section-sub">분야 점수는 해당 분야 지표의 가중 평균(단계 보정 없음)입니다.</p></div>
<div class="cat-grid">${domainCards}</div></section>
<section class="section" aria-labelledby="events-h"><div class="section-head"><h2 id="events-h">최근 사건</h2></div>${eventList(EVENTS.filter((e) => e.module === m.code).slice(0, 12), false)}</section>
<section class="section" id="indicators" aria-labelledby="ind-h"><div class="section-head"><h2 id="ind-h">지표 전체 (${list.length}개)</h2><p class="section-sub">각 지표의 현재 판정·근거·판정 기준입니다.</p></div>${indTable}</section>
<section class="section" aria-labelledby="prep-h"><div class="section-head"><h2 id="prep-h">지금 미리 해둘 것</h2></div><ol class="steps">${m.prep.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></section>
<section class="section longread" aria-labelledby="method-h"><div class="section-head"><h2 id="method-h">판정 단계와 한계</h2></div>
<div class="table-wrap"><table class="data-table"><thead><tr><th>단계</th><th>점수</th><th>들어가는 조건</th></tr></thead><tbody>
<tr${r.stage === 'L3' ? ' class="is-current"' : ''}><td class="stage-text stage-danger">위험</td><td class="num">60–100</td><td>A등급 2개 이상 위험</td></tr>
<tr${r.stage === 'L2' ? ' class="is-current"' : ''}><td class="stage-text stage-alert">경계</td><td class="num">35–59</td><td>A 1개 위험 · A 2개 이상 주의+ · B 2개 이상 위험</td></tr>
<tr${r.stage === 'L1' ? ' class="is-current"' : ''}><td class="stage-text stage-tension">주의</td><td class="num">15–34</td><td>B 1개 이상 주의+ · C 2개 이상 주의+</td></tr>
<tr${r.stage === 'L0' ? ' class="is-current"' : ''}><td class="stage-text stage-peace">평시</td><td class="num">0–14</td><td>그 외</td></tr>
</tbody></table></div>
<p class="fine">정상 0 · 주의 0.5 · 위험 1, A×4 · B×2 · C×1 가중 평균을 단계 범위로 보정. 확인 불가는 제외하고, 가중치 절반 이상이 확인 불가면 점수를 표시하지 않습니다.</p>
<ul class="limits"><li>공개 정보만 사용합니다. 공식 경보가 아니며 점수는 발생 확률이 아닙니다.</li><li>뉴스 자동 집계는 헤드라인 키워드 기준의 보조 판정으로, 오탐이 있을 수 있어 최대 '주의'까지만 반영합니다.</li>
${m.code === 'E' ? '<li>가격 방향 예측이 아니며 투자 판단 근거로 쓰지 마세요.</li>' : ''}${m.code === 'A' ? '<li>공격 방법·취약점 악용 정보는 싣지 않습니다. 무엇을 패치할지까지만 안내합니다.</li>' : ''}</ul>
</section>
</main>
${footer()}`;
}

// ── head(SEO) ───────────────────────────────────────
export function headFor(path: string, site: string) {
  const m = MODULES.find((x) => `/${x.slug}` === path);
  const title = m ? `${m.seoTitle} | 통합 리스크 허브` : '한반도·대만 전쟁 위기 감지 — 통합 리스크 허브';
  const desc = m ? m.seoDesc : '한반도와 대만 해협(중국) 전쟁 위험 신호를 공개 보도로 함께 감지하는 대시보드. 사이버 공격·공급망·AI 장애·한국 재난·코인 거래소 위험 점수도 한 화면에. 공식 경보가 아니며 확률이 아닙니다.';
  const kw = m ? m.keywords : '한반도 전쟁 위험, 대만 해협 위기, 중국 대만 침공, 북한 도발, 전쟁 위험 지수, 통합 리스크 허브, 사이버 공격 경보, 공급망 리스크, 재난 경보';
  const url = `${site}${path === '/' ? '/' : path}`;
  const img = `${site}/og-hub.png`;
  const r = m ? results.get(m.code) : null;
  const ld: object[] = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: '통합 리스크 허브', url: `${site}/`, inLanguage: 'ko-KR', description: '공개 데이터 기반 통합 위험 대시보드' },
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'ko-KR', dateModified: GENERATED_AT, isPartOf: { '@type': 'WebSite', url: `${site}/` },
      ...(m ? { breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: `${site}/` }, { '@type': 'ListItem', position: 2, name: m.name, item: url }] } } : {}) },
  ];
  if (!m) {
    ld.push({ '@context': 'https://schema.org', '@type': 'ItemList', name: '위험 모듈', itemListElement: [MODULES.find((x) => x.code === 'W')!, ...MODULES.filter((x) => x.code !== 'W')].map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.code === 'W' ? '한반도·대만 전쟁 위기 감지' : x.name, url: `${site}/${x.slug}` })) });
    (ld[1] as Record<string, unknown>).about = [{ '@type': 'Thing', name: '한반도 전쟁 위험' }, { '@type': 'Thing', name: '대만 해협 위기' }];
  }
  if (m && r) ld.push({ '@context': 'https://schema.org', '@type': 'Dataset', name: `${m.name} 위험 지표`, description: desc, url, dateModified: GENERATED_AT, inLanguage: 'ko-KR', isAccessibleForFree: true, creator: { '@type': 'Organization', name: '통합 리스크 허브', email: CONTACT }, variableMeasured: 'RISK SCORE 0–100' });
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="keywords" content="${esc(kw)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" /><meta property="og:locale" content="ko_KR" /><meta property="og:site_name" content="통합 리스크 허브" />
<meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(desc)}" /><meta property="og:url" content="${url}" />
<meta property="og:image" content="${img}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:alt" content="통합 리스크 허브" />
<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${esc(title)}" /><meta name="twitter:description" content="${esc(desc)}" /><meta name="twitter:image" content="${img}" />
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}
export const HUB_PATHS = ['/', ...MODULES.filter((m) => m.code !== 'W').map((m) => `/${m.slug}`)];
