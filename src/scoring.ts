import type { CategoryId, Indicator, StageId, Status, Tier } from './types';

export const TIER_WEIGHT: Record<Tier, number> = { A: 4, B: 2, C: 1 };
export const STATUS_VALUE: Record<Exclude<Status, 'unknown'>, number> = { normal: 0, caution: 0.5, danger: 1 };

export interface StageDef {
  id: StageId;
  label: string;
  min: number;
  max: number;
  meaning: string;
  condition: string;
}

export const STAGES: StageDef[] = [
  { id: 'peace', label: '평시', min: 0, max: 14, meaning: '도발이 없거나 평소 수준', condition: '아래 조건에 해당하지 않음' },
  { id: 'tension', label: '긴장', min: 15, max: 34, meaning: '국지적 충돌 신호는 있지만 전면전 준비 징후는 없음', condition: 'B등급 1개 이상 주의 이상, 또는 C등급 2개 이상 주의 이상' },
  { id: 'alert', label: '경계', min: 35, max: 59, meaning: '여러 분야 동시 이상 신호, 대피·외교 지표도 움직이기 시작', condition: 'A등급 1개 위험, A등급 2개 이상 주의 이상, 또는 B등급 2개 이상 위험' },
  { id: 'danger', label: '위험', min: 60, max: 100, meaning: '대피령·동원·대사관 철수 등 전면전 직전 신호 다수', condition: 'A등급 2개 이상 위험' },
];

export const STATUS_LABEL: Record<Status, string> = {
  normal: '정상', caution: '주의', danger: '위험', unknown: '확인 불가',
};

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  military: '군사', diplomatic: '외교·대피', taiwan: '대만·미중', market: '시장',
};

/** 가중 평균(0–100). 확인 불가는 제외. 대상이 없으면 null. */
export function weightedAverage(list: Indicator[]): number | null {
  let sum = 0;
  let w = 0;
  for (const ind of list) {
    if (ind.status === 'unknown') continue;
    const weight = TIER_WEIGHT[ind.tier];
    sum += STATUS_VALUE[ind.status] * weight;
    w += weight;
  }
  return w === 0 ? null : (sum / w) * 100;
}

const atLeast = (s: Status, min: 'caution' | 'danger') =>
  min === 'caution' ? s === 'caution' || s === 'danger' : s === 'danger';

/** 지표가 들어가는 점수 범위(생략 시 기본값 적용) */
export function scopeOf(i: Indicator): 'korea' | 'strait' | 'both' {
  return i.scope ?? (i.category === 'taiwan' ? 'both' : 'korea');
}
/** 한반도 종합 점수에 쓰는 지표 */
export const koreaSet = (list: Indicator[]) => list.filter((i) => scopeOf(i) !== 'strait');
/** 대만 해협 점수에 쓰는 지표: 대만·미중 분야 + scope가 strait/both인 지표 */
export const straitSet = (list: Indicator[]) =>
  list.filter((i) => i.category === 'taiwan' || scopeOf(i) !== 'korea');

/**
 * 단계 판정. respectScoreOnly=false면 scoreOnly를 무시하고 모든 지표로 판정합니다.
 * (scoreOnly는 '한반도 단계 판정에서 제외'라는 뜻이라, 대만 해협 점수에서는 전부 판정에 씁니다.)
 */
export function determineStage(list: Indicator[], respectScoreOnly = true): StageDef {
  const staged = respectScoreOnly ? list.filter((i) => !i.scoreOnly) : list;
  const count = (tier: Tier, min: 'caution' | 'danger') =>
    staged.filter((i) => i.tier === tier && atLeast(i.status, min)).length;

  const aDanger = count('A', 'danger');
  const aCaution = count('A', 'caution');
  const bDanger = count('B', 'danger');
  const bCaution = count('B', 'caution');
  const cCaution = count('C', 'caution');

  let id: StageId = 'peace';
  if (aDanger >= 2) id = 'danger';
  else if (aDanger >= 1 || aCaution >= 2 || bDanger >= 2) id = 'alert';
  else if (bCaution >= 1 || cCaution >= 2) id = 'tension';
  return STAGES.find((s) => s.id === id)!;
}

export interface RiskResult {
  score: number;
  raw: number;
  stage: StageDef;
  counted: number;
  unknown: number;
  byCategory: Record<CategoryId, number | null>;
}

export function computeRisk(list: Indicator[], respectScoreOnly = true): RiskResult {
  const raw = weightedAverage(list) ?? 0;
  const stage = determineStage(list, respectScoreOnly);
  const score = Math.round(Math.min(stage.max, Math.max(stage.min, raw)));
  const cats: CategoryId[] = ['military', 'diplomatic', 'taiwan', 'market'];
  const byCategory = Object.fromEntries(
    cats.map((c) => {
      const v = weightedAverage(list.filter((i) => i.category === c));
      return [c, v === null ? null : Math.round(v)];
    }),
  ) as Record<CategoryId, number | null>;
  return {
    score,
    raw,
    stage,
    counted: list.filter((i) => i.status !== 'unknown').length,
    unknown: list.filter((i) => i.status === 'unknown').length,
    byCategory,
  };
}

/** 한반도 종합 점수 (기존 규칙 그대로) */
export const computeKoreaRisk = (all: Indicator[]) => computeRisk(koreaSet(all), true);
/** 대만 해협 점수: 해협 지표만으로 같은 단계 규칙 적용 (scoreOnly 무시) */
export const computeStraitRisk = (all: Indicator[]) => computeRisk(straitSet(all), false);
