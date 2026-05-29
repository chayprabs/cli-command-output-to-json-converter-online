# ParseDeck

ParseDeck is a free web tool that turns pasted terminal output into structured JSON. Choose a command format (for example `ls`, `ps`, or `dig`), paste raw CLI output, and get JSON you can copy or download—right in your browser.

**Live workflow:** pick a parser → paste output → click **Parse output** → inspect JSON below.

## Features

- Searchable catalog of 170+ formats from the installed `jc` runtime
- Paste multi-line terminal output (up to 512 KB UTF-8 per request)
- Syntax-highlighted JSON with copy and download (JSON / CSV when applicable)
- Shareable URL state (hash-encoded; optional)
- No accounts, no stored input, fair-use rate limits
- MIT-licensed open source

## Requirements

- **Node.js** 18.18+
- **Python 3** with **`jc`** (`pip install jc`)

## Run locally

```bash
npm install
pip install jc
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Environment (optional)

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CONTACT_EMAIL` | Shown on Privacy Policy |
| `NEXT_PUBLIC_GITHUB_URL` | GitHub link in header |
| `PARSE_TIMEOUT_MS` | Parser timeout (default 15000) |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | Per-IP limit (default 20) |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parsers` | GET | List `{ slug, description }[]` |
| `/api/parse` | POST | Body: `{ "parser": "ls", "input": "..." }` |
| `/api/health` | GET | Health check |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run ci:local` | Full local CI (typecheck, build, integration, e2e) |
| `npm run test:e2e` | Playwright browser tests |
| `npm run sync:parser-manifest` | Refresh parser manifest from `jc` |

## Docker

```bash
docker build -t parsedeck .
docker run -p 3000:3000 parsedeck
```

## Legal

- [Privacy Policy](/privacy)
- [Terms & Conditions](/terms)

## Built with

- [Next.js](https://nextjs.org) 15 · React 19 · Tailwind CSS 4
- [jc](https://github.com/kellyjonbrazil/jc) by Kelly Brazil (MIT) — parsing runtime

Third-party attribution: [NOTICE](./NOTICE).

## License

MIT © [Chaitanya Prabuddha](https://www.chaitanyaprabuddha.com)
