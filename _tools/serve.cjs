#!/usr/bin/env node
// Servidor estático local que imita a GitHub Pages: sirve la raíz del repo, gzip,
// redirección de carpetas a "/", y 404.html cuando no existe la ruta.
// Uso: node _tools/serve.cjs   →  http://localhost:8765/
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml',
};

function send(req, res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'max-age=600', 'X-Content-Type-Options': 'nosniff' };
  const gz = /text|javascript|json|svg|xml/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gz) headers['Content-Encoding'] = 'gzip';
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(file);
  (gz ? stream.pipe(zlib.createGzip({ level: 6 })) : stream).pipe(res);
}

http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!url.endsWith('/')) { res.writeHead(301, { Location: url + '/' }); return res.end(); }
      const idx = path.join(file, 'index.html');
      if (fs.existsSync(idx)) return send(req, res, idx);
    } else if (!err && st.isFile()) {
      return send(req, res, file);
    }
    const nf = [path.join(ROOT, '404.html')].find((f) => fs.existsSync(f));
    if (nf) return send(req, res, nf, 404);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
