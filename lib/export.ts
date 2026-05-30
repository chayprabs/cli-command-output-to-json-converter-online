const CSV_BOM = "\uFEFF";
const CSV_LINE_ENDING = "\r\n";
const WINDOWS_FILENAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]+/g;

type CsvRow = Record<string, unknown>;
type OutputShape =
  | "flat-array"
  | "nested-array"
  | "object"
  | "primitive-array"
  | "other";

function isPlainObject(value: unknown): value is CsvRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrimitiveValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function sanitizeParserName(parser: string) {
  const sanitized = parser
    .trim()
    .replace(WINDOWS_FILENAME_PATTERN, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return sanitized || "parser";
}

function escapeCsvCell(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
}

function formatCsvCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return escapeCsvCell(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    const serialized = JSON.stringify(value);
    return serialized ? escapeCsvCell(serialized) : "";
  }

  return escapeCsvCell(String(value));
}

function getCsvRows(data: unknown[]): CsvRow[] | null {
  const shape = detectOutputShape(data);

  if (shape !== "flat-array" && shape !== "nested-array") {
    return null;
  }

  return data as CsvRow[];
}

function getCsvHeaders(rows: CsvRow[]) {
  const headers = Object.keys(rows[0] ?? {});
  return headers.length > 0 ? headers : null;
}

function buildCsvHeaderRow(headers: string[]) {
  return headers.map((header) => escapeCsvCell(header)).join(",");
}

function buildCsvDataRow(headers: string[], row: CsvRow) {
  return headers
    .map((header) => formatCsvCellValue(row[header]))
    .join(",");
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function yieldToBrowser() {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

export function generateFilename(
  parser: string,
  extension: "json" | "csv" | "yaml",
) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  return `${sanitizeParserName(parser)}-output-${timestamp}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof URL === "undefined"
  ) {
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  let shouldDelayRevoke = false;

  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
  } catch (downloadError) {
    const fallbackWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");

    if (!fallbackWindow) {
      URL.revokeObjectURL(objectUrl);
      throw downloadError;
    }

    shouldDelayRevoke = true;
  }

  window.setTimeout(
    () => {
      URL.revokeObjectURL(objectUrl);
    },
    shouldDelayRevoke ? 60_000 : 0,
  );
}

export function detectOutputShape(data: unknown): OutputShape {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return "other";
    }

    if (data.every((entry) => isPrimitiveValue(entry))) {
      return "primitive-array";
    }

    if (!data.every((entry) => isPlainObject(entry))) {
      return "other";
    }

    const rows = data as CsvRow[];

    if (!rows.some((row) => Object.keys(row).length > 0)) {
      return "other";
    }

    let hasNestedValues = false;

    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (isPrimitiveValue(value)) {
          continue;
        }

        if (Array.isArray(value) || isPlainObject(value)) {
          hasNestedValues = true;
          continue;
        }

        return "other";
      }
    }

    return hasNestedValues ? "nested-array" : "flat-array";
  }

  if (isPlainObject(data)) {
    return "object";
  }

  return "other";
}

export function generateCSV(data: unknown[]): string | null {
  const rows = getCsvRows(data);

  if (!rows || rows.length === 0) {
    return null;
  }

  const headers = getCsvHeaders(rows);

  if (!headers) {
    return null;
  }

  const lines = [buildCsvHeaderRow(headers)];

  for (const row of rows) {
    lines.push(buildCsvDataRow(headers, row));
  }

  return `${CSV_BOM}${lines.join(CSV_LINE_ENDING)}`;
}

export async function generateCSVAsync(data: unknown[]): Promise<string | null> {
  const rows = getCsvRows(data);

  if (!rows || rows.length === 0) {
    return null;
  }

  const headers = getCsvHeaders(rows);

  if (!headers) {
    return null;
  }

  const lines = [buildCsvHeaderRow(headers)];
  let lastYieldAt = nowMs();

  for (const row of rows) {
    lines.push(buildCsvDataRow(headers, row));

    if (nowMs() - lastYieldAt >= 12) {
      await yieldToBrowser();
      lastYieldAt = nowMs();
    }
  }

  return `${CSV_BOM}${lines.join(CSV_LINE_ENDING)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
