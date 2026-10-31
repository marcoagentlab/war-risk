import type { Indicator } from '../types';
import warLive from './war-live.json';

/**
 * 지표 목록 (편집용 데이터 모듈)
 * ------------------------------------------------------------
 * status: 'normal' | 'caution' | 'danger' | 'unknown'
 *  - unknown(확인 불가)은 점수 계산에서 빠집니다.
 * tier: A(가중치 4) / B(2) / C(1)
 * 아래 status/summary는 초기 seed이며 화면에는 쓰이지 않습니다(맨 아래 war-live.json 덮어쓰기 참고).
 */
const SAMPLE = '2026-10-30';

export const seed: Indicator[] = [
  // ───────── 외교·대피 ─────────
  {
    id: 'neo', name: '주한미군 가족 대피(NEO)', category: 'diplomatic', tier: 'A', keySignal: true,
    status: 'normal', summary: '정례 대피 훈련 외 실제 발령 보도 없음',
    criteria: { normal: '정례 훈련만 있음', caution: '비정기 대피 준비·점검 지시 보도', danger: '실제 비전투원 대피 명령 발령' },
    source: { label: 'USFK', url: 'https://www.usfk.mil/' }, checkedAt: SAMPLE,
  },
  {
    id: 'us-advisory', name: '미국 여행경보', category: 'diplomatic', tier: 'A', keySignal: true,
    status: 'normal', summary: '한국 1단계(일반 주의) 유지',
    criteria: { normal: '1단계', caution: '2단계(주의 강화)', danger: '3단계(여행 재고) 이상' },
    source: { label: '미 국무부 Travel Advisory', url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html' }, checkedAt: SAMPLE,
  },
  {
    id: 'embassy', name: '대사관 철수', category: 'diplomatic', tier: 'A', keySignal: true,
    status: 'normal', summary: '주요국 공관 정상 운영',
    criteria: { normal: '정상 운영', caution: '비필수 인원 출국 권고', danger: '공관 철수·인원 대폭 감축' },
    checkedAt: SAMPLE,
  },
  {
    id: 'jp-info', name: '일본 해외안전 위험정보', category: 'diplomatic', tier: 'B',
    status: 'normal', summary: '한국 대상 위험정보 미발령',
    criteria: { normal: '미발령', caution: '레벨 1(충분한 주의)', danger: '레벨 2 이상' },
    source: { label: '일본 외무성 해외안전', url: 'https://www.anzen.mofa.go.jp/' }, checkedAt: SAMPLE,
  },
  {
    id: 'other-advisory', name: '주요국 여행경보(영·독·호 등)', category: 'diplomatic', tier: 'B',
    status: 'normal', summary: '특이 상향 없음',
    criteria: { normal: '변동 없음', caution: '1개국 이상 상향', danger: '여러 나라 동시 여행 자제 이상' },
    checkedAt: SAMPLE,
  },
  {
    id: 'civil-defense', name: '민방위 실제 경보', category: 'diplomatic', tier: 'B',
    status: 'normal', summary: '정례 민방위 훈련 외 실제 경보 없음',
    criteria: { normal: '훈련만 있음', caution: '일부 지역 경계경보·오발령', danger: '실제 공습경보 발령' },
    source: { label: '국민재난안전포털', url: 'https://www.safekorea.go.kr/' }, checkedAt: SAMPLE,
  },

  // ───────── 군사 ─────────
  {
    id: 'mobilization', name: '북한 병력 동원', category: 'military', tier: 'A', keySignal: true,
    status: 'normal', summary: '대규모 예비군 소집·연료 이동 보도 없음',
    criteria: { normal: '징후 없음', caution: '부분 소집·이례적 이동 보도', danger: '전군 동원·대규모 전진 배치' },
    checkedAt: SAMPLE,
  },
  {
    id: 'watchcon', name: '정보감시태세(워치콘)', category: 'military', tier: 'B', keySignal: true,
    status: 'normal', summary: '평시 수준(3단계)로 보도됨',
    criteria: { normal: '3단계 이하 유지', caution: '2단계 상향', danger: '1단계 상향' },
    source: { label: 'GlobalSecurity: WATCHCON', url: 'https://www.globalsecurity.org/military/ops/watchcon.htm' }, checkedAt: SAMPLE,
  },
  {
    id: 'artillery', name: '접경 포병 배치', category: 'military', tier: 'B',
    status: 'caution', summary: '접경 지역 포문 개방·진지 보강 보도(예시)',
    criteria: { normal: '특이 동향 없음', caution: '포문 개방·진지 공사', danger: '대규모 전진 배치 또는 실제 포격' },
    checkedAt: SAMPLE,
  },
  {
    id: 'dmz-incident', name: 'DMZ 피해 사건', category: 'military', tier: 'B',
    status: 'normal', summary: '최근 30일 인명 피해 사건 없음',
    criteria: { normal: '사건 없음', caution: '인명 피해 없는 지뢰·총격', danger: '사상자 발생(30일간 유지)' },
    checkedAt: SAMPLE,
  },
  {
    id: 'nll', name: '서해 NLL', category: 'military', tier: 'B',
    status: 'normal', summary: '경고 사격·교전 보도 없음',
    criteria: { normal: '특이 동향 없음', caution: '경비정 침범·경고사격', danger: '교전·포격' },
    checkedAt: SAMPLE,
  },
  {
    id: 'nuke-test', name: '핵실험 징후', category: 'military', tier: 'B',
    status: 'caution', summary: '풍계리 갱도 활동 관측 보도 지속(예시)',
    criteria: { normal: '징후 없음', caution: '갱도 복구·장비 이동 관측', danger: '실험 임박 평가 또는 실시' },
    source: { label: '38 North', url: 'https://www.38north.org/' }, checkedAt: SAMPLE,
  },
  {
    id: 'missile', name: '미사일 발사', category: 'military', tier: 'C',
    status: 'caution', summary: '최근 30일 내 단거리 탄도미사일 발사(예시)',
    criteria: { normal: '30일간 발사 없음', caution: '단거리·순항 발사', danger: 'ICBM·일본 상공 통과 발사' },
    checkedAt: SAMPLE,
  },
  {
    id: 'mdl', name: '군사분계선 침범', category: 'military', tier: 'C',
    status: 'normal', summary: '최근 침범 보도 없음',
    criteria: { normal: '없음', caution: '단순 침범·경고사격', danger: '반복 침범·무력 충돌' },
    checkedAt: SAMPLE,
  },
  {
    id: 'psyops', name: '대남 심리전', category: 'military', tier: 'C',
    status: 'normal', summary: '오물풍선·확성기 활동 소강',
    criteria: { normal: '소강', caution: '풍선·확성기 재개', danger: '피해 동반 대규모 살포' },
    checkedAt: SAMPLE,
  },
  {
    id: 'gps', name: 'GPS 교란', category: 'military', tier: 'C',
    status: 'unknown', summary: '최근 확인 가능한 보도 부족 → 계산 제외',
    criteria: { normal: '보고 없음', caution: '서북도서 일대 교란 보고', danger: '광역·장기 교란' },
    checkedAt: SAMPLE,
  },
  {
    id: 'dialogue', name: '남북 대화 채널', category: 'military', tier: 'C',
    status: 'caution', summary: '공식 연락 채널 단절 지속(예시)',
    criteria: { normal: '연락 채널 정상', caution: '채널 단절', danger: '적대 선언·합의 전면 파기' },
    checkedAt: SAMPLE,
  },

  // ───────── 대만·미중 ─────────
  {
    id: 'taiwan-blockade', name: '중국의 대만 봉쇄·공격', category: 'taiwan', tier: 'A', keySignal: true, straitKey: true,
    status: 'normal', summary: '실제 봉쇄·무력 공격 없음',
    criteria: { normal: '없음', caution: '봉쇄 선언 또는 검문 개시', danger: '실제 봉쇄·공격 개시' },
    checkedAt: SAMPLE,
  },
  {
    id: 'pla-drill', name: '중국군 대만 주변 대규모 봉쇄형 훈련', category: 'taiwan', tier: 'B', scoreOnly: true, straitKey: true,
    status: 'normal', summary: '대규모 명명 훈련 없음',
    criteria: { normal: '정기 수준', caution: '명명된 포위 훈련', danger: '실탄·봉쇄 형태 훈련 장기화' },
    checkedAt: SAMPLE,
  },
  {
    id: 'adiz', name: '중국군 대만 방공식별구역 진입', category: 'taiwan', tier: 'C', scoreOnly: true,
    status: 'caution', summary: '일일 진입 건수 평시보다 다소 많음(예시)',
    criteria: { normal: '평시 수준', caution: '하루 30대 이상', danger: '하루 70대 이상 반복' },
    source: { label: '대만 국방부', url: 'https://www.mnd.gov.tw/' }, checkedAt: SAMPLE,
  },
  {
    id: 'us-china', name: '미중 정상 외교', category: 'taiwan', tier: 'C', scoreOnly: true,
    status: 'normal', summary: '정상 간 소통 채널 유지',
    criteria: { normal: '소통 유지', caution: '회담 취소·채널 중단', danger: '제재 맞불·군사 채널 단절' },
    checkedAt: SAMPLE,
  },
  {
    id: 'usfk-role', name: '대만 유사시 주한미군 역할 논의', category: 'taiwan', tier: 'C', scoreOnly: true,
    status: 'normal', summary: '정책 변화 보도 없음',
    criteria: { normal: '논의 수준', caution: '전력 차출 검토 보도', danger: '실제 전력 이동' },
    checkedAt: SAMPLE,
  },

  // ───────── 대만 해협 전용 (scope: 'strait' → 한반도 점수에는 미반영) ─────────
  {
    id: 'amphib', name: '대규모 상륙 징후·동원', category: 'taiwan', tier: 'A', scope: 'strait', straitKey: true,
    status: 'normal', summary: '상륙함·민간 로로선 집결, 예비역 소집 보도 없음',
    criteria: { normal: '징후 없음', caution: '푸젠·저장 연안 상륙전력·민간선박 이례적 집결 보도', danger: '대규모 집결 + 동원령·혈액·연료 비축 등 복합 징후' },
    checkedAt: SAMPLE,
  },
  {
    id: 'tw-advisory', name: '미국의 대만 여행경보', category: 'taiwan', tier: 'A', scope: 'strait', straitKey: true,
    status: 'normal', summary: '대만 1단계(일반 주의) 유지',
    criteria: { normal: '1단계', caution: '2단계(주의 강화) 또는 비필수 인원 출국 허용', danger: '3단계 이상 또는 비필수 인원 출국 명령' },
    source: { label: '미 국무부 Travel Advisory', url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html' }, checkedAt: SAMPLE,
  },
  {
    id: 'us-deploy', name: '미군 대만 관련 긴급 배치', category: 'taiwan', tier: 'B', scope: 'strait', straitKey: true,
    status: 'normal', summary: '정례 항모 순환·해협 통과 외 긴급 증원 없음',
    criteria: { normal: '정례 순환·통과', caution: '항모 2척 이상 서태평양 긴급 집결', danger: '대만 방어 명시 긴급 전개·전투 태세 상향' },
    checkedAt: SAMPLE,
  },
  {
    id: 'cg-inspection', name: '중국 해경 검문·진먼/마쭈 압박', category: 'taiwan', tier: 'B', scope: 'strait',
    status: 'caution', summary: '진먼 주변 해경 순찰·승선 검사 시도 보도(예시)',
    criteria: { normal: '정례 순찰', caution: '대만 관할 수역 진입·승선 검사 시도', danger: '선박 나포·통항 차단 개시' },
    source: { label: '대만 해순서(CGA)', url: 'https://www.cga.gov.tw/' }, checkedAt: SAMPLE,
  },
  {
    id: 'strait-shipping', name: '해협 해운·전쟁보험료', category: 'taiwan', tier: 'C', scope: 'strait',
    status: 'normal', summary: '항로 변경·보험료 급등 보도 없음',
    criteria: { normal: '평시', caution: '전쟁위험 할증 부과·일부 선사 우회', danger: '주요 선사 운항 중단' },
    checkedAt: SAMPLE,
  },

  // 2026-10-31 추가: 대만·해협 지표 다양화
  {
    id: 'adiz-by-type', name: '대만 ADIZ 진입 기종·함정 분류', category: 'taiwan', tier: 'C', scope: 'strait', scoreOnly: true,
    status: 'normal', summary: '대만 국방부 일일 발표 기준 평시 수준',
    criteria: { normal: '평시 수준·기종 편중 없음(3일 내 군용기 30대 미만·군함 15척 미만)', caution: '군용기 30대↑ · ADIZ 진입 20대↑ · 군함 15척↑ · 무인기 10대↑ 또는 「연합 전비 경계순찰」 발표', danger: '군용기 70대↑ 또는 군함 25척↑ (공식 수치 기준)' },
    source: { label: '대만 국방부 臺海周邊海、空域動態', url: 'https://www.mnd.gov.tw/news/plaactlist' }, checkedAt: SAMPLE,
  },
  {
    id: 'msa-exclusion', name: '중국 해사국 사격·항행금지구역', category: 'taiwan', tier: 'B', scope: 'strait', straitKey: true,
    status: 'normal', summary: '대만 해역 명시 군사훈련·실탄사격 항행경고 없음',
    criteria: { normal: '연안 일상 사격 공고만 있음', caution: '해역에 대만해협(台湾海峡)을 명시한 군사훈련·실탄사격 공고 1건↑ (공고 없이 보도만 있으면 최대 주의)', danger: "'台湾岛' 주변 해역 명시 또는 7일 내 대만해협 공고 3건↑ (공식 공고 본문 기준)" },
    source: { label: '중국 해사국 航行警告', url: 'https://www.msa.gov.cn/7b08405760384570a0fb44e9204c4b1d/index.jhtml' }, checkedAt: SAMPLE,
  },
  {
    id: 'kinmen-matsui-pressure', name: '진먼·마쭈 해상 압박 빈도', category: 'taiwan', tier: 'B', scope: 'strait',
    status: 'normal', summary: '최근 14일 진먼·마쭈 해경 진입 보도 평시 수준',
    criteria: { normal: '최근 14일 해경·민병 진입 보도 3일 이하', caution: '14일 중 4일↑ 진입·순찰 보도 또는 나포·승선 보도 (보도 집계라 최대 주의)', danger: '어선·인원 나포 반복, 진먼·마쭈 항로 차단 (운영자 확인 시에만)' },
    source: { label: '대만 해순서(CGA)', url: 'https://www.cga.gov.tw/' }, checkedAt: SAMPLE,
  },
  {
    id: 'allies-tw-advisory', name: '미·일·호 대만 관련 여행경보·성명', category: 'taiwan', tier: 'B', scope: 'strait', straitKey: true,
    status: 'normal', summary: '일본·호주·영국 대만 여행경보 최저 단계',
    criteria: { normal: '일·호·영 모두 최저 단계 유지 (미국은 별도 지표)', caution: '1개국↑ 상향(일 레벨1, 호 높은 주의, 영 일부 자제) 또는 동맹 성명 보도 7일 3건↑', danger: '2개국↑ 여행 재고·자제 이상(일 레벨2↑, 호 Reconsider↑, 영 자제 권고)' },
    source: { label: '일본 외무성·호주 Smartraveller·영국 FCDO', url: 'https://www.smartraveller.gov.au/destinations/asia/taiwan' }, checkedAt: SAMPLE,
  },

  // ───────── 시장 ─────────
  {
    id: 'krw', name: '원/달러 환율', category: 'market', tier: 'C',
    status: 'normal', summary: '북한 요인 급변 없음',
    criteria: { normal: '북한 요인 변동 없음', caution: '북한 요인으로 하루 1% 이상 약세', danger: '하루 2% 이상 급락' },
    checkedAt: SAMPLE,
  },
  {
    id: 'kospi', name: 'KOSPI', category: 'market', tier: 'C',
    status: 'normal', summary: '지정학 요인 급락 없음',
    criteria: { normal: '변동 없음', caution: '북한 요인 하루 2% 이상 하락', danger: '서킷브레이커급 급락' },
    checkedAt: SAMPLE,
  },
  {
    id: 'cds', name: '한국 CDS 프리미엄', category: 'market', tier: 'C',
    status: 'normal', summary: '평시 범위',
    criteria: { normal: '평시 범위', caution: '1주 20% 이상 상승', danger: '환율 급락과 동반 급등' },
    checkedAt: SAMPLE,
  },
];

/**
 * 실데이터 덮어쓰기: scripts/fetch-data.mjs → war-live.json
 * 자동 수집 경로가 없는 지표는 예시값 대신 '확인 불가(unknown)'로 두어 점수에서 뺍니다.
 */
type LiveW = { status: Indicator['status']; summary: string; source?: { label: string; url: string }; checkedAt: string; method: string };
const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
/** 화면용 지표(배열·객체는 그대로 두고 내용만 교체 → import한 쪽이 항상 최신을 봄) */
export const indicators: Indicator[] = [];
export const LIVE_METHOD: Record<string, string> = {};
/** war-live.json 형태 데이터 적용. 빌드 시 번들 데이터로 1회, 런타임(/api/live)에서 다시 호출될 수 있음 */
export function applyWarIndicators(live: { indicators: Record<string, LiveW> }) {
  const LIVE = live.indicators;
  indicators.splice(0, indicators.length, ...seed.map((i) => {
    const l = LIVE[i.id];
    if (!l) return { ...i, status: 'unknown' as const, summary: '자동 수집 경로 없음 — 운영자 확인 전까지 점수 제외', checkedAt: undefined };
    return { ...i, status: l.status, summary: l.summary, source: l.source?.url ? l.source : i.source, checkedAt: kstDay(l.checkedAt) };
  }));
  for (const k of Object.keys(LIVE_METHOD)) delete LIVE_METHOD[k];
  for (const [k, v] of Object.entries(LIVE)) LIVE_METHOD[k] = v.method;
}
applyWarIndicators(warLive as unknown as { indicators: Record<string, LiveW> });
