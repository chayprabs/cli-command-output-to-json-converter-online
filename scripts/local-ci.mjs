import { spawn } from "node:child_process";
import path from "node:path";

const port = process.env.PORT ?? "3312";
const baseUrl = `http://127.0.0.1:${port}`;
const npmCli =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);

      if (response.status === 200) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Local CI server did not become healthy in time.");
}

await runCommand(process.execPath, [npmCli, "run", "check:parser-manifest"]);
await runCommand(process.execPath, [npmCli, "run", "typecheck"]);
await runCommand(process.execPath, [npmCli, "run", "lint"]);
await runCommand(process.execPath, [npmCli, "run", "build"]);

const server = spawn("node", ["server.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
  },
});

try {
  await waitForHealth();
  await runCommand("node", ["tests/integration.mjs"], {
    env: {
      ...process.env,
      BASE_URL: baseUrl,
    },
  });
  await runCommand(process.execPath, [npmCli, "run", "test:e2e"], {
    env: {
      ...process.env,
      BASE_URL: baseUrl,
    },
  });
} finally {
  server.kill("SIGTERM");
}
