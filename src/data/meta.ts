import warLive from './war-live.json';
/** 사이트 전체 메타 정보. updatedAt은 war-live.json 수집 시각. */
export const meta = {
  siteName: '한반도 전쟁 위험 지표',
  siteNameEn: 'KOREAN PENINSULA · WAR RISK MONITOR',
  updatedAt: (warLive as { generated_at: string }).generated_at,
  refreshNote: '공식 여행경보·환율·주가 API와 공개 보도 헤드라인을 매일 정오(KST) 자동 수집(보도 기반은 최대 주의, 위험은 운영자 확인)',
  contactEmail: 'marcoagentlab@gmail.com',
  /** true면 첫 화면에 '예시 데이터' 배지를 띄웁니다. 실제 데이터로 갱신했으면 false로. */
  isSampleData: false,
};
