import { siteUrl } from './config';

function openShare(href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function initShare(text: string) {
  const toggle = document.querySelector<HTMLButtonElement>('[data-share-toggle]');
  const panel = document.getElementById('share-panel');
  const msg = panel?.querySelector<HTMLElement>('.share-msg');
  if (!toggle || !panel) return;

  const url = (siteUrl || location.origin).replace(/\/$/, '') + '/war';
  const say = (m: string) => { if (msg) msg.textContent = m; };

  toggle.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });

  const copy = async (after: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      say(after);
    } catch {
      say(`자동 복사가 안 됐어요. 주소를 직접 복사하세요: ${url}`);
    }
  };

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);

  panel.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-share]');
    if (!btn) return;
    switch (btn.dataset.share) {
      case 'x':
        openShare(`https://twitter.com/intent/tweet?text=${t}&url=${u}`);
        break;
      case 'facebook':
        openShare(`https://www.facebook.com/sharer/sharer.php?u=${u}`);
        break;
      case 'threads':
        openShare(`https://www.threads.net/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`);
        break;
      case 'kakao':
        void copy('링크를 복사했어요. 카카오톡에 붙여넣으세요.');
        break;
      case 'native':
        if (typeof navigator.share === 'function') {
          void navigator.share({ title: document.title, text, url }).catch(() => {
            void copy('공유가 취소됐거나 실패해서 링크를 복사했어요.');
          });
        } else {
          void copy('이 브라우저는 기기 공유를 지원하지 않아 링크를 복사했어요.');
        }
        break;
      default:
        void copy('링크를 복사했어요.');
    }
  });
}
