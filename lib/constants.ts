function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** PRD §13 / §16 — milliseconds for jc subprocess */
export const PARSER_RUNTIME_TIMEOUT_MS = envInt("PARSE_TIMEOUT_MS", 15_000);

/** PRD §10 — max UTF-8 bytes for input field */
export const MAX_PARSE_INPUT_BYTES = 512 * 1024;

/** PRD §10 — max total JSON request body */
export const MAX_PARSE_REQUEST_BYTES = 600 * 1024;

/** PRD §13 — client warning threshold */
export const INPUT_WARNING_BYTES = 400 * 1024;

export const MAX_PARSE_OUTPUT_BYTES = 5 * 1024 * 1024;
export const MAX_PARSE_STDERR_BYTES = 10 * 1024;
export const MAX_PARSER_ABOUT_BYTES = 4_000_000;
export const CLIENT_REQUEST_TIMEOUT_MS = PARSER_RUNTIME_TIMEOUT_MS + 5_000;

/** PRD §7.3 — syntax highlighting cap (characters) */
export const MAX_HIGHLIGHT_RESULT_CHARS = 100_000;

/** PRD §7.3 — on-screen JSON truncation */
export const MAX_DISPLAY_RESULT_CHARS = 50_000;

export const MAX_VISIBLE_PARSER_RESULTS = 40;
export const PARSER_STORAGE_KEY = "parsedeck:last-format";

/** PRD §12 env defaults — applied in rate-limit module */
export const PARSE_RATE_LIMIT_PER_MINUTE = envInt(
  "RATE_LIMIT_REQUESTS_PER_MINUTE",
  20,
);
export const PARSE_RATE_LIMIT_INPUT_MB_PER_HOUR = envInt(
  "RATE_LIMIT_INPUT_MB_PER_HOUR",
  50,
);

export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60_000;
export const GLOBAL_SUBPROCESS_CONCURRENCY_LIMIT = 10;
export const BUSY_RETRY_AFTER_SECONDS = 1;
export const RUNTIME_UNAVAILABLE_RETRY_AFTER_SECONDS = 60;
export const EXECUTION_TIMEOUT_RETRY_AFTER_SECONDS = 10;
export const CONNECTION_HEADERS_TIMEOUT_MS = 5_000;
export const CONNECTION_REQUEST_TIMEOUT_MS = 10_000;
export const CONNECTION_KEEP_ALIVE_TIMEOUT_MS = 5_000;

/** PRD §9 — URL-encoded share state length guard */
export const MAX_SHARE_STATE_ENCODED_CHARS = 4_000;

/** Debounced auto-parse delay (PRD §7.2) */
export const AUTO_PARSE_DEBOUNCE_MS = 800;

/** Copy / share confirmation visibility (PRD §7.3, §9) */
export const TRANSIENT_UI_FEEDBACK_MS = 2_000;
