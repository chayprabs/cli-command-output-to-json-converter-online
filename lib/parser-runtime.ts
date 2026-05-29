import { MAX_PARSER_ABOUT_BYTES } from "./constants";
import { sanitizeJcStderr } from "./error-sanitizer";
import { AppError } from "./errors";
import type { ParseOptions } from "./parse-options";
import { joinProcessOutput, runProcess } from "./subprocess";
import {
  buildFormatArgs,
  PARSER_RUNTIME_CANDIDATES,
  PARSER_RUNTIME_CATALOG_ARGS,
  PARSER_RUNTIME_VERSION_ARGS,
  type RuntimeCandidate,
} from "./runtime-config";

export type RuntimeCatalogEntry = {
  argument?: string;
  description?: string;
  hidden?: boolean;
  deprecated?: boolean;
};

export type RuntimeCatalogResponse = {
  parsers?: RuntimeCatalogEntry[];
};

export type ParserRuntimeJsonResult<T> = {
  data: T;
  jsonBytes: number;
  jsonSource: "stdout" | "stderr";
  exitCode: number | null;
  stderrBytes: number;
};

type ParsedJsonCandidate<T> = Omit<
  ParserRuntimeJsonResult<T>,
  "exitCode" | "stderrBytes"
>;

type RuntimeJsonMessages = {
  emptyOutputMessage: string;
  invalidOutputMessage: string;
};

type ResolvedRuntime = RuntimeCandidate & {
  version: string;
};

type RunRuntimeJsonOptions = {
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
};

let parserRuntimePromise: Promise<ResolvedRuntime> | null = null;

function cleanText(output: string) {
  return output.replace(/\0/g, "").trim();
}

function extractRuntimeVersion(output: string) {
  const match = output.match(/\b\d+\.\d+\.\d+\b/);
  return match?.[0] ?? null;
}

function parseJsonCandidate<T>(
  raw: string,
  source: "stdout" | "stderr",
): ParsedJsonCandidate<T> | null {
  if (!raw.trim()) {
    return null;
  }

  try {
    return {
      data: JSON.parse(raw) as T,
      jsonBytes: Buffer.byteLength(raw, "utf8"),
      jsonSource: source,
    };
  } catch {
    return null;
  }
}

export function parseRuntimeJsonOutput<T>(
  stdout: string,
  stderr: string,
  messages: RuntimeJsonMessages,
  metadata?: {
    exitCode?: number | null;
    stderrBytes?: number;
  },
) {
  const stdoutResult = parseJsonCandidate<T>(stdout, "stdout");

  if (stdoutResult) {
    return {
      ...stdoutResult,
      exitCode: metadata?.exitCode ?? 0,
      stderrBytes: metadata?.stderrBytes ?? 0,
    };
  }

  const stderrResult = parseJsonCandidate<T>(stderr, "stderr");

  if (stderrResult) {
    return {
      ...stderrResult,
      exitCode: metadata?.exitCode ?? 0,
      stderrBytes: metadata?.stderrBytes ?? 0,
    };
  }

  if (!stdout.trim() && !stderr.trim()) {
    throw new AppError(502, "parse_failed", messages.emptyOutputMessage, {
      details: {
        exitCode: metadata?.exitCode ?? null,
        stderrBytes: metadata?.stderrBytes ?? 0,
        failureType: "invalid_json",
      },
    });
  }

  throw new AppError(502, "parse_failed", messages.invalidOutputMessage, {
    details: {
      exitCode: metadata?.exitCode ?? null,
      stderrBytes: metadata?.stderrBytes ?? 0,
      failureType: "invalid_json",
    },
  });
}

async function probeRuntime(candidate: RuntimeCandidate) {
  const result = await runProcess({
    command: candidate.command,
    args: [...candidate.baseArgs, ...PARSER_RUNTIME_VERSION_ARGS],
  });

  if (result.exitCode !== 0) {
    throw new Error("Runtime probe failed.");
  }

  const versionOutput = cleanText(joinProcessOutput(result.stdout, result.stderr));
  const version = extractRuntimeVersion(versionOutput);

  if (!version) {
    throw new Error("Runtime probe returned no version.");
  }

  return {
    ...candidate,
    version,
  };
}

async function resolveParserRuntime() {
  for (const candidate of PARSER_RUNTIME_CANDIDATES) {
    try {
      return await probeRuntime(candidate);
    } catch {
      // Try the next runtime candidate.
    }
  }

  throw new AppError(
    503,
    "runtime_unavailable",
    "The parsing runtime is unavailable on this server. Install the required parser runtime and restart the app.",
  );
}

export async function ensureParserRuntimeReady() {
  if (!parserRuntimePromise) {
    parserRuntimePromise = resolveParserRuntime().catch((error) => {
      parserRuntimePromise = null;
      throw error;
    });
  }

  return parserRuntimePromise;
}

async function runRuntimeJson<T>(
  args: string[],
  input?: string,
  options?: RunRuntimeJsonOptions,
) {
  const runtime = await ensureParserRuntimeReady();
  const result = await runProcess({
    command: runtime.command,
    args: [...runtime.baseArgs, ...args],
    input,
    maxStdoutBytes: options?.maxStdoutBytes,
    maxStderrBytes: options?.maxStderrBytes,
  });

  if (result.exitCode !== 0) {
    const sanitizedStderr = sanitizeJcStderr(result.stderr);
    const parseMessage =
      sanitizedStderr.length > 0
        ? sanitizedStderr
        : "Could not parse the input for this format.";

    throw new AppError(422, "parse_failed", parseMessage, {
      details: {
        exitCode: result.exitCode,
        stderrBytes: result.stderrBytes,
        failureType: "non_zero_exit",
      },
    });
  }

  return parseRuntimeJsonOutput<T>(result.stdout, result.stderr, {
    emptyOutputMessage: "The parsing runtime returned an empty response for this format.",
    invalidOutputMessage:
      "The parsing runtime returned unreadable JSON for this format.",
  }, {
    exitCode: result.exitCode,
    stderrBytes: result.stderrBytes,
  });
}

export async function loadRuntimeCatalog() {
  return runRuntimeJson<RuntimeCatalogResponse>(
    PARSER_RUNTIME_CATALOG_ARGS,
    undefined,
    {
      maxStdoutBytes: MAX_PARSER_ABOUT_BYTES,
    },
  );
}

export async function getParserRuntimeVersion() {
  const runtime = await ensureParserRuntimeReady();
  return runtime.version;
}

export async function parseWithFormat<T>(
  jcArgument: string,
  input?: string,
  options?: ParseOptions,
) {
  if (options?.outputFormat === "yaml") {
    const runtime = await ensureParserRuntimeReady();
    const result = await runProcess({
      command: runtime.command,
      args: [...runtime.baseArgs, ...buildFormatArgs(jcArgument, options)],
      input,
    });

    if (result.exitCode !== 0) {
      const sanitizedStderr = sanitizeJcStderr(result.stderr);
      throw new AppError(
        422,
        "parse_failed",
        sanitizedStderr.length > 0
          ? sanitizedStderr
          : "Could not parse the input for this format.",
        {
          details: {
            exitCode: result.exitCode,
            stderrBytes: result.stderrBytes,
            failureType: "non_zero_exit",
          },
        },
      );
    }

    const yamlText = cleanText(joinProcessOutput(result.stdout, result.stderr));

    if (!yamlText) {
      throw new AppError(
        502,
        "parse_failed",
        "The parsing runtime returned an empty response for this format.",
        {
          details: {
            exitCode: result.exitCode,
            stderrBytes: result.stderrBytes,
            failureType: "invalid_json",
          },
        },
      );
    }

    return {
      data: yamlText as T,
      jsonBytes: Buffer.byteLength(yamlText, "utf8"),
      jsonSource: "stdout" as const,
      exitCode: result.exitCode,
      stderrBytes: result.stderrBytes,
    };
  }

  return runRuntimeJson<T>(buildFormatArgs(jcArgument, options), input);
}
