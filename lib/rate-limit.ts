import {
  PARSE_RATE_LIMIT_INPUT_MB_PER_HOUR,
  PARSE_RATE_LIMIT_PER_MINUTE,
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
} from "./constants";
import { AppError } from "./errors";

export type RateLimitHeadersResult = {
  headers: Headers;
};

type RequestEntry = {
  t: number;
  bytes: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * 60_000;
const MAX_BYTES_PER_HOUR = PARSE_RATE_LIMIT_INPUT_MB_PER_HOUR * 1024 * 1024;
const MAX_REQUESTS_PER_MINUTE = PARSE_RATE_LIMIT_PER_MINUTE;

const store = new Map<string, RequestEntry[]>();

function pruneEntries(entries: RequestEntry[], now: number) {
  return entries.filter((e) => e.t > now - HOUR_MS);
}

function minuteWindowCount(entries: RequestEntry[], now: number) {
  return entries.filter((e) => e.t > now - MINUTE_MS).length;
}

function hourByteTotal(entries: RequestEntry[]) {
  return entries.reduce((sum, e) => sum + e.bytes, 0);
}

function buildRateLimitHeaders(entries: RequestEntry[], now: number) {
  const minuteCount = minuteWindowCount(entries, now);
  return new Headers({
    "X-RateLimit-Limit": String(MAX_REQUESTS_PER_MINUTE),
    "X-RateLimit-Remaining": String(
      Math.max(0, MAX_REQUESTS_PER_MINUTE - minuteCount),
    ),
  });
}

function retryAfterSecondsFromOldestInMinute(
  entries: RequestEntry[],
  now: number,
) {
  const inWindow = entries.filter((e) => e.t > now - MINUTE_MS);
  if (inWindow.length === 0) {
    return 1;
  }

  const oldest = Math.min(...inWindow.map((e) => e.t));
  return Math.max(1, Math.ceil((oldest + MINUTE_MS - now) / 1_000));
}

function retryAfterSecondsForByteRelief(
  entries: RequestEntry[],
  now: number,
  incomingBytes: number,
) {
  const sorted = [...entries].sort((a, b) => a.t - b.t);
  let excess = hourByteTotal(entries) + incomingBytes - MAX_BYTES_PER_HOUR;

  if (excess <= 0) {
    return 1;
  }

  for (const entry of sorted) {
    excess -= entry.bytes;
    if (excess <= 0) {
      return Math.max(
        1,
        Math.ceil((entry.t + HOUR_MS - now) / 1_000),
      );
    }
  }

  return 3_600;
}

export function peekParseRateLimit(ip: string) {
  const now = Date.now();
  const entries = pruneEntries(store.get(ip) ?? [], now);
  return buildRateLimitHeaders(entries, now);
}

/**
 * PRD §12 — sliding minute request cap + rolling-hour input bytes per IP.
 */
export function consumeParseRateLimit(
  ip: string,
  inputBytes: number,
): RateLimitHeadersResult {
  const now = Date.now();
  let entries = pruneEntries(store.get(ip) ?? [], now);

  if (minuteWindowCount(entries, now) >= MAX_REQUESTS_PER_MINUTE) {
    const retryAfterSeconds = retryAfterSecondsFromOldestInMinute(
      entries,
      now,
    );

    throw new AppError(
      429,
      "rate_limited",
      `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
      {
        headers: new Headers({
          ...Object.fromEntries(buildRateLimitHeaders(entries, now).entries()),
          "Retry-After": String(retryAfterSeconds),
        }),
        details: {
          rateLimitTier: 1,
          requestCount: minuteWindowCount(entries, now),
          retryAfterSeconds,
        },
      },
    );
  }

  if (hourByteTotal(entries) + inputBytes > MAX_BYTES_PER_HOUR) {
    const retryAfterSeconds = retryAfterSecondsForByteRelief(
      entries,
      now,
      inputBytes,
    );

    throw new AppError(
      429,
      "rate_limited",
      "Input limit reached. Try again later.",
      {
        headers: new Headers({
          ...Object.fromEntries(buildRateLimitHeaders(entries, now).entries()),
          "Retry-After": String(retryAfterSeconds),
        }),
        details: {
          rateLimitTier: 2,
          requestCount: minuteWindowCount(entries, now),
          retryAfterSeconds,
        },
      },
    );
  }

  entries = [...entries, { t: now, bytes: inputBytes }];
  store.set(ip, entries);

  return {
    headers: buildRateLimitHeaders(entries, now),
  };
}

setInterval(() => {
  const now = Date.now();
  const cutoff = now - HOUR_MS * 2;

  for (const [key, entries] of store.entries()) {
    const next = entries.filter((e) => e.t > cutoff);

    if (next.length > 0) {
      store.set(key, next);
    } else {
      store.delete(key);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS).unref?.();
