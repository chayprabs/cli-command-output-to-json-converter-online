import type { ParserSummary } from "./api";
import parserManifest from "./parser-manifest.json";

export const PARSER_SLUG_PATTERN = /^[a-z][a-z0-9_-]{0,30}$/;

const parserSummaries = Object.freeze(
  Array.from(
    new Map(
      parserManifest
        .filter(
          (entry): entry is ParserSummary =>
            typeof entry?.slug === "string" &&
            typeof entry?.description === "string" &&
            PARSER_SLUG_PATTERN.test(entry.slug),
        )
        .sort((left, right) => left.slug.localeCompare(right.slug))
        .map((entry) => [entry.slug, entry]),
    ).values(),
  ),
);

const parserIndex = new Map(
  parserSummaries.map((entry) => [entry.slug, entry] as const),
);

export async function getAvailableParsers() {
  return parserSummaries.slice();
}

export function hasParserSlug(slug: string) {
  return parserIndex.has(slug);
}

export async function findParser(slug: string) {
  return parserIndex.get(slug) ?? null;
}
