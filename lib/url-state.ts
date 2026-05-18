import LZString from "lz-string";
import { MAX_SHARE_STATE_ENCODED_CHARS } from "./constants";

/** PRD §10 — align with server allowlist */
export const PARSER_SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function isValidParserSlug(parser: string) {
  return PARSER_SLUG_PATTERN.test(parser);
}

export type AppShareState = {
  parser: string;
  input: string;
};

/**
 * PRD §9 — LZ-based hash fragment `state=<encoded>`
 */
export function encodeHashState(parser: string, input: string) {
  const payload = JSON.stringify({ parser, input });
  return LZString.compressToEncodedURIComponent(payload);
}

export function buildHashFragment(parser: string, input: string) {
  return `state=${encodeHashState(parser, input)}`;
}

export function getEncodedHashLength(parser: string, input: string) {
  return buildHashFragment(parser, input).length;
}

export function decodeHashStateFromLocationHash(
  hash: string,
): AppShareState | null {
  const raw = hash.replace(/^#/, "").trim();

  if (!raw.startsWith("state=")) {
    return null;
  }

  const encoded = raw.slice("state=".length);

  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);

    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      typeof (parsed as AppShareState).parser !== "string" ||
      typeof (parsed as AppShareState).input !== "string"
    ) {
      return null;
    }

    const { parser, input } = parsed as AppShareState;

    if (!isValidParserSlug(parser)) {
      return null;
    }

    return { parser, input };
  } catch {
    return null;
  }
}

export type EncodeAppStateResult =
  | { tooLarge: true }
  | { tooLarge: false; hashFragment: string };

export function encodeAppStateForUrl(
  parser: string,
  input: string,
): EncodeAppStateResult {
  const hashFragment = buildHashFragment(parser, input);

  if (hashFragment.length > MAX_SHARE_STATE_ENCODED_CHARS) {
    return { tooLarge: true };
  }

  return { tooLarge: false, hashFragment };
}

/** Legacy: gzip/base64 query ?input= for trimmed shares */
export async function compressToBase64(input: string) {
  const compressedStream = new Blob([input])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressedBuffer = await new Response(compressedStream).arrayBuffer();
  return bytesToBase64(new Uint8Array(compressedBuffer));
}

export async function decompressFromBase64(compressed: string) {
  const compressedBytes = base64ToBytes(compressed);
  const decompressedStream = new Blob([compressedBytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressedStream).text();
}

export async function decodeAppState(params: URLSearchParams) {
  const parser = params.get("parser");
  const compressedInput = params.get("input");

  if (!parser || !compressedInput || !isValidParserSlug(parser)) {
    return null;
  }

  try {
    return {
      parser,
      input: await decompressFromBase64(compressedInput),
    };
  } catch {
    return null;
  }
}
