import { buildStrictCsp, injectHtmlNonces } from './lib/csp-policy.cjs';

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetRes = await env.ASSETS.fetch(request);
    const headers = new Headers(assetRes.headers);
    for (const [k, v] of Object.entries(BASE_HEADERS)) headers.set(k, v);

    const contentType = headers.get('content-type') || '';
    const path = url.pathname || '';
    const looksLikeStatic = /\.(js|mjs|css|map|json|wasm|png|jpe?g|gif|svg|ico|woff2?)$/i.test(path);

    // Guard: SPA/index fallback must never be served as JS/CSS (breaks nav/sections).
    // Check path + content-type; also sniff HTML bodies when type is wrong/missing.
    if (looksLikeStatic && assetRes.ok) {
      const peek = await assetRes.clone().text();
      const isHtml =
        contentType.includes('text/html') ||
        /^\s*<!DOCTYPE/i.test(peek) ||
        /^\s*<html[\s>]/i.test(peek);
      if (isHtml) {
        return new Response(`/* Asset missing: ${path} */\n`, {
          status: 404,
          headers: {
            'Content-Type': path.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
            ...BASE_HEADERS
          }
        });
      }
      if (
        /\.(js|mjs|css)$/i.test(path) &&
        !/\/assets\/(vendor|fonts)\//i.test(path)
      ) {
        headers.set('Cache-Control', 'no-cache');
      }
      return new Response(peek, { status: assetRes.status, headers });
    }

    if (contentType.includes('text/html')) {
      const nonce = randomNonce();
      headers.set('Content-Security-Policy', buildStrictCsp(nonce, { production: true }));
      headers.set('Cache-Control', 'no-cache');
      const html = injectHtmlNonces(await assetRes.text(), nonce);
      return new Response(html, { status: assetRes.status, headers });
    }

    if (
      /\.(js|mjs|css)$/i.test(path) &&
      !/\/assets\/(vendor|fonts)\//i.test(path)
    ) {
      headers.set('Cache-Control', 'no-cache');
    }

    return new Response(assetRes.body, { status: assetRes.status, headers });
  }
};
