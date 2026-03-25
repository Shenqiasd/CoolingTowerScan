import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST = join(import.meta.dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

async function handler(req, res) {
  let pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;

  // Try the exact file path first
  let filePath = join(DIST, pathname);

  // If it's a directory or doesn't have an extension, try index.html (SPA fallback)
  if (!extname(pathname) || !existsSync(filePath)) {
    if (existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else if (existsSync(join(filePath, 'index.html'))) {
      filePath = join(filePath, 'index.html');
    } else if (!existsSync(filePath)) {
      // SPA fallback: serve index.html for any non-file route
      filePath = join(DIST, 'index.html');
    }
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Cache static assets with hashed filenames
    const cacheControl = pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    res.end(data);
  } catch {
    // Final fallback to index.html for SPA routing
    try {
      const indexData = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexData);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
}

const server = createServer(handler);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Static server listening on http://0.0.0.0:${PORT}`);
});
