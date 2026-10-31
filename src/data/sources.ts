import type { Principle } from '../types';

export const principles: Principle[] = [
  {
    title: '공격 전 준비 행동을 목록으로 감시한다 (I&W)',
    body: '정보기관의 경고 분석(Indications & Warning)은 공격에 반드시 필요한 준비 행동—동원, 병참, 배치 변화—을 지표 목록으로 만들어 지켜봅니다. 이 페이지의 지표 목록과 \'전면전 직전 신호\'는 이 방식을 따릅니다.',
    refs: [
      { text: 'Grabo, C. M. (2002). Anticipating Surprise: Analysis for Strategic Warning. Joint Military Intelligence College.', link: { label: 'DTIC', url: 'https://apps.dtic.mil/sti/citations/ADA476752' } },
    ],
  },
  {
    title: '비용이 큰 행동일수록 무겁게 본다 (A등급 ×4)',
    body: '미리 비용을 치르는 행동은 말뿐인 위협보다 의도를 더 잘 드러낸다는 \'값비싼 신호\' 이론을 참고했습니다. 다만 동원도 허세일 수 있다는 반론이 있어 단일 신호로 최고 단계에 오르지는 않게 설계했습니다.',
    refs: [
      { text: 'Fearon, J. D. (1997). Signaling Foreign Policy Interests. Journal of Conflict Resolution, 41(1).', link: { label: 'DOI', url: 'https://doi.org/10.1177/0022002797041001004' } },
      { text: 'Slantchev, B. L. (2005). Military Coercion in Interstate Crises. American Political Science Review, 99(4).', link: { label: 'DOI', url: 'https://doi.org/10.1017/S0003055405051865' } },
    ],
  },
  {
    title: '자주 반복되는 도발은 가볍게 본다 (기저율)',
    body: '1953년 정전 이후 수백 건의 북한 도발이 있었지만 전면전으로 이어진 적은 없습니다. 미사일 발사·분계선 침범만으로는 전쟁 여부를 가려내기 어려워 C등급에 둡니다.',
    refs: [
      { text: 'CSIS Beyond Parallel — Database: North Korean Provocations.', link: { label: 'CSIS', url: 'https://beyondparallel.csis.org/' } },
    ],
  },
  {
    title: '정부의 공식 판단을 지표로 쓴다',
    body: '각국 정부는 비공개 정보까지 반영해 자국민 보호 조치를 내립니다. 여행경보, 비전투원 대피, 감시태세 변화를 직접 지표로 씁니다.',
    refs: [
      { text: '미 국무부 Travel Advisories (1~4단계).', link: { label: 'travel.state.gov', url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html' } },
      { text: '외교부 해외안전여행 — 여행경보 제도.', link: { label: '0404.go.kr', url: 'https://www.0404.go.kr/' } },
    ],
  },
  {
    title: '위험은 4단계로 나눠 표시한다',
    body: '재난 및 안전관리 기본법의 위기경보(관심·주의·경계·심각)와 워치콘의 단계 구조를 참고했습니다. 이 페이지의 단계는 공식 경보가 아닌 자체 기준입니다.',
    refs: [
      { text: '재난 및 안전관리 기본법 제38조(위기경보의 발령 등).', link: { label: '국가법령정보센터', url: 'https://www.law.go.kr/' } },
    ],
  },
  {
    title: '시장 신호는 보조로만 쓴다',
    body: '북한 도발이 한국 금융시장에 미치는 영향은 제한적이고 다른 요인과 분리하기 어렵다는 연구가 많아, 시장 지표는 C등급 보조 신호로 둡니다.',
    refs: [
      { text: 'Dibooglu, S., & Cevik, E. I. (2016). The effect of North Korean threats on financial markets in South Korea and Japan. Journal of Asian Economics.' },
      { text: 'Korea Economic Institute of America — 북한 리스크와 한국 경제 분석.', link: { label: 'KEI', url: 'https://keia.org/' } },
    ],
  },
  {
    title: '확률 예측은 점수에 넣지 않는다',
    body: '예측대회 연구는 훈련된 예측자의 정확도를 보여주지만, 거래가 적은 예측시장은 쉽게 흔들립니다. 그래서 참고 정보로만 보여주고, 방법과 출처는 모두 공개합니다.',
    refs: [
      { text: 'Mellers, B. et al. (2014). Psychological Strategies for Winning a Geopolitical Forecasting Tournament. Psychological Science, 25(5).' },
      { text: 'Hegre, H. et al. (2019). ViEWS: A political violence early-warning system. Journal of Peace Research, 56(2).', link: { label: 'ViEWS', url: 'https://viewsforecasting.org/' } },
    ],
  },
];
