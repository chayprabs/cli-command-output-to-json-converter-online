/** Client ↔ server parse options aligned with jc flags */

export type ParseOutputFormat = "json" | "yaml";

export type ParseOptions = {
  /** Emit YAML instead of JSON (`jc --yaml`). */
  outputFormat?: ParseOutputFormat;
  /** Prettify output (`jc -p`). */
  prettify?: boolean;
  /** Slurp multi-line / stream parsers (`jc -d`). */
  slurp?: boolean;
};

export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  outputFormat: "json",
  prettify: false,
  slurp: false,
};

export function normalizeParseOptions(
  value: unknown,
): ParseOptions | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const outputFormat =
    raw.outputFormat === "yaml"
      ? "yaml"
      : raw.outputFormat === "json"
        ? "json"
        : undefined;

  return {
    outputFormat: outputFormat ?? "json",
    prettify: raw.prettify === true,
    slurp: raw.slurp === true,
  };
}
