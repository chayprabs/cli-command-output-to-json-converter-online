# ParseDeck

ParseDeck is a focused web workspace for turning pasted terminal output into structured JSON. Choose a format, drop in raw text, and inspect highlighted results without leaving the browser.

## Why ParseDeck Exists

Terminal output is great for humans and awkward for automation. ParseDeck gives teams a faster way to validate command output, shape it into JSON, and move the result into scripts, runbooks, dashboards, or incident notes.

## Who It's For

- Sysadmins validating command output before automating around it
- DevOps and platform engineers shaping diagnostics into structured data
- Automation engineers prototyping parsing flows without building a UI first
- Support and operations teams who need quick JSON output during investigations

## What It Does

- Loads a searchable format catalog at startup
- Accepts pasted multi-line terminal output
- Returns structured JSON with timing and payload metadata
- Highlights JSON tokens for easier scanning
- Lets you copy parsed output with one click

## Requirements

- Node.js 18.18 or newer
- Python 3.x
- A working `jc` installation available through `jc`, `python -m jc`, or `py -m jc`

## Run Locally

1. Install JavaScript dependencies:

```bash
npm install
```

2. Install the parsing runtime:

```bash
pip install jc
```

3. Start the development server:

```bash
npm run dev
```

4. Open the local app in your browser:

```text
http://127.0.0.1:3000
```

## Supported Formats

ParseDeck reads the available format catalog from the installed parsing runtime when the app starts, so the exact list tracks the version you have installed. Common choices include:

- `ls`
- `ps`
- `ping`
- `df`
- `du`
- `env`
- `dig`
- `ifconfig`
- `netstat`
- `systemctl`
- `top`
- `ss`
- `route`
- `yaml`
- `xml`
- `csv`

## API

`GET /api/parsers`

- Returns the available format catalog as `{ slug, description }[]`

`POST /api/parse`

- Accepts JSON shaped like `{ "parser": "ls", "input": "<raw terminal output>" }`
- Returns parsed data plus timing and byte metadata

## Built With

- Next.js 15
- React 19
- Tailwind CSS 4
- `jc` by Kelly Brazil as the parsing runtime behind the format catalog and JSON conversion flow

The upstream `jc` project is licensed under MIT. ParseDeck keeps its attribution and license notice in [NOTICE](./NOTICE).

## License

ParseDeck is released under the MIT License. Third-party attribution and license text live in [NOTICE](./NOTICE).
