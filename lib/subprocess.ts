import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import {
  BUSY_RETRY_AFTER_SECONDS,
  GLOBAL_SUBPROCESS_CONCURRENCY_LIMIT,
  MAX_PARSE_OUTPUT_BYTES,
  MAX_PARSE_STDERR_BYTES,
  PARSER_RUNTIME_TIMEOUT_MS,
  RUNTIME_UNAVAILABLE_RETRY_AFTER_SECONDS,
  EXECUTION_TIMEOUT_RETRY_AFTER_SECONDS,
} from "./constants";
import { AppError } from "./errors";

export type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdoutBytes: number;
  stderrBytes: number;
};

type RunProcessOptions = {
  command: string;
  args: string[];
  input?: string;
  timeoutMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  unavailableMessage?: string;
  startupFailureMessage?: string;
  timeoutMessage?: string;
  outputLimitMessage?: string;
  interruptedMessage?: string;
};

export function joinProcessOutput(stdout: string, stderr: string) {
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

let activeSubprocesses = 0;

function acquireSubprocessSlot() {
  if (activeSubprocesses >= GLOBAL_SUBPROCESS_CONCURRENCY_LIMIT) {
    throw new AppError(
      429,
      "rate_limited",
      "Server is busy, try again shortly",
      {
        headers: {
          "Retry-After": String(BUSY_RETRY_AFTER_SECONDS),
        },
        details: {
          rateLimitTier: 2,
          requestCount: activeSubprocesses,
          retryAfterSeconds: BUSY_RETRY_AFTER_SECONDS,
        },
      },
    );
  }

  activeSubprocesses += 1;

  return () => {
    activeSubprocesses = Math.max(0, activeSubprocesses - 1);
  };
}

export async function runProcess({
  command,
  args,
  input,
  timeoutMs = PARSER_RUNTIME_TIMEOUT_MS,
  maxStdoutBytes = MAX_PARSE_OUTPUT_BYTES,
  maxStderrBytes = MAX_PARSE_STDERR_BYTES,
  unavailableMessage = "The parsing runtime is unavailable on this server. Install the required parser runtime and restart the app.",
  startupFailureMessage = "The parsing runtime could not be started on this server.",
  timeoutMessage = "Parsing timed out. Try a smaller input.",
  outputLimitMessage = "Parser output exceeded the size limit.",
  interruptedMessage = "The parsing runtime stopped before returning a complete response.",
}: RunProcessOptions): Promise<ProcessResult> {
  const releaseSubprocessSlot = acquireSubprocessSlot();

  try {
    return await new Promise<ProcessResult>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;

      try {
        child = spawn(command, args, {
          shell: false,
          stdio: "pipe",
          windowsHide: true,
          env: process.env,
        });
      } catch {
        reject(
          new AppError(503, "runtime_unavailable", startupFailureMessage, {
            headers: {
              "Retry-After": String(RUNTIME_UNAVAILABLE_RETRY_AFTER_SECONDS),
            },
          }),
        );
        return;
      }

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;
      let timedOut = false;
      let outputLimitExceeded = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let capturedStderrBytes = 0;

      function clearTimers() {
        clearTimeout(timer);
      }

      function stopChildProcess() {
        if (child.exitCode !== null || child.killed) {
          return;
        }

        try {
          child.kill("SIGKILL");
        } catch {
          // Ignore termination races if the process already exited.
        }
      }

      const timer = setTimeout(() => {
        timedOut = true;
        stopChildProcess();
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        stdoutBytes += buffer.length;

        if (stdoutBytes > maxStdoutBytes) {
          outputLimitExceeded = true;
          stopChildProcess();
          return;
        }

        stdoutChunks.push(buffer);
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        stderrBytes += buffer.length;

        if (capturedStderrBytes < maxStderrBytes) {
          const remainingBytes = maxStderrBytes - capturedStderrBytes;
          const boundedChunk = buffer.subarray(0, remainingBytes);

          stderrChunks.push(boundedChunk);
          capturedStderrBytes += boundedChunk.length;
        }
      });

      child.once("error", (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimers();

        if ("code" in error && error.code === "ENOENT") {
          reject(
            new AppError(503, "runtime_unavailable", unavailableMessage, {
              headers: {
                "Retry-After": String(RUNTIME_UNAVAILABLE_RETRY_AFTER_SECONDS),
              },
            }),
          );
          return;
        }

        reject(
          new AppError(503, "runtime_unavailable", startupFailureMessage, {
            headers: {
              "Retry-After": String(RUNTIME_UNAVAILABLE_RETRY_AFTER_SECONDS),
            },
          }),
        );
      });

      child.stdin.on("error", () => {
        // Some runtimes close stdin as soon as they have enough input.
      });

      if (typeof input === "string") {
        child.stdin.end(input);
      } else {
        child.stdin.end();
      }

      child.once("close", (exitCode, signal) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimers();

        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");

        if (timedOut) {
          reject(
            new AppError(504, "execution_timeout", timeoutMessage, {
              headers: {
                "Retry-After": String(EXECUTION_TIMEOUT_RETRY_AFTER_SECONDS),
              },
              details: {
                exitCode,
                signal,
                stdoutBytes,
                stderrBytes,
                failureType: "timeout",
                retryAfterSeconds: EXECUTION_TIMEOUT_RETRY_AFTER_SECONDS,
              },
            }),
          );
          return;
        }

        if (outputLimitExceeded) {
          reject(
            new AppError(413, "payload_too_large", outputLimitMessage, {
              details: {
                exitCode,
                signal,
                stdoutBytes,
                stderrBytes,
                failureType: "output_exceeded",
              },
            }),
          );
          return;
        }

        if (signal) {
          reject(
            new AppError(502, "parse_failed", interruptedMessage, {
              details: {
                exitCode,
                signal,
                stdoutBytes,
                stderrBytes,
                failureType: "non_zero_exit",
              },
            }),
          );
          return;
        }

        resolve({
          stdout,
          stderr,
          exitCode,
          signal,
          stdoutBytes,
          stderrBytes,
        });
      });
    });
  } finally {
    releaseSubprocessSlot();
  }
}
