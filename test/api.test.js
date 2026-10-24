'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createServer, buildOrder } = require('../server');

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, async () => {
      try {
        await fn(`http://localhost:${server.address().port}`);
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

test('GET /api/products returns all products', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/products`);
    assert.strictEqual(res.status, 200);
    assert.ok((await res.json()).length > 0);
  }));

test('search and category filters work', () =>
  withServer(async (base) => {
    const list = await (await fetch(`${base}/api/products?category=apparel`)).json();
    assert.ok(list.every((p) => p.category === 'apparel'));
    const found = await (await fetch(`${base}/api/products?q=notebook`)).json();
    assert.ok(found.length > 0);
  }));

test('unknown product returns 404', () =>
  withServer(async (base) => {
    assert.strictEqual((await fetch(`${base}/api/products/999`)).status, 404);
  }));

test('checkout computes total on the server', () => {
  const { order } = buildOrder([{ id: 1, qty: 2 }, { id: 3, qty: 1 }]);
  assert.strictEqual(order.total, 399 * 2 + 699);
});

test('checkout rejects bad input', () => {
  assert.ok(buildOrder([]).error);
  assert.ok(buildOrder([{ id: 1, qty: 0 }]).error);
  assert.ok(buildOrder([{ id: 42, qty: 1 }]).error);
});

test('static path traversal is blocked', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/..%2fserver.js`);
    assert.notStrictEqual(res.status, 200);
  }));

test('sorting and pagination work', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/products?sort=price_desc&limit=2&page=1`);
    const list = await res.json();
    assert.strictEqual(list.length, 2);
    assert.ok(list[0].price >= list[1].price);
    assert.strictEqual(res.headers.get('x-total-count'), '6');
  }));

test('GET /api/episodes filters by query', () =>
  withServer(async (base) => {
    const all = await (await fetch(`${base}/api/episodes`)).json();
    assert.ok(all.length > 0);
    const none = await (await fetch(`${base}/api/episodes?q=zzzz`)).json();
    assert.strictEqual(none.length, 0);
  }));

test('security headers are set', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/products`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  }));
