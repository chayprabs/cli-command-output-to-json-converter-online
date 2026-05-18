import { isIP } from "node:net";

function normalizeCandidateIp(value: string) {
  const trimmed = value.trim().replace(/^for=/i, "").replace(/^"|"$/g, "");

  if (!trimmed) {
    return null;
  }

  const bracketedMatch = /^\[([^[\]]+)\](?::\d+)?$/.exec(trimmed);

  if (bracketedMatch) {
    return bracketedMatch[1] ?? null;
  }

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }

  const ipv4WithPortMatch = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(trimmed);

  if (ipv4WithPortMatch) {
    return ipv4WithPortMatch[1] ?? null;
  }

  return trimmed;
}

function readValidatedIp(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeCandidateIp(value);

  if (!normalized || isIP(normalized) === 0) {
    return null;
  }

  return normalized;
}

export function extractClientIp(request: Request) {
  const forwardedHeader = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedHeader?.split(",")[0]?.trim() ?? null;

  return (
    readValidatedIp(firstForwardedIp) ??
    readValidatedIp(request.headers.get("x-real-ip")) ??
    "unknown"
  );
}
