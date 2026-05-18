const MAX_CLIENT_ERROR_LENGTH = 200;

/**
 * PRD §11.7 — strip paths, tracebacks, and noisy jc/python details before any client exposure.
 */
export function sanitizeJcStderr(stderr: string): string {
  let text = stderr.replace(/\0/g, "").trim();

  if (!text) {
    return "";
  }

  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let skipTrace = false;

  for (const line of lines) {
    const t = line.trim();

    if (/^Traceback \(most recent call last\):/i.test(t)) {
      skipTrace = true;
      continue;
    }

    if (skipTrace) {
      if (/^File\s+"/.test(t) || /^\s*File\s+"/.test(t)) {
        continue;
      }

      if (/^[A-Za-z_][\w.]*\s*:\s*/.test(t)) {
        skipTrace = false;
        const colon = t.indexOf(":");
        const msg = colon >= 0 ? t.slice(colon + 1).trim() : t;
        if (msg) {
          kept.push(msg);
        }
        continue;
      }

      continue;
    }

    if (
      /^\/?[\w./-]+\/[\w./-]+(?:\.py)?\s*$/i.test(t) ||
      /^[A-Za-z]:\\/.test(t)
    ) {
      continue;
    }

    if (/\bjc\b.*\b\d+\.\d+\.\d+/.test(t) && t.length < 80) {
      continue;
    }

    kept.push(line);
  }

  text = kept
    .join("\n")
    .replace(/([A-Za-z_][\w.]*\.)*([A-Za-z_][\w.]*Error):\s*/g, "");

  text = text
    .replace(/\/[\w./-]+(?:\.py)?/g, "")
    .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > MAX_CLIENT_ERROR_LENGTH) {
    return `${text.slice(0, MAX_CLIENT_ERROR_LENGTH - 3).trimEnd()}...`;
  }

  return text;
}

export function sanitizeClientErrorMessage(message: string): string {
  return sanitizeJcStderr(message);
}
