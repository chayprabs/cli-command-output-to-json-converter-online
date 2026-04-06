const PARSER_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

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

export async function encodeAppState(parser: string, input: string) {
  const params = new URLSearchParams();
  params.set("parser", parser);
  params.set("input", await compressToBase64(input));
  return params;
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
