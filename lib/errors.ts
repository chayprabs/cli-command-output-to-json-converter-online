import type { ApiErrorCode } from "./api";
import { sanitizeClientErrorMessage } from "./error-sanitizer";

type ErrorFallback = {
  status: number;
  code: ApiErrorCode;
  message: string;
  exposeUnexpectedMessage?: boolean;
};

export type RateLimitTier = 1 | 2 | 3;

export type SubprocessFailureType =
  | "timeout"
  | "output_exceeded"
  | "non_zero_exit"
  | "invalid_json";

export type AppErrorDetails = {
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  stdoutBytes?: number;
  stderrBytes?: number;
  failureType?: SubprocessFailureType;
  rateLimitTier?: RateLimitTier;
  requestCount?: number;
  retryAfterSeconds?: number;
};

type AppErrorOptions = {
  headers?: HeadersInit;
  details?: AppErrorDetails;
};

const UNSAFE_ERROR_MESSAGE_PATTERN =
  /([A-Z]:\\|\/[\w.-]+|\\[\w.-]+|at\s.+\(|ENOENT|spawn\s)/i;

function sanitizeUnexpectedMessage(message: string) {
  const normalized = message.replace(/\0/g, "").trim();

  if (!normalized || UNSAFE_ERROR_MESSAGE_PATTERN.test(normalized)) {
    return null;
  }

  const scrubbed = sanitizeClientErrorMessage(normalized);
  return scrubbed || null;
}

export class AppError extends Error {
  public readonly headers: Headers;
  public readonly details: AppErrorDetails | undefined;

  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message);
    this.name = "AppError";
    this.headers = new Headers(options.headers);
    this.details = options.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function normalizeAppError(
  error: unknown,
  fallback: ErrorFallback,
): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (fallback.exposeUnexpectedMessage && error instanceof Error) {
    const sanitizedMessage = sanitizeUnexpectedMessage(error.message);

    if (sanitizedMessage) {
      return new AppError(fallback.status, fallback.code, sanitizedMessage);
    }
  }

  return new AppError(fallback.status, fallback.code, fallback.message);
}
