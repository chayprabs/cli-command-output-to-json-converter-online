import { writeFileSync } from "node:fs";
import {
  getManifestPath,
  loadInstalledManifest,
} from "./parser-manifest-lib.mjs";

const manifest = loadInstalledManifest();
writeFileSync(
  getManifestPath(),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    event: "parser_manifest_synced",
    parserCount: manifest.length,
  }),
);
