import { randomBytes } from "node:crypto";
import type { ParseApiResponse, ParseRequestBody } from "@/lib/api";
import { getCatalogSnapshot } from "@/lib/catalog-cache";
import {
  MAX_PARSE_INPUT_BYTES,
  MAX_PARSE_REQUEST_BYTES,
} from "@/lib/constants";
import { normalizeAppError, AppError } from "@/lib/errors";
import {
  errorResponse,
  jsonResponse,
  mergeHeaders,
  methodNotAllowedResponse,
  optionsResponse,
  readJsonRequest,
} from "@/lib/http";
import { extractClientIp } from "@/lib/ip";
import {
  hashIp,
  logParseRequest,
  logRateLimitHit,
  logSubprocessFailure,
} from "@/lib/logging";
import { consumeParseRateLimit, peekParseRateLimit } from "@/lib/rate-limit";
import { PARSER_SLUG_PATTERN } from "@/lib/parsers";
import { parseWithFormat } from "@/lib/parser-runtime";

export const runtime = "nodejs";

const ALLOWED_METHODS = ["POST", "OPTIONS"] as const;

type ParseRequestPayload = Record<string, unknown>;

function readInputSize(input: string) {
  return Buffer.byteLength(input, "utf8");
}

function validateParseRequestPayload(body: unknown): ParseRequestBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "bad_request", "Request body must be valid JSON.");
  }

  const payload = body as ParseRequestPayload;
  const allowedFields = new Set<keyof ParseRequestBody>(["parser", "input"]);
  const unknownFields = Object.keys(payload).filter(
    (field) => !allowedFields.has(field as keyof ParseRequestBody),
  );

  if (unknownFields.length > 0) {
    throw new AppError(400, "bad_request", "Request body must be valid JSON.");
  }

  if (!("parser" in payload)) {
    throw new AppError(400, "bad_request", "parser is required.");
  }

  if (typeof payload.parser !== "string") {
    throw new AppError(400, "bad_request", "parser is required.");
  }

  const parser = payload.parser;

  if (!PARSER_SLUG_PATTERN.test(parser)) {
    throw new AppError(
      400,
      "bad_request",
      "parser contains invalid characters.",
    );
  }

  if (!("input" in payload)) {
    throw new AppError(400, "bad_request", "input is required.");
  }

  if (typeof payload.input !== "string") {
    throw new AppError(400, "bad_request", "input is required.");
  }

  const input = payload.input.trim();

  if (input.length === 0) {
    throw new AppError(400, "bad_request", "input must not be empty.");
  }

  if (readInputSize(input) > MAX_PARSE_INPUT_BYTES) {
    throw new AppError(400, "bad_request", "Input exceeds the 512 KB limit.");
  }

  return {
    parser,
    input,
  };
}

function logRateLimit(appError: AppError, ipHash: string) {
  if (!appError.details?.rateLimitTier || !appError.details.requestCount) {
    return;
  }

  logRateLimitHit({
    timestamp: new Date().toISOString(),
    ipHash,
    tier: appError.details.rateLimitTier,
    requestCount: appError.details.requestCount,
  });
}

function logSubprocessError(appError: AppError, parser: string | null) {
  if (!appError.details?.failureType) {
    return;
  }

  logSubprocessFailure({
    timestamp: new Date().toISOString(),
    parser,
    failureType: appError.details.failureType,
    exitCode: appError.details.exitCode ?? null,
    stderrBytes: appError.details.stderrBytes ?? 0,
  });
}

function rateLimitHeaders(request: Request) {
  return peekParseRateLimit(extractClientIp(request));
}

function logAuxiliaryParseRequest(
  request: Request,
  statusCode: number,
  startedAt: number,
) {
  logParseRequest({
    timestamp: new Date().toISOString(),
    requestId: null,
    ipHash: hashIp(extractClientIp(request)),
    parser: null,
    inputBytes: 0,
    statusCode,
    responseTimeMs: Date.now() - startedAt,
    subprocessExitCode: null,
  });
}

export async function POST(request: Request) {
  const requestId = randomBytes(8).toString("hex");
  const startedAt = Date.now();
  const clientIp = extractClientIp(request);
  const ipHash = hashIp(clientIp);
  let selectedParser: string | null = null;
  let inputBytes = 0;
  let responseStatus = 500;
  let subprocessExitCode: number | null = null;
  let headers = peekParseRateLimit(clientIp);

  try {
    const body = await readJsonRequest<unknown>(request, {
      maxBytes: MAX_PARSE_REQUEST_BYTES,
      sizeExceededMessage: "Request body exceeds the 600 KB limit.",
    });

    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as ParseRequestPayload).parser === "string"
    ) {
      selectedParser = (body as ParseRequestPayload).parser as string;
    }

    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as ParseRequestPayload).input === "string"
    ) {
      inputBytes = readInputSize((body as ParseRequestPayload).input as string);
    }

    const payload = validateParseRequestPayload(body);
    selectedParser = payload.parser;
    inputBytes = readInputSize(payload.input);

    headers = consumeParseRateLimit(clientIp, inputBytes).headers;

    const catalog = await getCatalogSnapshot();

    if (!catalog.available) {
      throw new AppError(
        503,
        "runtime_unavailable",
        "Parser runtime is not available.",
      );
    }

    if (!catalog.allowlist.has(payload.parser)) {
      throw new AppError(
        400,
        "unknown_parser",
        "Unknown parser. Choose a parser from the catalog.",
      );
    }

    const parsed = await parseWithFormat<unknown>(payload.parser, payload.input);
    subprocessExitCode = parsed.exitCode;
    const parsedAt = new Date().toISOString();

    const response = jsonResponse<ParseApiResponse>(
      {
        success: true,
        data: parsed.data,
        meta: {
          parser: payload.parser,
          durationMs: Date.now() - startedAt,
          inputBytes,
          outputBytes: parsed.jsonBytes,
          parsedAt,
        },
      },
      {
        headers,
      },
    );
    responseStatus = response.status;
    return response;
  } catch (error) {
    const appError = normalizeAppError(error, {
      status: 500,
      code: "internal_error",
      message: "An unexpected error occurred.",
    });
    responseStatus = appError.status;
    subprocessExitCode = appError.details?.exitCode ?? null;
    logRateLimit(appError, ipHash);
    logSubprocessError(appError, selectedParser);

    return errorResponse(appError.status, appError.code, appError.message, {
      headers: mergeHeaders(headers, appError.headers),
    }, requestId);
  } finally {
    logParseRequest({
      timestamp: new Date().toISOString(),
      requestId,
      ipHash,
      parser: selectedParser,
      inputBytes,
      statusCode: responseStatus,
      responseTimeMs: Date.now() - startedAt,
      subprocessExitCode,
    });
  }
}

function methodNotAllowed(request: Request) {
  const startedAt = Date.now();
  const response = methodNotAllowedResponse(
    ALLOWED_METHODS,
    "Only POST is supported for this endpoint.",
    {
      headers: rateLimitHeaders(request),
    },
  );
  logAuxiliaryParseRequest(request, response.status, startedAt);
  return response;
}

export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export function OPTIONS(request: Request) {
  const startedAt = Date.now();
  const response = optionsResponse(ALLOWED_METHODS, {
    headers: rateLimitHeaders(request),
  });
  logAuxiliaryParseRequest(request, response.status, startedAt);
  return response;
}
