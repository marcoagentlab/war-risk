import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { renderHome, renderModule, headFor } from './src/hub/render';
import { injectSplash } from './src/boot/splash';

/** 허브 모듈 + 기존 전쟁 페이지(/war) */
const PAGES = ['war', 'cyber', 'supply', 'ai', 'disaster', 'crypto'] as const;
const CLEAN = ['privacy', ...PAGES] as string[];

/** dev/preview에서도 Vercel cleanUrls처럼 /cyber → /cyber/index.html */
const cleanUrls: Connect.NextHandleFunction = (req, _res, next) => {
  const m = (req.url ?? '').match(/^\/([a-z]+)\/?(\?.*)?$/);
  if (m && CLEAN.includes(m[1])) req.url = (m[1] === 'privacy' ? '/privacy.html' : `/${m[1]}/index.html`) + (m[2] ?? '');
  next();
};

/** 허브 페이지를 빌드 시 HTML로 프리렌더 (CSR 없이 본문·SEO 메타 포함) */
function prerender(site: string): Plugin {
  return {
    name: 'hub-prerender',
    generateBundle() {
      const now = new Date().toISOString();
      const urls = ['/', '/war', '/cyber', '/supply', '/ai', '/disaster', '/crypto', '/privacy'];
      const pri: Record<string, string> = { '/': '1.0', '/war': '0.9', '/privacy': '0.2' };
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${site}${u}</loc><lastmod>${now}</lastmod><changefreq>${u === '/privacy' ? 'yearly' : 'daily'}</changefreq><priority>${pri[u] ?? '0.7'}</priority></url>`)
        .join('\n')}\n</urlset>\n`;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!html.includes('<!--hub-body-->')) return html;
        const p = ctx.path.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
        const body = p === '/' ? renderHome() : renderModule(p.slice(1));
        return html.replace('<!--hub-head-->', headFor(p, site)).replace('<!--hub-body-->', body);
      },
    },
  };
}

/** 빌드 결과 CSS를 HTML에 인라인 → 렌더 차단 요청 제거 (모바일 FCP) */
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        return html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g, (tag, file) => {
          const a = ctx.bundle![file];
          return a && a.type === 'asset' ? `<style>${String(a.source)}</style>` : tag;
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || 'https://war-risk-dashboard.vercel.app').replace(/\/$/, '');
  const input: Record<string, string> = {
    main: resolve(process.cwd(), 'index.html'),
    privacy: resolve(process.cwd(), 'privacy.html'),
  };
  for (const p of PAGES) input[p] = resolve(process.cwd(), `${p}/index.html`);
  return {
    appType: 'mpa',
    plugins: [
      { name: 'site-url-html', transformIndexHtml: { order: 'pre' as const, handler: (html: string) => html.replace(/__SITE_URL__/g, siteUrl) } },
      prerender(siteUrl),
      {
        name: 'boot-splash',
        transformIndexHtml: {
          order: 'pre' as const,
          handler: (html: string, ctx: { path: string }) => {
            if (/privacy/.test(ctx.path)) return html; // 정적 문서는 스플래시 불필요
            return injectSplash(html, /^\/war\//.test(ctx.path) ? '한반도 전쟁 위험 지표' : '통합 리스크 허브');
          },
        },
      },
      inlineCss(),
      { name: 'clean-urls', configureServer(s) { s.middlewares.use(cleanUrls); }, configurePreviewServer(s) { s.middlewares.use(cleanUrls); } },
    ],
    build: { target: 'es2020', modulePreload: { polyfill: false }, rollupOptions: { input } },
  };
});
