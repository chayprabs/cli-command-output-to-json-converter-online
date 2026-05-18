import type { ParserSummary } from "./api";
import { AppError } from "./errors";
import {
  getCatalogSnapshot,
  PARSER_SLUG_PATTERN,
} from "./catalog-cache";

export { PARSER_SLUG_PATTERN };

export async function getAvailableParsers(): Promise<ParserSummary[]> {
  const snapshot = await getCatalogSnapshot();

  if (!snapshot.available) {
    throw new AppError(
      503,
      "runtime_unavailable",
      "Parser runtime is not available.",
    );
  }

  return [...snapshot.parsers];
}

export async function hasParserSlug(slug: string): Promise<boolean> {
  const snapshot = await getCatalogSnapshot();
  return snapshot.available && snapshot.allowlist.has(slug);
}

export async function findParser(slug: string): Promise<ParserSummary | null> {
  const snapshot = await getCatalogSnapshot();

  if (!snapshot.available) {
    return null;
  }

  return snapshot.parsers.find((entry) => entry.slug === slug) ?? null;
}
