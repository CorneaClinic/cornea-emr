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
    const assetRes = await env.ASSETS.fetch(request);
    const headers = new Headers(assetRes.headers);
    for (const [k, v] of Object.entries(BASE_HEADERS)) headers.set(k, v);

    const contentType = headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const nonce = randomNonce();
      headers.set('Content-Security-Policy', buildStrictCsp(nonce, { production: true }));
      const html = injectHtmlNonces(await assetRes.text(), nonce);
      return new Response(html, { status: assetRes.status, headers });
    }

    return new Response(assetRes.body, { status: assetRes.status, headers });
  }
};
