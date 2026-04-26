// Tiny static file server for the sandbox.
// Usage:  node sandbox/serve.mjs           → http://localhost:8765/sandbox/
// Stop:   close the terminal, or Ctrl+C

import http from 'node:http';
import fs   from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 8765);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // website root

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/plain; charset=utf-8',
  '.ico':  'image/x-icon',
};

http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/sandbox/';
    let filePath = path.join(ROOT, urlPath);

    // prevent path-traversal
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

    let stat;
    try { stat = await fs.stat(filePath); } catch { res.writeHead(404); return res.end('not found: ' + urlPath); }
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      try { await fs.stat(filePath); } catch { res.writeHead(404); return res.end('no index.html in ' + urlPath); }
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const buf  = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    res.end(buf);
    console.log(`${new Date().toISOString().slice(11,19)}  ${res.statusCode}  ${urlPath}`);
  } catch (e) {
    res.writeHead(500); res.end('server error: ' + e.message);
    console.error('500', req.url, e.message);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(``);
  console.log(`  ┌──────────────────────────────────────────────────────────────┐`);
  console.log(`  │  Sandbox server running                                      │`);
  console.log(`  │                                                              │`);
  console.log(`  │  Open in browser:                                            │`);
  console.log(`  │     http://localhost:${PORT}/sandbox/                          │`);
  console.log(`  │                                                              │`);
  console.log(`  │  Stop with Ctrl+C or close this window                       │`);
  console.log(`  └──────────────────────────────────────────────────────────────┘`);
  console.log(``);
});
