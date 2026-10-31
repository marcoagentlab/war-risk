/** score-rules.md v0.1 공통 계산 + live.json(공개 데이터 판정) 병합. DOM 없음 → 빌드 시 프리렌더에서도 사용. */
import schema from './data/indicators.json';
import live from './data/live.json';

export type Tier = 'A' | 'B' | 'C';
export type State = 'normal' | 'caution' | 'danger' | 'unknown';
export type StageCode = 'L0' | 'L1' | 'L2' | 'L3';
export type Method = 'auto' | 'news' | 'manual' | 'none';

interface SchemaIndicator {
  id: string; key: string; name_ko: string; module: string; domain: string; tier: Tier;
  weight_hint: number; key_signal: boolean; source_type: string; update_cadence: string; mode: string; notes: string;
}
export interface Indicator extends SchemaIndicator {
  state: State; summary: string; evidence_url: string | null; checked_at: string | null; method: Method;
}
interface LiveState { state: State; summary: string; evidence_url: string | null; checked_at: string; method: Method }
export interface LiveEvent { module: string; indicator: string; date: string; title: string; url: string; source: string; level: 'info' | 'caution' | 'danger' }

export interface HubLive { generated_at: string; sources_ok: Record<string, string>; sources_failed: Record<string, string>; states: Record<string, LiveState>; events: LiveEvent[] }
// ESM live binding: applyHubLive()로 재할당하면 import한 쪽도 새 값을 봄
export let GENERATED_AT = '';
export let SOURCES_OK: Record<string, string> = {};
export let SOURCES_FAILED: Record<string, string> = {};
export let EVENTS: LiveEvent[] = [];

export const STAGES: { code: StageCode; label: string; min: number; max: number; cls: string; hint: string }[] = [
  { code: 'L0', label: '평시', min: 0, max: 14, cls: 'peace', hint: '특이 신호 없음' },
  { code: 'L1', label: '주의', min: 15, max: 34, cls: 'tension', hint: '신호 일부 켜짐' },
  { code: 'L2', label: '경계', min: 35, max: 59, cls: 'alert', hint: '핵심 신호 켜짐' },
  { code: 'L3', label: '위험', min: 60, max: 100, cls: 'danger', hint: '핵심 신호 다수' },
];
const WEIGHT: Record<Tier, number> = { A: 4, B: 2, C: 1 };
const VALUE: Record<Exclude<State, 'unknown'>, number> = { normal: 0, caution: 0.5, danger: 1 };

export const ALL_INDICATORS: Indicator[] = [];
/** live.json 형태 데이터 적용(빌드 시 번들 1회 + 런타임 최신 스냅샷) */
export function applyHubLive(L: HubLive) {
  GENERATED_AT = L.generated_at; SOURCES_OK = L.sources_ok || {}; SOURCES_FAILED = L.sources_failed || {}; EVENTS = L.events || [];
  ALL_INDICATORS.splice(0, ALL_INDICATORS.length, ...(schema as { indicators: SchemaIndicator[] }).indicators.map((i): Indicator => {
    const s = L.states[i.key];
    return s
      ? { ...i, state: s.state, summary: s.summary, evidence_url: s.evidence_url, checked_at: s.checked_at, method: s.method }
      : { ...i, state: 'unknown', summary: i.mode === 'deeplink_only' ? '링크만 제공 · 점수 제외' : '자동 수집 경로 없음 · 수동 확인 필요', evidence_url: null, checked_at: null, method: 'none' };
  }));
}
applyHubLive(live as unknown as HubLive);
export const indicatorsOf = (code: string) => ALL_INDICATORS.filter((i) => i.module === code);

export interface ModuleResult {
  score: number | null; stage: StageCode | null; signalsOn: number | null; signalsTotal: number;
  unknownShare: number; known: number; total: number; byMethod: Record<Method, number>;
}
export function computeModule(list: Indicator[]): ModuleResult {
  const scored = list.filter((i) => i.mode !== 'deeplink_only');
  const signals = list.filter((i) => i.key_signal);
  const total = scored.reduce((s, i) => s + WEIGHT[i.tier], 0);
  const known = scored.filter((i) => i.state !== 'unknown');
  const knownW = known.reduce((s, i) => s + WEIGHT[i.tier], 0);
  const unknownShare = total ? 1 - knownW / total : 1;
  const byMethod = { auto: 0, news: 0, manual: 0, none: 0 } as Record<Method, number>;
  for (const i of scored) byMethod[i.method]++;
  const signalsOn = signals.some((i) => i.state !== 'unknown') ? signals.filter((i) => i.state === 'danger').length : null;
  const base = { signalsOn, signalsTotal: signals.length, unknownShare, known: known.length, total: scored.length, byMethod };
  if (!total || unknownShare >= 0.5) return { score: null, stage: null, ...base };
  const raw = (known.reduce((s, i) => s + VALUE[i.state as Exclude<State, 'unknown'>] * WEIGHT[i.tier], 0) / knownW) * 100;
  const cnt = (tier: Tier, pred: (s: State) => boolean) => known.filter((i) => i.tier === tier && pred(i.state)).length;
  const danger = (s: State) => s === 'danger';
  const cautionPlus = (s: State) => s === 'caution' || s === 'danger';
  let stage: StageCode = 'L0';
  if (cnt('A', danger) >= 2) stage = 'L3';
  else if (cnt('A', danger) >= 1 || cnt('A', cautionPlus) >= 2 || cnt('B', danger) >= 2) stage = 'L2';
  else if (cnt('B', cautionPlus) >= 1 || cnt('C', cautionPlus) >= 2) stage = 'L1';
  const band = STAGES.find((s) => s.code === stage)!;
  return { score: Math.round(Math.min(band.max, Math.max(band.min, raw))), stage, ...base };
}
/** 분야 카드: 가중 평균 원점수(단계 보정 없음). 확인 가능한 지표가 없으면 null */
export function domainScore(list: Indicator[]): number | null {
  const k = list.filter((i) => i.mode !== 'deeplink_only' && i.state !== 'unknown');
  const w = k.reduce((s, i) => s + WEIGHT[i.tier], 0);
  return w ? Math.round((k.reduce((s, i) => s + VALUE[i.state as Exclude<State, 'unknown'>] * WEIGHT[i.tier], 0) / w) * 100) : null;
}
export const bandOf = (score: number | null) => (score == null ? null : STAGES.find((s) => score >= s.min && score <= s.max)!);
export const stageInfo = (code: StageCode | null) => (code ? STAGES.find((s) => s.code === code)! : null);
