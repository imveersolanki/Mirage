/* tiny static server for local dev and the e2e tests: /mirage maps to mirage/index.html like Vercel's cleanUrls */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 4173;
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.jsx':'text/plain; charset=utf-8',
  '.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.webm':'video/webm','.mp4':'video/mp4'};
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if(p === '/') p = '/index.html';
  else if(!path.extname(p)) p = p.replace(/\/$/, '') + '/index.html';
  const file = path.join(ROOT, path.normalize(p));
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if(err){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'}); res.end(data);
  });
}).listen(PORT, () => console.log('mirage: http://localhost:'+PORT));
