import type { ApiErrorResponse, HealthApiResponse } from "@/lib/api";
import { getCatalogSnapshot } from "@/lib/catalog-cache";
import { normalizeAppError } from "@/lib/errors";
import {
  jsonResponse,
  methodNotAllowedResponse,
  optionsResponse,
} from "@/lib/http";

export const runtime = "nodejs";

const ALLOWED_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export async function GET() {
  try {
    return jsonResponse<HealthApiResponse>({
      status: "ok",
    });
  } catch (error) {
    const appError = normalizeAppError(error, {
      status: 500,
      code: "internal_error",
      message: "Unable to read service health.",
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
