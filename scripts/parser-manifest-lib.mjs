import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(repoRoot, "lib", "parser-manifest.json");

function runRuntimeAbout() {
  const candidates = [
    { command: "python", args: ["-m", "jc", "--about"] },
    { command: "py", args: ["-m", "jc", "--about"] },
    { command: "jc", args: ["--about"] },
  ];

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.args, {
      cwd: repoRoot,
      encoding: "utf8",
    });

    if (result.status === 0 && result.stdout.trim()) {
      return JSON.parse(result.stdout);
    }
  }

  throw new Error("Unable to run jc --about with python, py, or jc.");
}

function normalizeDescription(slug, description) {
  const normalizedDescription = description?.trim();

  if (normalizedDescription) {
    return normalizedDescription;
  }

  const readableSlug = slug.replace(/-/g, " ");

  if (slug.endsWith("-s")) {
    return `Streams ${readableSlug.slice(0, -2).trim()} input into structured JSON.`;
  }

  return `Transforms ${readableSlug} input into structured JSON.`;
}

export function deriveManifestFromAbout(about) {
  return Array.from(
    new Map(
      (Array.isArray(about?.parsers) ? about.parsers : [])
        .filter((entry) => !entry.hidden && !entry.deprecated)
        .map((entry) => {
          const slug = String(entry.argument ?? "")
            .trim()
            .replace(/^--/, "")
            .replace(/_/g, "-")
            .toLowerCase();

          return {
            slug,
            description: normalizeDescription(slug, entry.description),
          };
        })
        .filter((entry) => /^[a-z][a-z0-9_-]{0,30}$/.test(entry.slug))
        .sort((left, right) => left.slug.localeCompare(right.slug))
        .map((entry) => [entry.slug, entry]),
    ).values(),
  );
}

export function loadInstalledManifest() {
  return deriveManifestFromAbout(runRuntimeAbout());
}

export function loadCheckedInManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
}

export function getManifestPath() {
  return manifestPath;
}
