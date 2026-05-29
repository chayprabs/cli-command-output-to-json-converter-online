import type { ParseOptions } from "./parse-options";

export type RuntimeCandidate = {
  command: string;
  baseArgs: string[];
};

export const PARSER_RUNTIME_MODULE = "jc";

export const PARSER_RUNTIME_CANDIDATES: RuntimeCandidate[] = [
  {
    command: PARSER_RUNTIME_MODULE,
    baseArgs: [],
  },
  {
    command: "python",
    baseArgs: ["-m", PARSER_RUNTIME_MODULE],
  },
  {
    command: "py",
    baseArgs: ["-m", PARSER_RUNTIME_MODULE],
  },
];

export const PARSER_RUNTIME_VERSION_ARGS = ["--version"];
export const PARSER_RUNTIME_CATALOG_ARGS = ["--about"];

export function buildFormatArgs(jcArgument: string, options?: ParseOptions) {
  const args: string[] = [`--${jcArgument}`];

  if (options?.slurp) {
    args.push("-d");
  }

  if (options?.prettify) {
    args.push("-p");
  }

  if (options?.outputFormat === "yaml") {
    args.push("--yaml");
  }

  return args;
}
