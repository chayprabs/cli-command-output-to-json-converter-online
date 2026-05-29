# ParseDeck — Product Specification

ParseDeck is a **complete** web product for converting pasted terminal / CLI output into structured data using the [jc](https://github.com/kellyjonbrazil/jc) parser runtime.

## User journey

1. Open the homepage — no account required.
2. See runtime status (jc version, format count, rate limits).
3. Search and select a command format (170+ parsers).
4. Paste output, upload a `.txt` file, or load a built-in sample.
5. Optionally set parse options: JSON vs YAML, prettify, slurp (`-d`), auto-parse on/off.
6. Click **Parse output** (or wait for auto-parse).
7. Inspect highlighted JSON (or plain YAML), copy, download JSON/CSV, or copy a share link.

## Core capabilities

| Capability | Status |
|------------|--------|
| Live parser catalog from `jc --about` | Shipped |
| Correct jc flag per format (not lossy slug) | Shipped |
| POST `/api/parse` with options | Shipped |
| Rate limiting (per IP) | Shipped |
| Shareable URL state (hash) | Shipped |
| File upload | Shipped |
| YAML output mode | Shipped |
| Health + status endpoints | Shipped |
| Privacy / Terms legal pages | Shipped |

## API

- `GET /api/parsers` — catalog
- `POST /api/parse` — `{ parser, input, options? }`
- `GET /api/health` — liveness + jc readiness
- `GET /api/status` — version, parser count, limit config

## Non-goals

- User accounts or saved history on server
- Parsing arbitrary files (PDF, images) — text only
- Affiliation with the jc upstream project

## Operations

- Requires Python 3 + `jc` on the server
- Single-instance rate limits unless Redis (or similar) is added
- Put TLS and HSTS at the reverse proxy
