import type {
  ApiErrorResponse,
  ParseSuccessResponse,
  ParserSummary,
} from "./api";
import {
  CLIENT_REQUEST_TIMEOUT_MS,
  MAX_HIGHLIGHTED_RESULT_BYTES,
} from "./constants";

const BYTE_FORMATTER = new Intl.NumberFormat("en-US");
const TEXT_ENCODER = new TextEncoder();
const HTML_RESPONSE_PATTERN = /^\s*<(?:!doctype|html|body|head)\b/i;

export type JsonTokenType =
  | "whitespace"
  | "punctuation"
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "plain";

export type JsonToken = {
  type: JsonTokenType;
  value: string;
};

export type ResultView = {
  text: string;
  tokens: JsonToken[] | null;
  byteLength: number;
};

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function readUtf8ByteLength(value: string) {
  return TEXT_ENCODER.encode(value).length;
}

export function formatBytes(bytes: number) {
  if (bytes < 1_024) {
    return `${BYTE_FORMATTER.format(bytes)} B`;
  }

  if (bytes < 1_048_576) {
    return `${(bytes / 1_024).toFixed(1)} KB`;
  }

  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const matcher =
    /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]|\s+|./g;

  for (const match of source.matchAll(matcher)) {
    const value = match[0];
    const index = match.index ?? 0;
    let type: JsonTokenType = "plain";

    if (/^\s+$/.test(value)) {
      type = "whitespace";
    } else if (value === "true" || value === "false") {
      type = "boolean";
    } else if (value === "null") {
      type = "null";
    } else if (
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)
    ) {
      type = "number";
    } else if (/^"/.test(value)) {
      const hasColonAfterValue = /^\s*:/.test(source.slice(index + value.length));
      type = hasColonAfterValue ? "key" : "string";
    } else if (/^[{}\[\],:]$/.test(value)) {
      type = "punctuation";
    }

    tokens.push({ type, value });
  }

  return tokens;
}

export function getJsonTokenClassName(type: JsonTokenType) {
  switch (type) {
    case "key":
      return "json-token--key";
    case "string":
      return "json-token--string";
    case "number":
      return "json-token--number";
    case "boolean":
      return "json-token--boolean";
    case "null":
      return "json-token--null";
    case "punctuation":
      return "json-token--punctuation";
    case "plain":
      return "json-token--plain";
    default:
      return "";
  }
}

export async function readResponseBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function normalizeBodyText(text: string) {
  const trimmed = text.trim();

  if (!trimmed || HTML_RESPONSE_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed.length > 400 ? `${trimmed.slice(0, 397).trimEnd()}...` : trimmed;
}

export function getResponseErrorMessage(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  if (typeof body === "string") {
    return normalizeBodyText(body) ?? fallback;
  }

  return fallback;
}

export function isApiErrorResponse(body: unknown): body is ApiErrorResponse {
  return Boolean(
    body &&
      typeof body === "object" &&
      "success" in body &&
      body.success === false &&
      "error" in body &&
      typeof body.error === "string",
  );
}

export function isParseSuccessResponse(
  body: unknown,
): body is ParseSuccessResponse {
  return Boolean(
    body &&
      typeof body === "object" &&
      "success" in body &&
      body.success === true &&
      "meta" in body,
  );
}

export function isParserSummaryList(body: unknown): body is ParserSummary[] {
  return (
    Array.isArray(body) &&
    body.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        "slug" in entry &&
        typeof entry.slug === "string" &&
        "description" in entry &&
        typeof entry.description === "string",
    )
  );
}

export function buildSelectionPreview(parser: string) {
  return parser
    ? parser
    : "Choose a format to load a tailored placeholder and output preview.";
}

export function safeReadStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeWriteStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in constrained browser environments.
  }
}

export async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("Clipboard support is unavailable.");
}

export function selectTextContent(node: HTMLElement) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }

  const selection = window.getSelection();

  if (!selection) {
    return false;
  }

  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function copySelectedText() {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

export function formatResultForDisplay(data: unknown): ResultView {
  const text = JSON.stringify(data, null, 2);
  const byteLength = readUtf8ByteLength(text);

  return {
    text,
    tokens:
      byteLength <= MAX_HIGHLIGHTED_RESULT_BYTES ? tokenizeJson(text) : null,
    byteLength,
  };
}

export async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = CLIENT_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let timedOut = false;

  const handleUpstreamAbort = () => {
    controller.abort();
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener("abort", handleUpstreamAbort, {
        once: true,
      });
    }
  }

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    return {
      response,
      body: await readResponseBody(response),
    };
  } catch (error) {
    if (timedOut) {
      throw new TimeoutError(
        `The request timed out after ${Math.round(timeoutMs / 1_000)} seconds.`,
      );
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
  }
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
