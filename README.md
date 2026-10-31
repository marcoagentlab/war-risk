# 통합 리스크 허브 / war-risk

공개 지표를 한곳에 모은 리스크 대시보드입니다.  
Public risk dashboard hub. Open-source OSINT-style indicators only.

**Live / Production:** https://war-risk-dashboard.vercel.app

이 프로젝트는 정부, 거래소, 또는 다른 기관의 공식 서비스가 아닙니다.  
Not affiliated with any government or exchange.

## 무엇인가 / What it is

| 모듈 | 경로 | 내용 |
|---|---|---|
| A | [/cyber](https://war-risk-dashboard.vercel.app/cyber) | 사이버 (악용 취약점, 랜섬웨어, 공개 보안 공지) |
| B | [/supply](https://war-risk-dashboard.vercel.app/supply) | 공급망·해운 (해협, 운임, 항만, 수출통제 공개 신호) |
| C | [/ai](https://war-risk-dashboard.vercel.app/ai) | AI (주요 서비스 장애, 남용·규제 공개 신호) |
| D | [/disaster](https://war-risk-dashboard.vercel.app/disaster) | 재난·기상·전력 (한국 중심 공개 신호) |
| E | [/crypto](https://war-risk-dashboard.vercel.app/crypto) | 코인 거래소 신호 (출금·디페그·청산 등). **투자 조언 아님** |
| W | [/war](https://war-risk-dashboard.vercel.app/war) | 한반도·대만 전쟁 위험 트랙 (공개 보도·공식 여행경보 등) |

홈(`/`)은 모듈별 요약입니다. 점수는 휴리스틱이며, 확률이나 예보가 아닙니다.

## 스택 / Stack

- Vite 멀티 페이지 앱 (MPA), TypeScript
- Vercel
  - Hobby Cron `0 3 * * *` UTC → `/api/cron/refresh`
  - 수집 결과는 Vercel Blob `live/latest.json`
  - 프론트는 `/api/live` 를 읽습니다. 스냅샷이 없으면 빌드에 포함된 JSON으로 폴백합니다.

수집 항목과 환경 변수 이름은 [DATA.md](DATA.md)에 있습니다. 운영용 시크릿(`CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`)은 저장소에 넣지 않습니다.

## 면책 / Disclaimer

오픈소스 OSINT 스타일 지표일 뿐입니다. 투자, 보안, 또는 재난·비상 대응에 대한 조언이 아닙니다. 점수는 휴리스틱입니다.

Open-source OSINT-style indicators only. Not investment, security, or emergency advice. Scores are heuristic.

공식 경보, 거래소 공지, 재난문자를 대체하지 않습니다. 실제 판단은 각 기관의 원문을 따르세요.

## 빠른 시작 / Quick start

```bash
git clone https://github.com/marcoagentlab/war-risk.git
cd war-risk
npm install
npm run dev
```

개발 서버는 기본적으로 http://localhost:5173 입니다. `.env` 없이도 실행됩니다.

광고 슬롯이나 OG용 사이트 주소를 바꾸려면 `.env.example`을 `.env.local`로 복사한 뒤 값만 수정하세요. 예시의 `VITE_ADSENSE_CLIENT`(`ca-pub-0000…`)는 자리표시자이며, 이 상태에서는 광고 대신 회색 영역만 보입니다. `.env.local`과 `.env.production`은 커밋하지 마세요.

```bash
npm run build      # 타입체크 + dist/
npm run preview    # 빌드 결과 미리보기
```
