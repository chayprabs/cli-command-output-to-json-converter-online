import { NextResponse } from "next/server";
import type { ApiErrorCode, ApiErrorResponse } from "./api";
import { AppError } from "./errors";

type JsonRequestOptions = {
  maxBytes: number;
  sizeExceededMessage: string;
};

export function mergeHeaders(...headersList: Array<HeadersInit | undefined>) {
  const headers = new Headers();

  for (const headersInit of headersList) {
    if (!headersInit) {
      continue;
    }

    const nextHeaders = new Headers(headersInit);

    nextHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function parseContentLength(value: string | null) {
  if (!value) {
    return null;
  }

  const length = Number.parseInt(value, 10);
  return Number.isFinite(length) && length >= 0 ? length : null;
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel();
  } catch {
    // Ignore cancellation failures caused by abrupt client disconnects.
  }
}

export function jsonResponse<T>(body: T, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: mergeHeaders(init.headers),
  });
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  error: string,
  init: ResponseInit = {},
  requestId?: string,
) {
  return jsonResponse<ApiErrorResponse>(
    {
      success: false,
      error,
      code,
      ...(requestId ? { requestId } : {}),
    },
    {
      ...init,
      status,
    },
  );
}

export function methodNotAllowedResponse(
  allowedMethods: readonly string[],
  message: string,
  init: ResponseInit = {},
) {
  return errorResponse(405, "method_not_allowed", message, {
    ...init,
    headers: mergeHeaders(init.headers, {
      Allow: allowedMethods.join(", "),
    }),
  });
}

export function optionsResponse(
  allowedMethods: readonly string[],
  init: ResponseInit = {},
) {
  return new NextResponse(null, {
    ...init,
    status: 204,
    headers: mergeHeaders(init.headers, {
      Allow: allowedMethods.join(", "),
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": allowedMethods.join(", "),
    }),
  });
}

export function isJsonContentType(contentType: string | null) {
  if (!contentType) {
    return false;
  }

  return contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

export async function readJsonRequest<T>(
  request: Request,
  options: JsonRequestOptions,
) {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new AppError(
      415,
      "unsupported_media_type",
      "Send JSON when calling this endpoint.",
    );
  }

  const declaredLength = parseContentLength(request.headers.get("content-length"));

  if (declaredLength !== null && declaredLength > options.maxBytes) {
    throw new AppError(413, "payload_too_large", options.sizeExceededMessage);
  }

  const reader = request.body?.getReader();

  if (!reader) {
    throw new AppError(
      400,
      "bad_request",
      "Request body must be valid JSON.",
    );
  }

  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      receivedBytes += value.byteLength;

      if (receivedBytes > options.maxBytes) {
        await cancelReader(reader);
        throw new AppError(413, "payload_too_large", options.sizeExceededMessage);
      }

      body += decoder.decode(value, { stream: true });
    }

    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  if (!body.trim()) {
    throw new AppError(
      400,
      "bad_request",
      "Request body must be valid JSON.",
    );
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new AppError(
      400,
      "bad_request",
      "Request body must be valid JSON.",
    );
  }
}
