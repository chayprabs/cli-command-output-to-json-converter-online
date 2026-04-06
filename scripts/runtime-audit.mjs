import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const buildDir = path.join(repoRoot, ".tmp-runtime-audit");
const typescriptCli = require.resolve("typescript/bin/tsc");

function compileRuntimeModules() {
  if (existsSync(buildDir)) {
    rmSync(buildDir, { recursive: true, force: true });
  }

  mkdirSync(buildDir, { recursive: true });

  execFileSync(
    process.execPath,
    [
      typescriptCli,
      "lib/api.ts",
      "lib/constants.ts",
      "lib/errors.ts",
      "lib/parser-runtime.ts",
      "lib/runtime-config.ts",
      "lib/subprocess.ts",
      "--module",
      "commonjs",
      "--target",
      "ES2022",
      "--esModuleInterop",
      "--outDir",
      buildDir,
      "--moduleResolution",
      "node",
      "--skipLibCheck",
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
    },
  );
}

function loadRuntimeModules() {
  const subprocess = require(path.join(buildDir, "subprocess.js"));
  const parserRuntime = require(path.join(buildDir, "parser-runtime.js"));
  return { ...subprocess, ...parserRuntime };
}

function summarizeError(error) {
  if (!error || typeof error !== "object") {
    return String(error);
  }

  return {
    code: error.code,
    status: error.status,
    message: error.message,
  };
}

async function main() {
  compileRuntimeModules();
  const { runProcess, parseRuntimeJsonOutput } = loadRuntimeModules();
  const results = [];

  async function runTest(id, expected, runner) {
    try {
      await runner();
      results.push({ id, expected, status: "PASS" });
    } catch (error) {
      results.push({
        id,
        expected,
        status: "FAIL",
        actual: summarizeError(error),
      });
    }
  }

  await runTest(
    "R1",
    "Missing runtime command surfaces runtime_unavailable without crashing.",
    async () => {
      await assert.rejects(
        () =>
          runProcess({
            command: "__definitely_missing_runtime__",
            args: [],
            unavailableMessage: "runtime missing",
          }),
        (error) =>
          error?.code === "runtime_unavailable" &&
          error?.message === "runtime missing",
      );
    },
  );

  await runTest(
    "R2",
    "Long-running subprocess is terminated and reported as execution_timeout.",
    async () => {
      await assert.rejects(
        () =>
          runProcess({
            command: process.execPath,
            args: ["-e", "setTimeout(() => {}, 2_000);"],
            timeoutMs: 100,
            timeoutMessage: "timed out cleanly",
          }),
        (error) =>
          error?.code === "execution_timeout" &&
          error?.message === "timed out cleanly",
      );
    },
  );

  await runTest(
    "R3",
    "Oversized stdout is terminated and reported as payload_too_large.",
    async () => {
      await assert.rejects(
        () =>
          runProcess({
            command: process.execPath,
            args: ["-e", "process.stdout.write('x'.repeat(20_000));"],
            maxStdoutBytes: 256,
            outputLimitMessage: "output capped",
          }),
        (error) =>
          error?.code === "payload_too_large" &&
          error?.message === "output capped",
      );
    },
  );

  await runTest(
    "R4",
    "Valid JSON emitted on stderr is accepted when stdout is empty.",
    async () => {
      const parsed = parseRuntimeJsonOutput(
        "",
        JSON.stringify([{ filename: "stderr.json" }]),
        {
          emptyOutputMessage: "empty",
          invalidOutputMessage: "invalid",
        },
      );

      assert.equal(parsed.jsonSource, "stderr");
      assert.deepEqual(parsed.data, [{ filename: "stderr.json" }]);
      assert.ok(parsed.jsonBytes > 0);
    },
  );

  await runTest(
    "R5",
    "Empty successful output becomes a clean parse_failed error.",
    async () => {
      assert.throws(
        () =>
          parseRuntimeJsonOutput("", "", {
            emptyOutputMessage: "empty output",
            invalidOutputMessage: "invalid output",
          }),
        (error) =>
          error?.code === "parse_failed" &&
          error?.message === "empty output",
      );
    },
  );

  await runTest(
    "R6",
    "Unreadable successful output becomes a clean parse_failed error.",
    async () => {
      assert.throws(
        () =>
          parseRuntimeJsonOutput("{oops", "not-json", {
            emptyOutputMessage: "empty output",
            invalidOutputMessage: "invalid output",
          }),
        (error) =>
          error?.code === "parse_failed" &&
          error?.message === "invalid output",
      );
    },
  );

  const passed = results.filter((result) => result.status === "PASS").length;
  const summary = {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  rmSync(buildDir, { recursive: true, force: true });
}
