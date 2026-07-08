/**
 * Cornea Clinic — local static file server
 * Run: node clinic-server.js
 * Open: http://127.0.0.1:8080/Cornea.html
 *
 * WHO ICD-11 lookup is proxied by the Cornea EMR API when signed in to cloud sync.
 * This server only serves static clinic files (no credential proxy).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildStrictCsp, injectHtmlNonces } = require('./lib/csp-policy.cjs');

const PORT = 8080;
const HOST = '127.0.0.1';
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

const PLAIN_TEXT = 'text/plain; charset=utf-8';

/** Security headers for clinic static responses (local dev + DAST baseline). */
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function withSecurityHeaders(extra = {}) {
    return { ...SECURITY_HEADERS, ...extra };
}

function serveStatic(req, res, urlPath) {
    let rel = urlPath === '/' ? '/Cornea.html' : urlPath;
    rel = rel.split('?')[0];
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, withSecurityHeaders({ 'Content-Type': PLAIN_TEXT }));
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, withSecurityHeaders({ 'Content-Type': PLAIN_TEXT }));
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const headers = withSecurityHeaders({
            'Content-Type': MIME[ext] || 'application/octet-stream'
        });
        if (ext === '.html') {
            const nonce = crypto.randomBytes(16).toString('base64');
            headers['Content-Security-Policy'] = buildStrictCsp(nonce, { production: false });
            res.writeHead(200, headers);
            const html = injectHtmlNonces(String(data), nonce);
            res.end(html);
            return;
        }
        res.writeHead(200, headers);
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, withSecurityHeaders({ 'Content-Type': PLAIN_TEXT }));
        res.end('Method not allowed');
        return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (url.pathname === '/icd/ping') {
        res.writeHead(410, withSecurityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
        res.end(JSON.stringify({
            ok: false,
            message: 'ICD proxy removed for security. Sign in to cloud sync to use WHO ICD via the API.'
        }));
        return;
    }

    if (url.pathname.startsWith('/icd/')) {
        res.writeHead(410, withSecurityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
        res.end(JSON.stringify({ error: 'ICD proxy disabled — use Cornea EMR API when signed in.' }));
        return;
    }

    serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Cornea Clinic static server running');
    console.log(`  Open: http://${HOST}:${PORT}/Cornea.html`);
    console.log(`  Offline admin reset: http://${HOST}:${PORT}/reset-offline-admin.html`);
    console.log('  ICD-11: sign in to cloud sync (API proxies WHO securely)');
    console.log('  Press Ctrl+C to stop');
    console.log('');
});
