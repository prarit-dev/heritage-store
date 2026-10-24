'use strict';
const cart = new Map(); // product id -> { product, qty }
const $ = (id) => document.getElementById(id);

async function loadProducts() {
  const params = new URLSearchParams();
  if ($('search').value) params.set('q', $('search').value);
  if ($('category').value) params.set('category', $('category').value);
  if ($('sort').value) params.set('sort', $('sort').value);
  const res = await fetch(`/api/products?${params}`);
  renderProducts(await res.json());
}

function renderProducts(list) {
  const grid = $('products');
  grid.replaceChildren();
  if (list.length === 0) {
    grid.textContent = 'No products found.';
    return;
  }
  for (const p of list) {
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h3');
    title.textContent = p.name;
    const desc = document.createElement('p');
    desc.textContent = p.description;
    const price = document.createElement('p');
    price.className = 'price';
    price.textContent = `₹${p.price}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Add to cart';
    btn.addEventListener('click', () => addToCart(p));
    card.append(title, desc, price, btn);
    grid.append(card);
  }
}

function addToCart(product) {
  const entry = cart.get(product.id) || { product, qty: 0 };
  entry.qty = Math.min(entry.qty + 1, 10);
  cart.set(product.id, entry);
  renderCart();
}

function renderCart() {
  const list = $('cart-items');
  list.replaceChildren();
  let total = 0;
  for (const { product, qty } of cart.values()) {
    total += product.price * qty;
    const li = document.createElement('li');
    li.textContent = `${product.name} × ${qty}`;
    list.append(li);
  }
  $('cart-total').textContent = cart.size ? `Total: ₹${total}` : 'Your cart is empty.';
  $('checkout').disabled = cart.size === 0;
}

async function checkout() {
  const items = [...cart.values()].map(({ product, qty }) => ({ id: product.id, qty }));
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  $('message').textContent = res.ok
    ? `Order confirmed. Server-verified total: ₹${data.total}`
    : `Error: ${data.error}`;
  if (res.ok) { cart.clear(); renderCart(); }
}

let timer;
$('search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadProducts, 250); });
$('category').addEventListener('change', loadProducts);
$('sort').addEventListener('change', loadProducts);

async function loadEpisodes() {
  const res = await fetch('/api/episodes');
  const list = $('episodes');
  for (const e of await res.json()) {
    const li = document.createElement('li');
    li.textContent = `${e.title} (${e.durationMin} min)`;
    list.append(li);
  }
}
$('checkout').addEventListener('click', checkout);
renderCart();
loadProducts();
loadEpisodes();
