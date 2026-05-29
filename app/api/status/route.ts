import type { ApiErrorResponse, StatusApiResponse } from "@/lib/api";
import {
  PARSE_RATE_LIMIT_INPUT_MB_PER_HOUR,
  PARSE_RATE_LIMIT_PER_MINUTE,
} from "@/lib/constants";
import { getCatalogSnapshot } from "@/lib/catalog-cache";
import { normalizeAppError } from "@/lib/errors";
import {
  jsonResponse,
  methodNotAllowedResponse,
  optionsResponse,
} from "@/lib/http";
import { getParserRuntimeVersion } from "@/lib/parser-runtime";

export const runtime = "nodejs";

const ALLOWED_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export async function GET() {
  try {
    const catalog = await getCatalogSnapshot();

    if (!catalog.available) {
      return jsonResponse<ApiErrorResponse>(
        {
          success: false,
          error: "Parser runtime is not available.",
          code: "runtime_unavailable",
        },
        { status: 503 },
      );
    }

    const jcVersion = await getParserRuntimeVersion();

    return jsonResponse<StatusApiResponse>({
      status: "ok",
      jcVersion,
      parserCount: catalog.parsers.length,
      rateLimit: {
        requestsPerMinute: PARSE_RATE_LIMIT_PER_MINUTE,
        inputMegabytesPerHour: PARSE_RATE_LIMIT_INPUT_MB_PER_HOUR,
      },
    });
  } catch (error) {
    const appError = normalizeAppError(error, {
      status: 500,
      code: "internal_error",
      message: "Unable to read service status.",
    });

    return jsonResponse<ApiErrorResponse>(
      {
        success: false,
        error: appError.message,
        code: appError.code,
      },
      { status: appError.status },
    );
  }
}

function methodNotAllowed() {
  return methodNotAllowedResponse(
    ALLOWED_METHODS,
    "Only GET is supported for this endpoint.",
  );
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export function OPTIONS() {
  return optionsResponse(ALLOWED_METHODS);
}
