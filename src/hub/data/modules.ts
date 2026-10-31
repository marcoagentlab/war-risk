/** 모듈 메타 (카피·분야·준비 행동·SEO). 점수 숫자는 여기 넣지 않음 — scoring.ts가 live.json으로 계산. */
export type ModuleCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'W';
export interface ModuleMeta {
  code: ModuleCode; slug: 'cyber' | 'supply' | 'ai' | 'disaster' | 'crypto' | 'war';
  name: string; desc: string; action: string; domains: Record<string, string>; prep: string[];
  seoTitle: string; seoDesc: string; keywords: string; note?: string;
}
export const MODULES: ModuleMeta[] = [
  { code: 'A', slug: 'cyber', name: '사이버 공격 경보', desc: '악용 중인 취약점·랜섬웨어·국가연계 해킹 공개 신호', action: '오늘 업데이트할 것 확인하기',
    domains: { kev: '악용 취약점', ransomware: '랜섬웨어', nation_state: '국가연계', breach: '대규모 침해·유출', sw_supply: 'SW 공급망' },
    prep: ['운영체제·브라우저 자동 업데이트 켜기', '중요 계정에 2단계 인증 설정', '백업 하나는 인터넷과 분리해 보관'],
    seoTitle: '사이버 공격 경보 — KEV·랜섬웨어·해킹 위험 지수', seoDesc: 'CISA KEV, KISA 보안공지, 공개 보도로 계산한 사이버 공격 위험 점수. 국내 보급 제품 패치 우선순위와 랜섬웨어·개인정보 유출 신호를 한눈에.',
    keywords: '사이버 공격 경보, KEV, 랜섬웨어, 해킹, 개인정보 유출, KISA 보안공지, 보안 패치' },
  { code: 'B', slug: 'supply', name: '공급망·해운', desc: '해협·운하 봉쇄, 운임·보험료, 항만 파업', action: '해외 직구·수입 일정 여유 두기',
    domains: { chokepoint: '해협·운하', freight: '운임', insurance: '보험·우회', port: '항만', critical_goods: '반도체·에너지' },
    prep: ['해외 직구·수입 일정에 여유 두기', '꼭 필요한 소모품은 2~4주분 확보', '선사·통관 공지를 출처로 확인'],
    seoTitle: '공급망·해운 리스크 — 해협 봉쇄·항만 파업·수출통제 지수', seoDesc: '호르무즈·홍해·수에즈 등 해협 봉쇄, 상선 공격, 항만 파업, 반도체·희토류 수출통제 공개 신호로 계산한 공급망 위험 점수.',
    keywords: '공급망 리스크, 해운, 홍해, 호르무즈, 수에즈 운하, 항만 파업, 수출통제, 희토류' },
  { code: 'C', slug: 'ai', name: 'AI 장애·남용', desc: '주요 AI 서비스 장애, 딥페이크 악용, 규제 발효', action: '대체 AI 도구 하나 준비해 두기',
    domains: { outage: '서비스 장애', cost: '요금·쿼터', abuse: '딥페이크 악용', policy: '규제·정책', leak: '유출' },
    prep: ['대체 AI 도구 하나 준비해 두기', '중요한 작업물은 로컬에도 저장', '의심 영상·음성은 공유 전에 출처 확인'],
    seoTitle: 'AI 장애·남용 위험 — ChatGPT·Claude·Gemini 상태와 딥페이크', seoDesc: 'OpenAI·Anthropic·Google 공식 상태 페이지와 공개 보도로 계산한 AI 서비스 장애·딥페이크 악용·규제 위험 점수.',
    keywords: 'AI 장애, ChatGPT 장애, Claude 장애, Gemini 장애, 딥페이크, AI 기본법, AI 규제' },
  { code: 'D', slug: 'disaster', name: '재난·기상·전력', desc: '특보·지진·산불·홍수·전력수급 (한국)', action: '내 지역 재난문자 설정 확인',
    domains: { weather: '기상', quake: '지진', wildfire: '산불', flood: '홍수·풍수해', power: '전력', civil: '민방위·문자' },
    prep: ['휴대폰 재난문자 수신 설정 확인', '안전디딤돌 앱으로 대피소 확인', '비상용품 가방 점검'],
    seoTitle: '재난·기상·전력 복합 경보 — 태풍·지진·산불·전력수급 (한국)', seoDesc: '전력거래소 실시간 전력수급, USGS 지진, 기상특보·산불·홍수 공개 보도로 계산한 한국 재난 복합 위험 점수. 공식 경보를 대체하지 않습니다.',
    keywords: '재난 경보, 기상특보, 태풍, 지진, 산불, 홍수, 전력수급, 공급예비율, 재난문자',
    note: '공식 경보를 대체하지 않습니다. 실제 행동은 재난문자와 정부·지자체 발표를 따르세요.' },
  { code: 'E', slug: 'crypto', name: '코인·거래소 신호', desc: '출금 중단·디페그·대규모 청산. 투자 조언 아님', action: '거래소 공지와 공식 채널만 확인',
    domains: { exchange: '거래소', stablecoin: '스테이블코인', leverage: '레버리지·청산', protocol: '프로토콜', regulation: '규제' },
    prep: ['거래소 공지·공식 채널로만 정보 확인', '계정 2단계 인증·출금 주소 등록 기능 확인', '"긴급 출금" 문자·링크 피싱 주의'],
    seoTitle: '코인·거래소 붕괴 신호 — 출금 중단·디페그·해킹 지수', seoDesc: '스테이블코인 가격·발행량, 펀딩비, 원화 프리미엄, 거래소 출금 중단·해킹 공개 신호로 계산한 위기 신호 점수. 투자 조언이 아닙니다.',
    keywords: '코인 거래소 위험, 스테이블코인 디페그, 거래소 해킹, 출금 중단, 김치 프리미엄, 펀딩비' },
  { code: 'W', slug: 'war', name: '한반도·대만 전쟁', desc: '공개 보도 기반 전쟁 위험 지표 (기존 페이지)', action: '근처 대피소 미리 보기',
    domains: {}, prep: ['집·회사 근처 민방위 대피소 미리 보기', '통신 두절 시 가족 만날 장소 정하기', '비상용품 한곳에 모으기'],
    seoTitle: '한반도 전쟁 위험 지표', seoDesc: '', keywords: '' },
];
export const CONTACT = 'marcoagentlab@gmail.com';
