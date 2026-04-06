import { loadCheckedInManifest, loadInstalledManifest } from "./parser-manifest-lib.mjs";

const checkedInManifest = loadCheckedInManifest();
const installedManifest = loadInstalledManifest();

if (JSON.stringify(checkedInManifest) !== JSON.stringify(installedManifest)) {
  console.error("parser-manifest mismatch: checked-in whitelist does not match jc --about");
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      event: "parser_manifest_verified",
      parserCount: checkedInManifest.length,
    }),
  );
}
