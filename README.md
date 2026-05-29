# ParseDeck

**ParseDeck** converts pasted terminal / CLI output into structured JSON or YAML using the [jc](https://github.com/kellyjonbrazil/jc) parser runtime. No account, no stored input — paste, parse, copy, download.

## Product features

- **170+ formats** loaded live from your installed `jc` version
- **Correct jc flags** per format (underscore/hyphen-safe mapping)
- **Parse options:** JSON or YAML output, prettify (`-p`), slurp (`-d`)
- **Auto-parse** (toggle off to save rate limit)
- **File upload** for `.txt` / `.log` samples
- **Load sample** and **command hints** from the catalog
- **Share links** (URL hash) — copy before or after parsing
- **Copy / download** JSON; CSV export for array results
- **Syntax-highlighted JSON** with large-output safeguards
- **Rate limits** with remaining quota shown after parse
- **Status bar:** jc version, format count, limit summary

## Quick start

```bash
npm install
pip install jc==1.25.6
npm run dev
```

Open http://127.0.0.1:3000

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/parsers` | Format catalog `{ slug, description, jcArgument, commandHint? }[]` |
| `POST /api/parse` | Body: `{ "parser": "ls", "input": "...", "options": { "outputFormat": "json", "prettify": false, "slurp": false } }` |
| `GET /api/health` | Readiness (503 if jc unavailable) |
| `GET /api/status` | jc version, parser count, rate-limit config |

See [docs/PRODUCT.md](./docs/PRODUCT.md) for the full product spec.

## Environment

Copy `.env.example` to `.env.local`. Key variables:

- `NEXT_PUBLIC_CONTACT_EMAIL` — Privacy page contact
- `NEXT_PUBLIC_GITHUB_URL` — Header GitHub link
- `PARSE_TIMEOUT_MS`, `RATE_LIMIT_*` — Server limits

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run ci:local` | Full CI (typecheck, build, integration, api-audit, e2e) |
| `npm run test:api` | API audit suite (server must be running) |
| `npm run sync:parser-manifest` | Refresh `lib/parser-manifest.json` from jc |

## Docker

```bash
docker build -t parsedeck .
docker run -p 3000:3000 parsedeck
```

## Legal

- [Privacy Policy](/privacy)
- [Terms & Conditions](/terms)

## License

MIT © [Chaitanya Prabuddha](https://www.chaitanyaprabuddha.com) — see [NOTICE](./NOTICE) for jc attribution.
