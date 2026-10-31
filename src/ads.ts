import { adsenseConfig, isAdsenseEnabled, type AdPosition } from './config';

/**
 * 광고 슬롯은 HTML에 <div class="ad-slot" data-ad="hero"> 형태로 미리 높이를 잡아 둡니다(CLS 방지).
 * 이 함수는 설정이 있으면 AdSense 태그를 넣고, 없으면 자리표시자 문구만 남깁니다.
 */
declare global {
  interface Window { adsbygoogle?: unknown[] }
}

let scriptInjected = false;

function injectScript(client: string) {
  if (scriptInjected) return;
  scriptInjected = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

export function initAds(root: ParentNode = document) {
  const slots = root.querySelectorAll<HTMLElement>('.ad-slot[data-ad]');
  const enabled = isAdsenseEnabled();
  if (enabled) injectScript(adsenseConfig.client);

  slots.forEach((el) => {
    const pos = el.dataset.ad as AdPosition;
    const slotId = adsenseConfig.slots[pos];
    if (enabled && slotId) {
      el.classList.add('ad-live');
      el.innerHTML = '';
      const label = document.createElement('span');
      label.className = 'ad-label';
      label.textContent = '광고';
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.dataset.adClient = adsenseConfig.client;
      ins.dataset.adSlot = slotId;
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';
      el.append(label, ins);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* 광고 차단기 등 — 자리 높이는 유지 */
      }
    } else if (adsenseConfig.showPlaceholders) {
      el.classList.add('ad-placeholder');
      el.innerHTML = `<span class="ad-label">광고 영역</span><span class="ad-hint">AD SLOT · ${pos}</span>`;
    } else {
      el.classList.add('ad-hidden');
    }
  });
}
