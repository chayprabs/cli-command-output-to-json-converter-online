import type { ApiErrorResponse, ParserSummary } from "@/lib/api";
import { getCatalogSnapshot } from "@/lib/catalog-cache";
import { normalizeAppError } from "@/lib/errors";
import {
  jsonResponse,
  methodNotAllowedResponse,
  optionsResponse,
} from "@/lib/http";

export const runtime = "nodejs";

const ALLOWED_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

const CATALOG_CACHE_HEADERS = new Headers({
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
});

export async function GET() {
  try {
    const snapshot = await getCatalogSnapshot();

    if (!snapshot.available) {
      return jsonResponse<ApiErrorResponse>(
        {
          success: false,
          error: "Parser runtime is not available.",
          code: "runtime_unavailable",
        },
        { status: 503 },
      );
    }

    return jsonResponse<ParserSummary[]>([...snapshot.parsers], {
      headers: CATALOG_CACHE_HEADERS,
    });
  } catch (error) {
    const appError = normalizeAppError(error, {
      status: 500,
      code: "internal_error",
      message: "Unable to load the format catalog.",
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
