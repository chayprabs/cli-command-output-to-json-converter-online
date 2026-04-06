import {
  MAX_PARSER_ABOUT_BYTES,
  PARSER_RUNTIME_EXPECTED_VERSION,
} from "./constants";
import { AppError } from "./errors";
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

  if (version !== PARSER_RUNTIME_EXPECTED_VERSION) {
    throw new AppError(
      503,
      "runtime_unavailable",
      `The parsing runtime version must be ${PARSER_RUNTIME_EXPECTED_VERSION}.`,
    );
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
    throw new AppError(422, "parse_failed", "The parser could not read the provided input.", {
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

export async function parseWithFormat<T>(slug: string, input?: string) {
  return runRuntimeJson<T>(buildFormatArgs(slug), input);
}
