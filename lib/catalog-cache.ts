import type { ParserSummary } from "./api";
import { ensureParserRuntimeReady, loadRuntimeCatalog } from "./parser-runtime";
import type { RuntimeCatalogEntry } from "./parser-runtime";

/** PRD §10: parser slug format, max 64 characters */
export const PARSER_SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

export type CatalogSnapshot = {
  available: boolean;
  parsers: readonly ParserSummary[];
  allowlist: ReadonlySet<string>;
};

let catalogPromise: Promise<CatalogSnapshot> | null = null;

function normalizeDescription(slug: string, description: string | undefined) {
  const normalized = description?.trim();

  if (normalized) {
    return normalized;
  }

  const readableSlug = slug.replace(/-/g, " ");

  if (slug.endsWith("-s")) {
    return `Streams ${readableSlug.slice(0, -2).trim()} input into structured JSON.`;
  }

  return `Transforms ${readableSlug} input into structured JSON.`;
}

function slugFromCatalogEntry(entry: RuntimeCatalogEntry): string {
  return String(entry.argument ?? "")
    .trim()
    .replace(/^--/, "")
    .replace(/_/g, "-")
    .toLowerCase();
}

function deriveParsersFromAbout(
  entries: RuntimeCatalogEntry[] | undefined,
): ParserSummary[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return Array.from(
    new Map(
      entries
        .filter((entry) => !entry.hidden && !entry.deprecated)
        .map((entry) => {
          const slug = slugFromCatalogEntry(entry);

          return {
            slug,
            description: normalizeDescription(slug, entry.description),
          };
        })
        .filter(
          (item): item is ParserSummary =>
            typeof item.slug === "string" &&
            typeof item.description === "string" &&
            PARSER_SLUG_PATTERN.test(item.slug),
        )
        .sort((left, right) => left.slug.localeCompare(right.slug))
        .map((item) => [item.slug, item] as const),
    ).values(),
  );
}

async function loadCatalogSnapshot(): Promise<CatalogSnapshot> {
  try {
    await ensureParserRuntimeReady();
    const catalogResult = await loadRuntimeCatalog();
    const parsers = deriveParsersFromAbout(catalogResult.data.parsers);

    if (parsers.length === 0) {
      return {
        available: false,
        parsers: [],
        allowlist: new Set(),
      };
    }

    return {
      available: true,
      parsers: Object.freeze(parsers.slice()),
      allowlist: new Set(parsers.map((p) => p.slug)),
    };
  } catch {
    return {
      available: false,
      parsers: [],
      allowlist: new Set(),
    };
  }
}

/**
 * Loads jc --about once per process and caches the allowlist (PRD §4.3).
 */
export function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  if (!catalogPromise) {
    catalogPromise = loadCatalogSnapshot().then((snapshot) => {
      if (!snapshot.available) {
        catalogPromise = null;
      }
      return snapshot;
    });
  }

  return catalogPromise;
}
