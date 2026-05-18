export type ParserSummary = {
  slug: string;
  description: string;
};

export type ParseRequestBody = {
  parser: string;
  input: string;
};

export type ParseMeta = {
  parser: string;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  parsedAt: string;
};

export type ApiErrorCode =
  | "bad_request"
  | "invalid_json"
  | "unsupported_media_type"
  | "payload_too_large"
  | "unknown_parser"
  | "rate_limited"
  | "request_timeout"
  | "runtime_unavailable"
  | "execution_timeout"
  | "parse_failed"
  | "method_not_allowed"
  | "internal_error";

export type ApiErrorResponse = {
  success: false;
  error: string;
  code: ApiErrorCode;
  requestId?: string;
};

export type ParseSuccessResponse = {
  success: true;
  data: unknown;
  meta: ParseMeta;
};

export type ParseApiResponse = ParseSuccessResponse | ApiErrorResponse;

export type HealthApiResponse = {
  status: "ok";
};
