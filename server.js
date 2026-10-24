'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8')
);

const episodes = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'episodes.json'), 'utf8')
);

const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 100; // requests per minute per IP
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

const SORTS = {
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Totals are always computed on the server so clients cannot tamper with prices.
function buildOrder(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Cart is empty' };
  }
  const lines = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.id);
    const qty = Number(item.qty);
    if (!product) return { error: `Unknown product id: ${item.id}` };
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      return { error: `Invalid quantity for product ${item.id}` };
    }
    lines.push({ id: product.id, name: product.name, qty, lineTotal: product.price * qty });
  }
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { order: { lines, total, currency: 'INR' } };
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/products') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const category = url.searchParams.get('category');
    let list = products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    );
    const sort = SORTS[url.searchParams.get('sort')];
    if (sort) list = [...list].sort(sort);
    const total = list.length;
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 0, 0), 50);
    const page = Math.max(parseInt(url.searchParams.get('page'), 10) || 1, 1);
    if (limit) list = list.slice((page - 1) * limit, page * limit);
    res.setHeader('X-Total-Count', String(total));
    return sendJson(res, 200, list);
  }

  if (req.method === 'GET' && url.pathname === '/api/episodes') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const list = episodes.filter(
      (e) => !q || e.title.toLowerCase().includes(q) || e.guest.toLowerCase().includes(q)
    );
    return sendJson(res, 200, list);
  }

  const single = url.pathname.match(/^\/api\/products\/(\d+)$/);
  if (req.method === 'GET' && single) {
    const product = products.find((p) => p.id === Number(single[1]));
    return product ? sendJson(res, 200, product) : sendJson(res, 404, { error: 'Product not found' });
  }

  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const { order, error } = buildOrder(body.items);
      return error ? sendJson(res, 400, { error }) : sendJson(res, 200, order);
    } catch {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    if (url.pathname.startsWith('/api/')) {
      if (isRateLimited(req.socket.remoteAddress)) {
        return sendJson(res, 429, { error: 'Too many requests' });
      }
      return handleApi(req, res, url);
    }
    return serveStatic(req, res, url);
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer().listen(port, () => console.log(`Heritage Store running on http://localhost:${port}`));
}

module.exports = { createServer, buildOrder };
