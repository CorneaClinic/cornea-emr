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

const PORT = 8080;
const HOST = '127.0.0.1';
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

function serveStatic(req, res, urlPath) {
    let rel = urlPath === '/' ? '/Cornea.html' : urlPath;
    rel = rel.split('?')[0];
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN'
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end('Method not allowed');
        return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (url.pathname === '/icd/ping') {
        res.writeHead(410, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            ok: false,
            message: 'ICD proxy removed for security. Sign in to cloud sync to use WHO ICD via the API.'
        }));
        return;
    }

    if (url.pathname.startsWith('/icd/')) {
        res.writeHead(410, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'ICD proxy disabled — use Cornea EMR API when signed in.' }));
        return;
    }

    serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Cornea Clinic static server running');
    console.log(`  Open: http://${HOST}:${PORT}/Cornea.html`);
    console.log('  ICD-11: sign in to cloud sync (API proxies WHO securely)');
    console.log('  Press Ctrl+C to stop');
    console.log('');
});
