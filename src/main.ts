import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './styles.css';
import { indicators, applyWarIndicators } from './data/indicators';

inject();
injectSpeedInsights();
import { events, forecasts, applyWarEvents } from './data/events';
import { fetchLive, isNewer } from './live';
import { principles } from './data/sources';
import { meta } from './data/meta';
import {
  CATEGORY_LABEL, STAGES, STATUS_LABEL, TIER_WEIGHT, computeKoreaRisk, computeStraitRisk,
  koreaSet, scopeOf, straitSet, type RiskResult,
} from './scoring';
import type { CategoryId, Indicator, Tier } from './types';
import { initAds } from './ads';
import { initShare } from './share';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const CATEGORY_INTRO: Record<CategoryId, string> = {
  military:
    '미사일 발사나 군사분계선 침범은 평소에도 잦아 C등급(×1)입니다. 포병 배치·워치콘·서해 NLL·핵실험 징후는 군사 태세 변화라 B등급(×2), 병력 동원은 실제 전쟁 준비 때만 나오고 숨기기 어려워 A등급(×4)으로 가장 무겁게 봅니다.',
  diplomatic:
    '각국 정부는 비공개 정보까지 반영해 자국민 보호 조치를 내립니다. 그래서 여행경보 상향이나 주한미군 가족 대피(NEO)는 공개 정보 중 가장 믿을 만한 경고입니다. 대피는 비용이 매우 커서 확신이 없으면 발령하지 않습니다.',
  taiwan:
    '대만 문제는 한반도와 별개지만 미중 관계와 주한미군 역할 논의로 이어질 수 있습니다. 평소의 대만 신호는 점수에만 가볍게 반영하고, 실제 봉쇄·공격만 A등급으로 단계 판정과 첫 화면 신호에 씁니다. 대만 분쟁이 한반도로 번질지는 전문가 사이에서도 의견이 갈립니다.',
  market:
    '외국인 투자자는 전쟁 위험을 느끼면 먼저 돈을 뺍니다. 원화 급락과 CDS 급등이 함께 나타나면 시장이 위험을 가격에 반영하기 시작했다는 뜻입니다. 주가는 다른 이유로도 크게 움직이므로 단독으로는 약한 신호입니다.',
};

const STAGE_COLOR: Record<string, string> = {
  peace: 'var(--ok)', tension: 'var(--warn)', alert: 'var(--alert)', danger: 'var(--danger)',
};

function formatKst(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d) + ' (KST)';
}

function heroLead(r: RiskResult, lit: number) {
  const base = `종합 위험 점수는 <b>${r.score}점</b>, 판정은 <b class="stage-text stage-${r.stage.id}">${r.stage.label}</b>입니다. `;
  const body =
    lit === 0
      ? r.stage.id === 'peace'
        ? '눈에 띄는 도발 신호가 적고, 전면전 직전에 나오는 신호도 없습니다. '
        : '국지적 긴장 신호는 있지만, 대피령·여행경보처럼 전면전 직전에 나오는 신호는 아직 없습니다. '
      : `전면전 직전 신호 ${lit}개가 켜져 있습니다. 정부 발표와 재난문자를 꼭 확인하세요. `;
  return base + body + '<span class="muted">이 점수는 전쟁이 날 확률이 아닙니다.</span>';
}

/** 게이지·단계 pill·단계 눈금 공통 렌더 (prefix: '' = 한반도, 'tw-' = 대만 해협) */
function renderGauge(r: RiskResult, prefix: string, label: string) {
  $(`#${prefix}score`).textContent = String(r.score);
  const pill = $(`#${prefix}stage-pill`);
  pill.textContent = r.stage.label;
  pill.className = `stage-pill stage-${r.stage.id}`;
  $(`#${prefix}gauge`).setAttribute('aria-label', `${label} ${r.score}점 / 100, 판정 ${r.stage.label}`);

  const circle = $(`#${prefix}gauge-value`) as unknown as SVGCircleElement;
  const C = 2 * Math.PI * 92;
  circle.style.strokeDasharray = `${C}`;
  circle.style.strokeDashoffset = `${C}`;
  requestAnimationFrame(() => {
    circle.style.strokeDashoffset = `${C * (1 - r.score / 100)}`;
  });

  $(`#${prefix}stage-scale`).innerHTML = STAGES.map(
    (s) => `<li class="${s.id === r.stage.id ? 'is-current' : ''} stage-${s.id}"><span>${s.label}</span><small>${s.min}–${s.max}</small></li>`,
  ).join('');
}

function signalItems(keys: Indicator[]) {
  return keys
    .map(
      (i) => `<li class="signal status-${i.status}">
        <span class="lamp" aria-hidden="true"></span>
        <span class="signal-name"><span class="tier tier-${i.tier}" title="가중치 ${TIER_WEIGHT[i.tier]}">${i.tier}</span> ${esc(i.name)}</span>
        <span class="signal-state">${i.status === 'danger' ? '켜짐' : STATUS_LABEL[i.status]}</span>
        <span class="signal-sum">${esc(i.summary)}</span>
      </li>`,
    )
    .join('');
}

function renderHero(r: RiskResult) {
  const keys = indicators.filter((i) => i.keySignal);
  const lit = keys.filter((i) => i.status === 'danger').length;

  renderGauge(r, '', '한반도 종합 위험 점수');
  document.documentElement.style.setProperty('--stage-color', STAGE_COLOR[r.stage.id]);

  $('#hero-lead').innerHTML = heroLead(r, lit);
  $('#lit-count').textContent = String(lit);
  $('#signal-list').innerHTML = keys
    .map(
      (i) => `<li class="signal status-${i.status}">
        <span class="lamp" aria-hidden="true"></span>
        <span class="signal-name">${esc(i.name)}</span>
        <span class="signal-state">${i.status === 'danger' ? '켜짐' : STATUS_LABEL[i.status]}</span>
        <span class="signal-sum">${esc(i.summary)}</span>
      </li>`,
    )
    .join('');

  $('#updated-at').textContent = formatKst(meta.updatedAt);
  $('#updated-at').setAttribute('datetime', meta.updatedAt);
  $('#refresh-note').textContent = meta.refreshNote;
  $('#sample-badge').hidden = !meta.isSampleData;
}

function straitLead(r: RiskResult, lit: number, flagged: number) {
  const base = `대만 해협 점수는 <b>${r.score}점</b>, 판정은 <b class="stage-text stage-${r.stage.id}">${r.stage.label}</b>입니다. `;
  const body =
    lit > 0
      ? `해협 직전 신호 ${lit}개가 켜져 있습니다. 대만·미국 정부 발표를 함께 확인하세요. `
      : flagged > 0
        ? `회색지대 압박(방공식별구역 진입·해경 활동 등) 신호 ${flagged}개가 주의 이상이지만, 봉쇄·상륙 같은 직전 신호는 없습니다. `
        : '평소 수준의 군사 활동만 보이고, 봉쇄·상륙 같은 직전 신호는 없습니다. ';
  return base + body + '<span class="muted">한반도 점수와 별도이며, 전쟁 확률이 아닙니다.</span>';
}

function renderStrait(r: RiskResult) {
  const set = straitSet(indicators);
  const keys = set.filter((i) => i.straitKey);
  const lit = keys.filter((i) => i.status === 'danger').length;
  const flagged = set.filter((i) => i.status === 'caution' || i.status === 'danger').length;

  renderGauge(r, 'tw-', '대만 해협 위험 점수');
  $('#strait').style.setProperty('--stage-color', STAGE_COLOR[r.stage.id]);
  $('#tw-lead').innerHTML = straitLead(r, lit, flagged);
  $('#tw-lit-count').textContent = String(lit);
  $('#tw-key-total').textContent = String(keys.length);
  $('#tw-signal-list').innerHTML = signalItems(keys);
  $('#tw-count').textContent = String(r.counted);
  $('#tw-ind-total').textContent = String(set.length);
  $('#tw-method-count').textContent = String(set.length);
  $('#tw-ind-grid').innerHTML = set.map(indicatorCard).join('');
}

function scoreBand(v: number | null) {
  if (v === null) return 'unknown';
  if (v >= 60) return 'danger';
  if (v >= 35) return 'alert';
  if (v >= 15) return 'tension';
  return 'peace';
}

function renderCategories(r: RiskResult) {
  const cats = Object.keys(CATEGORY_LABEL) as CategoryId[];
  const cards = cats.map((c) => {
    const v = r.byCategory[c];
    const list = koreaSet(indicators).filter((i) => i.category === c);
    const flagged = list.filter((i) => i.status === 'caution' || i.status === 'danger').length;
    return `<a class="cat-card band-${scoreBand(v)}" href="#cat-${c}">
      <span class="cat-name">${CATEGORY_LABEL[c]}</span>
      <span class="cat-score">${v === null ? '—' : v}<small>/100</small></span>
      <span class="cat-bar"><i style="width:${v ?? 0}%"></i></span>
      <span class="cat-meta">지표 ${list.length}개 · 주의 이상 ${flagged}개</span>
    </a>`;
  });
  cards.push(`<a class="cat-card band-ref" href="#cat-forecast">
      <span class="cat-name">예측시장</span>
      <span class="cat-score">참고<small></small></span>
      <span class="cat-bar"><i style="width:0%"></i></span>
      <span class="cat-meta">${forecasts.length}개 질문 · 점수 미반영</span>
    </a>`);
  $('#cat-grid').innerHTML = cards.join('');

  $('#category-details').innerHTML = cats
    .map((c) => {
      const list = koreaSet(indicators).filter((i) => i.category === c);
      const extra = c === 'taiwan'
        ? `<p class="fine">대만 해협 전용 지표(상륙 징후·대만 여행경보 등)와 별도 해협 점수는 <a href="#strait">대만 해협 전쟁 위험 지표</a>에서 볼 수 있습니다.</p>`
        : '';
      return `<div class="cat-detail" id="cat-${c}">
        <div class="cat-detail-head">
          <h2>${CATEGORY_LABEL[c]} 신호</h2>
          <span class="tag band-${scoreBand(r.byCategory[c])}">분야 점수 ${r.byCategory[c] ?? '—'}</span>
        </div>
        <p>${CATEGORY_INTRO[c]}</p>${extra}
        <div class="ind-grid">${list.map(indicatorCard).join('')}</div>
      </div>`;
    })
    .join('');
}

function indicatorCard(i: Indicator) {
  return `<div class="ind-card status-${i.status}">
    <div class="ind-top">
      <span class="tier tier-${i.tier}" title="가중치 ${TIER_WEIGHT[i.tier]}">${i.tier}</span>
      <h3>${esc(i.name)}</h3>
      ${scopeOf(i) === 'strait' ? '<span class="scope-chip" title="한반도 점수에는 미반영">해협 전용</span>' : ''}
      <span class="status-chip">${STATUS_LABEL[i.status]}</span>
    </div>
    <p class="ind-sum">${esc(i.summary)}</p>
    <details>
      <summary>판단 기준${i.scoreOnly ? ' · 점수만 반영' : ''}</summary>
      <dl class="criteria">
        <dt class="c-normal">정상</dt><dd>${esc(i.criteria.normal)}</dd>
        <dt class="c-caution">주의</dt><dd>${esc(i.criteria.caution)}</dd>
        <dt class="c-danger">위험</dt><dd>${esc(i.criteria.danger)}</dd>
      </dl>
    </details>
    <div class="ind-foot">
      ${i.source ? `<a href="${esc(i.source.url)}" target="_blank" rel="noopener">${esc(i.source.label)} ↗</a>` : '<span></span>'}
      ${i.checkedAt ? `<time>${esc(i.checkedAt)}</time>` : ''}
    </div>
  </div>`;
}

function renderForecasts() {
  $('#forecast-list').innerHTML = forecasts
    .map(
      (f) => `<div class="forecast">
      <div class="fc-q">${esc(f.question)}</div>
      <div class="fc-bar"><i style="width:${Math.min(100, Math.max(0, f.probability))}%"></i></div>
      <div class="fc-meta"><b>${f.probability}%</b> · ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.platform)}</a>` : esc(f.platform)}${f.note ? ` · <span class="muted">${esc(f.note)}</span>` : ''}</div>
    </div>`,
    )
    .join('');
}

function renderEvents() {
  const LEVEL: Record<string, string> = { info: '정보', caution: '주의', danger: '위험' };
  const DIR: Record<string, string> = { up: '▲ 긴장 상승', down: '▼ 긴장 완화', flat: '■ 영향 적음' };
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  $('#timeline').innerHTML = sorted
    .map(
      (e) => `<li class="tl-item lv-${e.level}">
      <div class="tl-date"><time datetime="${e.date}">${e.date.replace(/-/g, '.')}</time></div>
      <div class="tl-body">
        <div class="tl-tags">${e.region === 'strait' ? '<span class="region-chip">대만 해협</span>' : ''}<span class="lv-chip">${LEVEL[e.level]}</span><span class="dir dir-${e.direction}">${DIR[e.direction]}</span></div>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.detail)}</p>
        ${e.source ? `<a href="${esc(e.source.url)}" target="_blank" rel="noopener">${esc(e.source.label)} ↗</a>` : ''}
      </div>
    </li>`,
    )
    .join('');
}

function renderMethod(r: RiskResult) {
  $('#ind-count').textContent = String(koreaSet(indicators).length);
  $('#stage-table tbody').innerHTML = STAGES.map(
    (s) => `<tr class="${s.id === r.stage.id ? 'is-current' : ''}">
      <td><span class="stage-text stage-${s.id}">${s.label}</span></td>
      <td class="num">${s.min}–${s.max}</td><td>${s.meaning}</td><td>${s.condition}</td></tr>`,
  ).join('');

  const nature: Record<Tier, string> = {
    A: '전면전 직전에만 나오는 비싼 행동',
    B: '군사 태세 변화와 실제 피해',
    C: '자주 반복되는 신호',
  };
  $('#weight-table tbody').innerHTML = (['A', 'B', 'C'] as Tier[])
    .map(
      (t) => `<tr><td><span class="tier tier-${t}">${t}</span></td><td class="num">×${TIER_WEIGHT[t]}</td><td>${nature[t]}</td>
      <td>${indicators.filter((i) => i.tier === t).map((i) => esc(i.name)).join(', ')}</td></tr>`,
    )
    .join('');

  $('#principles').innerHTML = principles
    .map(
      (p, idx) => `<details class="principle"${idx === 0 ? ' open' : ''}>
      <summary><span class="p-num">${idx + 1}</span>${esc(p.title)}</summary>
      <p>${esc(p.body)}</p>
      <ul class="refs">${p.refs
        .map((ref) => `<li>${esc(ref.text)}${ref.link ? ` <a href="${esc(ref.link.url)}" target="_blank" rel="noopener">${esc(ref.link.label)} ↗</a>` : ''}</li>`)
        .join('')}</ul>
    </details>`,
    )
    .join('');
}

const CHECKLIST = [
  '물 (1인 하루 3L × 3일분)', '비상식량', '손전등', '여분 건전지', '휴대용 라디오', '보조배터리',
  '방독면 (KS 인증)', '마스크', '상비약', '신분증 사본', '현금', '가족 연락처 메모',
];

function renderChecklist() {
  const KEY = 'wrd-checklist-v1';
  let saved: Record<string, boolean> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* ignore */ }
  const ul = $('#checklist');
  ul.innerHTML = CHECKLIST.map(
    (item, idx) => `<li><label><input type="checkbox" data-idx="${idx}" ${saved[idx] ? 'checked' : ''}/> <span>${item}</span></label></li>`,
  ).join('');
  ul.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.dataset.idx) return;
    saved[t.dataset.idx] = t.checked;
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  });
}

function renderFooter() {
  const a = $<HTMLAnchorElement>('#contact-link');
  a.href = `mailto:${meta.contactEmail}?subject=${encodeURIComponent('[전쟁 위험 지표] 문의·정정 요청')}`;
  a.textContent = meta.contactEmail;
  $('#year').textContent = String(new Date().getFullYear());
}

/** 최신 스냅샷(/api/live, 매일 정오 KST 갱신)이 빌드 데이터보다 새로우면 적용 후 렌더. 실패 시 빌드 데이터 그대로. */
async function boot() {
  const snap = await fetchLive(2500);
  if (snap && isNewer(snap.war.generated_at, meta.updatedAt)) {
    try {
      applyWarIndicators(snap.war as unknown as Parameters<typeof applyWarIndicators>[0]);
      applyWarEvents(snap.war as unknown as Parameters<typeof applyWarEvents>[0]);
      meta.updatedAt = snap.war.generated_at;
    } catch (e) { console.warn('[live] apply failed', e); }
  }
  const result = computeKoreaRisk(indicators);
  const strait = computeStraitRisk(indicators);
  renderHero(result);
  renderStrait(strait);
  renderCategories(result);
  renderForecasts();
  renderEvents();
  renderMethod(result);
  renderChecklist();
  renderFooter();
  initShare(`한반도 전쟁 위험 지표 — 현재 ${result.score}점 (${result.stage.label}) · 대만 해협 ${strait.score}점 (${strait.stage.label})`);
  initAds();
}
boot().finally(() => (window as unknown as { __splashDone?: () => void }).__splashDone?.());
