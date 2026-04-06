import {
  PARSE_BURST_LIMIT,
  PARSE_BURST_WINDOW_MS,
  PARSE_RATE_LIMIT_PER_MINUTE,
  PARSE_RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
} from "./constants";
import { AppError } from "./errors";

type RequestRecord = {
  timestamp: number;
};

type RateLimitSnapshot = {
  headers: Headers;
  requestCount: number;
};

const requestStore = new Map<string, RequestRecord[]>();

function filterActiveRecords(records: RequestRecord[], now: number) {
  const minimumTimestamp = now - PARSE_RATE_LIMIT_WINDOW_MS;
  return records.filter((record) => record.timestamp > minimumTimestamp);
}

function filterWindowRecords(
  records: RequestRecord[],
  now: number,
  windowMs: number,
) {
  const minimumTimestamp = now - windowMs;
  return records.filter((record) => record.timestamp > minimumTimestamp);
}

function toRetryAfterSeconds(windowStartTimestamp: number, windowMs: number) {
  return Math.max(
    1,
    Math.ceil((windowStartTimestamp + windowMs - Date.now()) / 1_000),
  );
}

function buildRateLimitHeaders(records: RequestRecord[], now: number) {
  const resetAtMs =
    records[0]?.timestamp !== undefined
      ? records[0].timestamp + PARSE_RATE_LIMIT_WINDOW_MS
      : now + PARSE_RATE_LIMIT_WINDOW_MS;

  return new Headers({
    "X-RateLimit-Limit": String(PARSE_RATE_LIMIT_PER_MINUTE),
    "X-RateLimit-Remaining": String(
      Math.max(0, PARSE_RATE_LIMIT_PER_MINUTE - records.length),
    ),
    "X-RateLimit-Reset": String(Math.ceil(resetAtMs / 1_000)),
  });
}

function getSnapshot(ip: string, now: number): RateLimitSnapshot {
  const currentRecords = filterActiveRecords(requestStore.get(ip) ?? [], now);

  if (currentRecords.length > 0) {
    requestStore.set(ip, currentRecords);
  } else {
    requestStore.delete(ip);
  }

  return {
    headers: buildRateLimitHeaders(currentRecords, now),
    requestCount: currentRecords.length,
  };
}

export function peekParseRateLimit(ip: string) {
  return getSnapshot(ip, Date.now()).headers;
}

export function consumeParseRateLimit(ip: string) {
  const now = Date.now();
  const activeRecords = filterActiveRecords(requestStore.get(ip) ?? [], now);
  const burstRecords = filterWindowRecords(
    activeRecords,
    now,
    PARSE_BURST_WINDOW_MS,
  );

  if (burstRecords.length >= PARSE_BURST_LIMIT) {
    const retryAfterSeconds = toRetryAfterSeconds(
      burstRecords[0]?.timestamp ?? now,
      PARSE_BURST_WINDOW_MS,
    );

    throw new AppError(429, "rate_limited", "Too many requests, try again later.", {
      headers: new Headers({
        ...Object.fromEntries(buildRateLimitHeaders(activeRecords, now).entries()),
        "Retry-After": String(retryAfterSeconds),
      }),
      details: {
        rateLimitTier: 3,
        requestCount: burstRecords.length,
        retryAfterSeconds,
      },
    });
  }

  if (activeRecords.length >= PARSE_RATE_LIMIT_PER_MINUTE) {
    const retryAfterSeconds = toRetryAfterSeconds(
      activeRecords[0]?.timestamp ?? now,
      PARSE_RATE_LIMIT_WINDOW_MS,
    );

    throw new AppError(429, "rate_limited", "Too many requests, try again later.", {
      headers: new Headers({
        ...Object.fromEntries(buildRateLimitHeaders(activeRecords, now).entries()),
        "Retry-After": String(retryAfterSeconds),
      }),
      details: {
        rateLimitTier: 1,
        requestCount: activeRecords.length,
        retryAfterSeconds,
      },
    });
  }

  const nextRecords = [...activeRecords, { timestamp: now }];
  requestStore.set(ip, nextRecords);

  return {
    headers: buildRateLimitHeaders(nextRecords, now),
    requestCount: nextRecords.length,
  };
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [ip, records] of requestStore.entries()) {
    const activeRecords = filterActiveRecords(records, now);

    if (activeRecords.length > 0) {
      requestStore.set(ip, activeRecords);
    } else {
      requestStore.delete(ip);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

cleanupTimer.unref?.();
