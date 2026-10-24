# Heritage Store

A small full-stack demo of a content and merchandise store: product listing, search and category filters, a cart, and a checkout endpoint that validates the order and computes the total on the server.

Built with plain Node.js (no frameworks, no dependencies) and vanilla JavaScript, to show core web fundamentals clearly.

## Features
- REST API: list and filter products, fetch a single product, checkout
- Server-side price calculation and input validation (quantity limits, unknown product ids, empty cart)
- Static file serving with path-traversal protection
- Responsive UI with debounced search; user-facing text is rendered with `textContent` to avoid XSS
- Sorting (`sort=price_asc|price_desc|name`) and pagination (`limit`, `page`, `X-Total-Count` header)
- Episodes endpoint with search (sample data, to model a content catalogue)
- Basic hardening: per-IP rate limiting, `nosniff`, `Referrer-Policy` and Content-Security-Policy headers
- Dockerfile and GitHub Actions CI that runs the tests on every push
- Automated tests using Node's built-in test runner (9 tests)

## Tech stack
Node.js 18+, HTTP module, vanilla JavaScript, HTML, CSS

## Run locally
```bash
git clone https://github.com/prarit-dev/heritage-store.git
cd heritage-store
npm start        # http://localhost:3000
npm test         # runs the API tests
docker build -t heritage-store . && docker run -p 3000:3000 heritage-store
```

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products?q=&category=&sort=&limit=&page=` | List products with filters, sorting and pagination |
| GET | `/api/episodes?q=` | List sample podcast episodes |
| GET | `/api/products/:id` | Get one product (404 if missing) |
| POST | `/api/checkout` | Body: `{ "items": [{ "id": 1, "qty": 2 }] }`. Returns the verified order total |

## Project structure
```
server.js        HTTP server, routing, validation
data/            Product data (JSON)
public/          Frontend (HTML, CSS, JS)
test/            API and validation tests
```

## Configuration
See `.env.example` (`PORT`, `RATE_LIMIT`).

## Possible next steps
- Replace the JSON file with PostgreSQL
- User accounts and order history
- Payment gateway integration
- Deploy on Render or Railway
