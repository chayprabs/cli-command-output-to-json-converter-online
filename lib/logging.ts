import { createHmac } from "node:crypto";
import type { RateLimitTier, SubprocessFailureType } from "./errors";

const LOG_HASH_SECRET =
  process.env.LOG_HASH_SECRET ?? "parsedeck-log-hash-v1";

type ParseRequestLog = {
  timestamp: string;
  ipHash: string;
  parser: string | null;
  inputBytes: number;
  statusCode: number;
  responseTimeMs: number;
  subprocessExitCode: number | null;
};

type RateLimitLog = {
  timestamp: string;
  ipHash: string;
  tier: RateLimitTier;
  requestCount: number;
};

type SubprocessFailureLog = {
  timestamp: string;
  parser: string | null;
  failureType: SubprocessFailureType;
  exitCode: number | null;
  stderrBytes: number;
};

function writeLog(entry: Record<string, string | number | boolean | null>) {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export function hashIp(ip: string) {
  return createHmac("sha256", LOG_HASH_SECRET)
    .update(ip)
    .digest("hex")
    .slice(0, 24);
}

export function logParseRequest(log: ParseRequestLog) {
  writeLog({
    event: "parse_request",
    timestamp: log.timestamp,
    ipHash: log.ipHash,
    parser: log.parser,
    inputBytes: log.inputBytes,
    statusCode: log.statusCode,
    responseTimeMs: log.responseTimeMs,
    subprocessExitCode: log.subprocessExitCode,
  });
}

export function logRateLimitHit(log: RateLimitLog) {
  writeLog({
    event: "rate_limit_hit",
    timestamp: log.timestamp,
    ipHash: log.ipHash,
    tier: log.tier,
    requestCount: log.requestCount,
  });
}

export function logSubprocessFailure(log: SubprocessFailureLog) {
  writeLog({
    event: "subprocess_failure",
    timestamp: log.timestamp,
    parser: log.parser,
    failureType: log.failureType,
    exitCode: log.exitCode,
    stderrBytes: log.stderrBytes,
  });
}
