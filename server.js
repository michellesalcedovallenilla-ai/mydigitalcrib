// Tiny static dev server. Hardened against path traversal, symlink escape,
// non-GET methods, and MIME sniffing. Binds to 127.0.0.1 only.

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = fs.realpathSync(__dirname);
const ROOT_PREFIX = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function send(res, status, contentType, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  // 1. method allowlist
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'text/plain', 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  // 2. parse + sanitize URL
  let reqPath;
  try {
    reqPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  } catch {
    return send(res, 400, 'text/plain', 'Bad Request');
  }
  // reject NUL bytes (Windows file-system shenanigans)
  if (reqPath.includes('\0')) return send(res, 400, 'text/plain', 'Bad Request');
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  // 3. resolve and re-check inside ROOT (defends against ../ AND symlink escape)
  const joined = path.join(ROOT, reqPath);
  let real;
  try {
    real = fs.realpathSync(joined);
  } catch {
    return send(res, 404, 'text/plain', 'Not found');
  }
  if (real !== ROOT && !real.startsWith(ROOT_PREFIX)) {
    return send(res, 403, 'text/plain', 'Forbidden');
  }

  // 4. only serve regular files (no directory listings, no devices)
  let stat;
  try { stat = fs.statSync(real); } catch { return send(res, 404, 'text/plain', 'Not found'); }
  if (!stat.isFile()) return send(res, 404, 'text/plain', 'Not found');

  // 5. serve
  const ext = path.extname(real).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  fs.readFile(real, (err, data) => {
    if (err) return send(res, 500, 'text/plain', 'Server error');
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
        ...SECURITY_HEADERS,
      });
      return res.end();
    }
    send(res, 200, contentType, data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`my digital crib — hero running at http://127.0.0.1:${PORT}/`);
});
