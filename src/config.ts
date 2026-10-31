/**
 * AdSense 설정
 * - 우선순위: 환경변수(.env / Cloudflare Pages 환경변수) → 아래 기본값
 * - client가 비어 있거나 'ca-pub-0000…'이면 광고 스크립트를 불러오지 않고 자리표시자만 보여줍니다.
 */
const env = import.meta.env;

export type AdPosition = 'hero' | 'mid' | 'section' | 'footer';

export const adsenseConfig = {
  client: (env.VITE_ADSENSE_CLIENT as string | undefined) ?? '',
  slots: {
    hero: (env.VITE_ADSENSE_SLOT_HERO as string | undefined) ?? '',
    mid: (env.VITE_ADSENSE_SLOT_MID as string | undefined) ?? '',
    section: (env.VITE_ADSENSE_SLOT_SECTION as string | undefined) ?? '',
    footer: (env.VITE_ADSENSE_SLOT_FOOTER as string | undefined) ?? '',
  } satisfies Record<AdPosition, string>,
  /** 개발 중 자리표시자 테두리를 보여줄지 */
  showPlaceholders: false,
};

export const siteUrl: string =
  (env.VITE_SITE_URL as string | undefined) || (typeof location !== 'undefined' ? location.origin : '');

export function isAdsenseEnabled(): boolean {
  const c = adsenseConfig.client.trim();
  return /^ca-pub-\d{10,}$/.test(c) && !/^ca-pub-0+$/.test(c);
}
