import type { RiskEvent, Forecast } from '../types';
import warLive from './war-live.json';

/**
 * 최근 사건·예측시장 — war-live.json(빌드 시) 또는 /api/live(런타임 최신)에서 읽습니다.
 * 사건 = 지표 조건에 걸린 공개 보도 헤드라인(자동 수집, 사실 확인 전). 예측 = Polymarket 공개 API, 점수 미반영.
 */
export const events: RiskEvent[] = [];
export const forecasts: Forecast[] = [];
export function applyWarEvents(W: { events: RiskEvent[]; forecasts: Forecast[] }) {
  events.splice(0, events.length, ...W.events.map(({ date, title, detail, level, direction, region, source }) => ({ date, title, detail, level, direction, region, source })));
  forecasts.splice(0, forecasts.length, ...(W.forecasts || []));
}
applyWarEvents(warLive as unknown as { events: RiskEvent[]; forecasts: Forecast[] });
