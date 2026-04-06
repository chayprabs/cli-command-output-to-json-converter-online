import type { ApiErrorResponse, ParserSummary } from "@/lib/api";
import { normalizeAppError } from "@/lib/errors";
import {
  jsonResponse,
  methodNotAllowedResponse,
  optionsResponse,
} from "@/lib/http";
import { getAvailableParsers } from "@/lib/parsers";

export const runtime = "nodejs";

const ALLOWED_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export async function GET() {
  try {
    const parsers = await getAvailableParsers();

    return jsonResponse<ParserSummary[]>([...parsers]);
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
