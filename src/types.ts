export type Tier = 'A' | 'B' | 'C';
export type Status = 'normal' | 'caution' | 'danger' | 'unknown';
export type CategoryId = 'military' | 'diplomatic' | 'taiwan' | 'market';
export type StageId = 'peace' | 'tension' | 'alert' | 'danger';

export interface Indicator {
  id: string;
  name: string;
  category: CategoryId;
  tier: Tier;
  status: Status;
  /** 현재 상태를 한 줄로 설명 */
  summary: string;
  /** 정상/주의/위험을 가르는 판단 기준 */
  criteria: { normal: string; caution: string; danger: string };
  /** true면 점수에는 반영하되 단계 판정 규칙에서는 제외 */
  scoreOnly?: boolean;
  /** 첫 화면 '전면전 직전 신호'에 표시 (한반도) */
  keySignal?: boolean;
  /**
   * 어느 점수에 들어가는지. 생략 시: category가 'taiwan'이면 'both', 그 외는 'korea'.
   * - korea: 한반도 점수만 / strait: 대만 해협 점수만 / both: 둘 다
   */
  scope?: 'korea' | 'strait' | 'both';
  /** 대만 해협 블록의 '해협 직전 신호' 램프에 표시 */
  straitKey?: boolean;
  source?: { label: string; url: string };
  checkedAt?: string;
}

export interface RiskEvent {
  date: string; // YYYY-MM-DD
  title: string;
  detail: string;
  level: 'info' | 'caution' | 'danger';
  direction: 'up' | 'down' | 'flat';
  /** 'strait'면 대만 해협 관련 사건(타임라인에 태그 표시) */
  region?: 'korea' | 'strait';
  source?: { label: string; url: string };
}

export interface Forecast {
  question: string;
  probability: number; // 0–100
  platform: string;
  url?: string;
  note?: string;
}

export interface SourceRef {
  text: string;
  link?: { label: string; url: string };
}

export interface Principle {
  title: string;
  body: string;
  refs: SourceRef[];
}
