import type { ParserSummary } from "./api";
import { ensureParserRuntimeReady, loadRuntimeCatalog } from "./parser-runtime";
import type { RuntimeCatalogEntry } from "./parser-runtime";

/** PRD §10: parser slug format, max 64 characters */
export const PARSER_SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

export type CatalogSnapshot = {
  available: boolean;
  parsers: readonly ParserSummary[];
  allowlist: ReadonlySet<string>;
  jcArgumentBySlug: ReadonlyMap<string, string>;
};

let catalogPromise: Promise<CatalogSnapshot> | null = null;

function extractCommandHint(description: string | undefined) {
  const normalized = description?.trim();
  if (!normalized) {
    return undefined;
  }
  const match = normalized.match(/`([^`]+)`/);
  return match?.[1];
}

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

function jcArgumentFromCatalogEntry(entry: RuntimeCatalogEntry) {
  return String(entry.argument ?? "")
    .trim()
    .replace(/^--/, "");
}

function slugFromCatalogEntry(entry: RuntimeCatalogEntry) {
  return jcArgumentFromCatalogEntry(entry).replace(/_/g, "-").toLowerCase();
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
          const jcArgument = jcArgumentFromCatalogEntry(entry);
          const slug = slugFromCatalogEntry(entry);
          return {
            slug,
            jcArgument,
            description: normalizeDescription(slug, entry.description),
            commandHint: extractCommandHint(entry.description),
          };
        })
        .filter(
          (item) =>
            typeof item.slug === "string" &&
            typeof item.jcArgument === "string" &&
            item.jcArgument.length > 0 &&
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
        jcArgumentBySlug: new Map(),
      };
    }

    return {
      available: true,
      parsers: Object.freeze(parsers.slice()),
      allowlist: new Set(parsers.map((p) => p.slug)),
      jcArgumentBySlug: new Map(
        parsers.map((p) => [p.slug, p.jcArgument] as const),
      ),
    };
  } catch {
    return {
      available: false,
      parsers: [],
      allowlist: new Set(),
      jcArgumentBySlug: new Map(),
    };
  }
}

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

export function resolveJcArgument(
  catalog: CatalogSnapshot,
  slug: string,
): string | null {
  return catalog.jcArgumentBySlug.get(slug) ?? null;
}
