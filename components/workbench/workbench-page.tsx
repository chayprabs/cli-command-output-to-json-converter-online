"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ApiErrorCode,
  ParseMeta,
  ParseRequestBody,
  ParserSummary,
} from "@/lib/api";
import {
  fetchJsonWithTimeout,
  formatBytes,
  formatResultForDisplay,
  isAbortError,
  isApiErrorResponse,
  isParseSuccessResponse,
  isParserSummaryList,
  readUtf8ByteLength,
  safeReadStorage,
  safeWriteStorage,
  TimeoutError,
  type ResultView,
} from "@/lib/client";
import {
  CLIENT_REQUEST_TIMEOUT_MS,
  MAX_PARSE_INPUT_CHARS,
  MAX_VISIBLE_PARSER_RESULTS,
  PARSER_STORAGE_KEY,
} from "@/lib/constants";
import {
  copyToClipboard,
  detectOutputShape,
  downloadBlob,
  generateCSV,
  generateCSVAsync,
  generateFilename,
} from "@/lib/export";
import { getParserExample } from "@/lib/examples";
import {
  compressToBase64,
  decodeAppState,
  encodeAppState,
  isValidParserSlug,
} from "@/lib/url-state";
import { ParserSelector } from "./parser-selector";
import {
  type EmptyStateView,
  ResultPanel,
  type ResultCopyState,
  type ResultDownloadState,
  type ResultErrorView,
  type ShareCopyState,
} from "./result-panel";
import { WorkbenchHeader } from "./workbench-header";
import { cx } from "./workbench-styles";

const GITHUB_URL: string | null = null;
const LARGE_CSV_ROW_THRESHOLD = 2_000;
const TRANSIENT_ACTION_TIMEOUT_MS = 1_000;

type PendingSharedState = {
  parser: string;
  input: string;
};

type ClipboardFallbackView = {
  title: string;
  text: string;
};

class ResultPanelError extends Error {
  constructor(public readonly view: ResultErrorView) {
    super(view.title);
    this.name = "ResultPanelError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function filterParsers(parsers: ParserSummary[], query: string) {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return parsers;
  }

  return parsers.filter((entry) => {
    const haystack = `${entry.slug} ${entry.description}`.toLowerCase();
    return haystack.includes(needle);
  });
}

function buildShellCommand(parser: string) {
  return parser
    ? `cat output.txt | jc --${parser}`
    : "Choose a parser to preview the jc command";
}

function buildAppUrl(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function looksLikeBase64(value: string) {
  return value.length >= 4 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(value);
}

function isLikelyCliText(value: string) {
  if (!value) {
    return false;
  }

  const sample = value.slice(0, 240);
  let printableCount = 0;

  for (const character of sample) {
    const code = character.charCodeAt(0);

    if (
      character === "\n" ||
      character === "\r" ||
      character === "\t" ||
      (code >= 32 && code <= 126)
    ) {
      printableCount += 1;
    }
  }

  return printableCount / sample.length >= 0.85 && /[\s:/\\.=_-]/.test(sample);
}

function decodeLegacyInputParam(inputParam: string) {
  if (isLikelyCliText(inputParam) && !looksLikeBase64(inputParam)) {
    return inputParam;
  }

  if (!looksLikeBase64(inputParam)) {
    return null;
  }

  try {
    const binary = atob(inputParam);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const decodedText = new TextDecoder().decode(bytes);
    return isLikelyCliText(decodedText) ? decodedText : null;
  } catch {
    return null;
  }
}

function createEmptyState(options: {
  selectedParser: ParserSummary | null;
  hasInput: boolean;
}): EmptyStateView {
  const { selectedParser, hasInput } = options;

  if (!selectedParser) {
    return {
      label: "Awaiting parser",
      title: "Choose a parser to start",
      message:
        "Search the catalog on the left to load a live example and preview the exact jc command for that format.",
      hint: "No parser is selected yet.",
    };
  }

  if (!hasInput) {
    return {
      label: "Awaiting input",
      title: `Paste ${selectedParser.slug} output to inspect JSON`,
      message:
        "The editor is ready with a realistic placeholder for the selected parser, so you can paste the raw command output or compare against the sample.",
      hint: "Run the command in your shell, paste the raw output, then submit.",
    };
  }

  return {
    label: "Ready to parse",
    title: "The output panel is primed",
    message:
      "The current sample is ready to run through the selected parser. Submit it to generate formatted JSON with syntax colors and copy support.",
    hint: "Use Ctrl/Cmd+Enter to parse without leaving the editor.",
  };
}

function createParseErrorView(options: {
  code?: ApiErrorCode | "timeout" | "network" | "unexpected";
  parser: string;
}): ResultErrorView {
  const parserLabel = options.parser || "selected parser";

  switch (options.code) {
    case "bad_request":
      return {
        label: "Input needs attention",
        title: "The sample is incomplete",
        message:
          "Choose a parser and provide raw terminal output before sending the request.",
        hint: "Select the matching parser, paste the full command output, and try again.",
      };
    case "payload_too_large":
      return {
        label: "Workspace limit",
        title: "This sample is too large to parse here",
        message: `ParseDeck accepts up to ${MAX_PARSE_INPUT_CHARS.toLocaleString(
          "en-US",
        )} characters of terminal output per request.`,
        hint: "Trim the sample down to the lines you need most and rerun the parse.",
      };
    case "unknown_parser":
      return {
        label: "Parser unavailable",
        title: "That parser is not available on this server",
        message:
          "The current catalog no longer includes the selected parser or the runtime changed underneath the app.",
        hint: "Refresh the parser catalog or choose a different parser and submit again.",
      };
    case "runtime_unavailable":
      return {
        label: "Runtime unavailable",
        title: "The parsing runtime is not ready",
        message:
          "The server cannot reach the jc runtime right now, so it cannot transform the pasted output.",
        hint: "Verify the runtime installation on the server, then retry the parse.",
      };
    case "execution_timeout":
    case "timeout":
      return {
        label: "Request timed out",
        title: "Parsing took too long",
        message:
          "The parser did not return in time for this sample, which usually means the sample is too large or does not match the selected parser cleanly.",
        hint: "Try a shorter sample, confirm the parser selection, and submit once more.",
      };
    case "invalid_json":
    case "parse_failed":
      return {
        label: "Parse failed",
        title: `Couldn't parse this ${parserLabel} sample`,
        message:
          "The pasted text does not look like valid output for the selected parser, so ParseDeck could not produce a structured result.",
        hint: "Paste the raw command output without edits and double-check that the parser matches the command you ran.",
      };
    case "network":
      return {
        label: "Connection issue",
        title: "The parser service could not be reached",
        message:
          "The browser could not complete the request to the local parse endpoint.",
        hint: "Make sure the app is still running, then retry the request.",
      };
    default:
      return {
        label: "Request failed",
        title: "ParseDeck couldn't build a result",
        message:
          "Something interrupted the parse before a usable JSON response came back.",
        hint: "Retry the parse with a fresh sample or switch to another parser to isolate the issue.",
      };
  }
}

export function WorkbenchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [parsers, setParsers] = useState<ParserSummary[]>([]);
  const [parsersLoading, setParsersLoading] = useState(true);
  const [parsersError, setParsersError] = useState("");
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [parser, setParser] = useState("");
  const [input, setInput] = useState("");
  const [formError, setFormError] = useState("");
  const [resultData, setResultData] = useState<unknown>(null);
  const [resultView, setResultView] = useState<ResultView | null>(null);
  const [resultMeta, setResultMeta] = useState<ParseMeta | null>(null);
  const [resultError, setResultError] = useState<ResultErrorView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<ResultCopyState>("idle");
  const [jsonDownloadState, setJsonDownloadState] =
    useState<ResultDownloadState>("idle");
  const [csvDownloadState, setCsvDownloadState] =
    useState<ResultDownloadState>("idle");
  const [shareState, setShareState] = useState<ShareCopyState>("idle");
  const [manualShareUrl, setManualShareUrl] = useState("");
  const [clipboardFallback, setClipboardFallback] =
    useState<ClipboardFallbackView | null>(null);
  const [isResultFlashing, setIsResultFlashing] = useState(false);
  const [renderSequence, setRenderSequence] = useState(0);
  const [isRenderingResult, startResultTransition] = useTransition();
  const [pendingSharedState, setPendingSharedState] =
    useState<PendingSharedState | null>(null);
  const [hasSharedQuery, setHasSharedQuery] = useState(false);
  const [isResolvingSharedState, setIsResolvingSharedState] = useState(false);
  const [isSharedViewVisible, setIsSharedViewVisible] = useState(false);
  const [sharedParserMessage, setSharedParserMessage] = useState("");
  const [sharedInputWarning, setSharedInputWarning] = useState("");

  const parseAbortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const jsonDownloadTimerRef = useRef<number | null>(null);
  const csvDownloadTimerRef = useRef<number | null>(null);
  const shareTimerRef = useRef<number | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);
  const clipboardFallbackRef = useRef<HTMLTextAreaElement | null>(null);
  const initialUrlProcessedRef = useRef(false);

  const deferredPaletteQuery = useDeferredValue(paletteQuery);
  const filteredParsers = filterParsers(parsers, deferredPaletteQuery);
  const visibleParsers = filteredParsers.slice(0, MAX_VISIBLE_PARSER_RESULTS);

  useEffect(() => {
    if (initialUrlProcessedRef.current) {
      return;
    }

    initialUrlProcessedRef.current = true;

    const parserParam = searchParams.get("parser");
    const inputParam = searchParams.get("input");

    if (!parserParam && !inputParam) {
      return;
    }

    let cancelled = false;
    setHasSharedQuery(true);
    setIsResolvingSharedState(true);

    async function resolveSharedState() {
      const decodedState = await decodeAppState(
        new URLSearchParams(searchParams.toString()),
      );

      if (cancelled) {
        return;
      }

      if (decodedState) {
        setPendingSharedState(decodedState);
        setIsResolvingSharedState(false);
        return;
      }

      const legacyInput =
        parserParam && inputParam && isValidParserSlug(parserParam)
          ? decodeLegacyInputParam(inputParam)
          : null;

      if (legacyInput && parserParam) {
        setPendingSharedState({
          parser: parserParam,
          input: legacyInput,
        });
      } else {
        router.replace("/");
      }

      setIsResolvingSharedState(false);
    }

    void resolveSharedState();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadParsers() {
      setParsersLoading(true);
      setParsersError("");

      try {
        const { response, body } = await fetchJsonWithTimeout(
          "/api/parsers",
          {
            signal: controller.signal,
          },
          CLIENT_REQUEST_TIMEOUT_MS,
        );

        if (!response.ok || isApiErrorResponse(body) || !isParserSummaryList(body)) {
          throw new Error("Unable to load parser catalog.");
        }

        if (body.length === 0) {
          throw new Error("No parsers are available.");
        }

        setParsers(body);

        const savedParser = safeReadStorage(PARSER_STORAGE_KEY) ?? "";
        setParser((currentParser) => {
          if (
            currentParser &&
            body.some((entry) => entry.slug === currentParser)
          ) {
            return currentParser;
          }

          if (savedParser && body.some((entry) => entry.slug === savedParser)) {
            return savedParser;
          }

          return "";
        });
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        if (loadError instanceof TimeoutError) {
          setParsersError("Loading the parser catalog timed out. Try again.");
          return;
        }

        setParsersError(
          "Unable to load the parser catalog. Retry to refresh the available formats.",
        );
      } finally {
        setParsersLoading(false);
      }
    }

    void loadParsers();

    return () => {
      controller.abort();
    };
  }, [catalogVersion]);

  useEffect(() => {
    if (!pendingSharedState || parsersLoading || parsersError) {
      return;
    }

    const nextInput = pendingSharedState.input.slice(0, MAX_PARSE_INPUT_CHARS);
    const inputWasTruncated = pendingSharedState.input.length > MAX_PARSE_INPUT_CHARS;
    const parserExists = parsers.some(
      (entry) => entry.slug === pendingSharedState.parser,
    );

    setPendingSharedState(null);
    setParser(parserExists ? pendingSharedState.parser : "");
    setInput(nextInput);
    setFormError("");
    clearResultState();
    closePalette();
    setIsSharedViewVisible(true);
    setSharedParserMessage(
      parserExists ? "" : "The parser in this link is not available",
    );
    setSharedInputWarning(
      inputWasTruncated
        ? `Shared input exceeded ${MAX_PARSE_INPUT_CHARS.toLocaleString(
            "en-US",
          )} characters and was truncated to fit this workspace.`
        : "",
    );

    if (!parserExists) {
      void replaceUrlWithInputOnly(nextInput);
      return;
    }

    if (!nextInput.trim()) {
      return;
    }

    void submitParse({
      parser: pendingSharedState.parser,
      input: nextInput,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clearResultState,
    parsers,
    parsersError,
    parsersLoading,
    pendingSharedState,
    replaceUrlWithInputOnly,
    submitParse,
  ]);

  useEffect(() => {
    if (!parser) {
      return;
    }

    safeWriteStorage(PARSER_STORAGE_KEY, parser);
  }, [parser]);

  useEffect(() => {
    if (!isResultFlashing) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsResultFlashing(false);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isResultFlashing]);

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      paletteInputRef.current?.focus();
      paletteInputRef.current?.select();
    }, 20);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPaletteOpen]);

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!paletteRef.current?.contains(event.target as Node)) {
        setIsPaletteOpen(false);
        setPaletteQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isPaletteOpen]);

  useEffect(() => {
    if (highlightedIndex < visibleParsers.length) {
      return;
    }

    setHighlightedIndex(0);
  }, [highlightedIndex, visibleParsers.length]);

  useEffect(() => {
    if (!clipboardFallback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clipboardFallbackRef.current?.focus();
      clipboardFallbackRef.current?.select();
    }, 20);

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setClipboardFallback(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [clipboardFallback]);

  useEffect(() => {
    return () => {
      parseAbortRef.current?.abort();

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      if (jsonDownloadTimerRef.current) {
        window.clearTimeout(jsonDownloadTimerRef.current);
      }

      if (csvDownloadTimerRef.current) {
        window.clearTimeout(csvDownloadTimerRef.current);
      }

      if (shareTimerRef.current) {
        window.clearTimeout(shareTimerRef.current);
      }
    };
  }, []);

  const selectedParser =
    parsers.find((entry) => entry.slug === parser) ?? null;
  const inputBytes = readUtf8ByteLength(input);
  const inputCharacters = input.length;
  const inputTooLarge = inputCharacters > MAX_PARSE_INPUT_CHARS;
  const hasInput = Boolean(input.trim());
  const isBusy = isSubmitting || isRenderingResult;
  const isSharedStateLoading =
    hasSharedQuery &&
    (isResolvingSharedState || Boolean(pendingSharedState && parsersLoading));
  const canSubmit =
    !isBusy &&
    !parsersLoading &&
    !parsersError &&
    Boolean(parser.trim()) &&
    hasInput &&
    !inputTooLarge;
  const placeholder = getParserExample(parser);
  const commandPreview = buildShellCommand(parser);
  const emptyState = createEmptyState({
    selectedParser,
    hasInput,
  });
  const outputShape = resultView ? detectOutputShape(resultData) : "other";
  const showCsvDownload =
    outputShape === "flat-array" || outputShape === "nested-array";
  const csvWarning =
    outputShape === "nested-array"
      ? "Nested values will be flattened to strings"
      : null;

  const helperMessage = formError
    ? formError
    : inputTooLarge
      ? `This sample is ${inputCharacters.toLocaleString(
          "en-US",
        )} characters. Requests are limited to ${MAX_PARSE_INPUT_CHARS.toLocaleString(
          "en-US",
        )} characters. Trim the sample before parsing.`
      : selectedParser
        ? `Placeholder text mirrors ${selectedParser.slug}. Workspace limit: ${MAX_PARSE_INPUT_CHARS.toLocaleString(
            "en-US",
          )} characters.`
        : `Choose a parser to load a realistic example. Workspace limit: ${MAX_PARSE_INPUT_CHARS.toLocaleString(
            "en-US",
          )} characters.`;

  const helperTone = formError ? "error" : inputTooLarge ? "warning" : "info";

  function clearActionTimer(
    timerRef:
      | typeof copyTimerRef
      | typeof jsonDownloadTimerRef
      | typeof csvDownloadTimerRef
      | typeof shareTimerRef,
  ) {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function setCopyStateTemporarily(nextState: ResultCopyState) {
    clearActionTimer(copyTimerRef);
    setCopyState(nextState);

    if (nextState === "idle") {
      return;
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
    }, TRANSIENT_ACTION_TIMEOUT_MS);
  }

  function setJsonDownloadStateTemporarily(nextState: ResultDownloadState) {
    clearActionTimer(jsonDownloadTimerRef);
    setJsonDownloadState(nextState);

    if (nextState === "idle" || nextState === "loading") {
      return;
    }

    jsonDownloadTimerRef.current = window.setTimeout(() => {
      setJsonDownloadState("idle");
    }, TRANSIENT_ACTION_TIMEOUT_MS);
  }

  function setCsvDownloadStateTemporarily(nextState: ResultDownloadState) {
    clearActionTimer(csvDownloadTimerRef);
    setCsvDownloadState(nextState);

    if (nextState === "idle" || nextState === "loading") {
      return;
    }

    csvDownloadTimerRef.current = window.setTimeout(() => {
      setCsvDownloadState("idle");
    }, TRANSIENT_ACTION_TIMEOUT_MS);
  }

  function setShareStateTemporarily(nextState: ShareCopyState, nextUrl = "") {
    clearActionTimer(shareTimerRef);
    setShareState(nextState);
    setManualShareUrl(nextState === "manual" ? nextUrl : "");

    if (nextState !== "copied") {
      return;
    }

    shareTimerRef.current = window.setTimeout(() => {
      setShareState("idle");
      setManualShareUrl("");
    }, TRANSIENT_ACTION_TIMEOUT_MS);
  }

  function resetExportStates() {
    setCopyStateTemporarily("idle");
    setJsonDownloadStateTemporarily("idle");
    setCsvDownloadStateTemporarily("idle");
  }

  function closeClipboardFallback() {
    setClipboardFallback(null);
  }

  function openClipboardFallback(text: string, title: string) {
    setClipboardFallback({ text, title });
  }

  function selectClipboardFallbackText() {
    clipboardFallbackRef.current?.focus();
    clipboardFallbackRef.current?.select();
  }

  function closePalette() {
    setIsPaletteOpen(false);
    setPaletteQuery("");
  }

  function clearResultState() {
    setResultData(null);
    setResultView(null);
    setResultMeta(null);
    setResultError(null);
    setIsResultFlashing(false);
    closeClipboardFallback();
    resetExportStates();
    setShareStateTemporarily("idle");
  }

  function showResultError(view: ResultErrorView) {
    setResultData(null);
    setResultView(null);
    setResultMeta(null);
    setResultError(view);
    setRenderSequence((current) => current + 1);
    closeClipboardFallback();
    resetExportStates();
    setShareStateTemporarily("idle");
  }

  function reloadParsers() {
    setCatalogVersion((current) => current + 1);
  }

  function selectParser(slug: string) {
    if (isBusy) {
      return;
    }

    setParser(slug);
    setFormError("");
    setSharedParserMessage("");
    clearResultState();
    closePalette();
  }

  function handlePaletteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const currentVisibleParsers = filterParsers(parsers, paletteQuery).slice(
      0,
      MAX_VISIBLE_PARSER_RESULTS,
    );

    if (!currentVisibleParsers.length && event.key === "Escape") {
      event.preventDefault();
      closePalette();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        currentVisibleParsers.length
          ? (current + 1) % currentVisibleParsers.length
          : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        currentVisibleParsers.length
          ? (current - 1 + currentVisibleParsers.length) %
            currentVisibleParsers.length
          : 0,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const highlightedParser = currentVisibleParsers[highlightedIndex];

      if (highlightedParser) {
        selectParser(highlightedParser.slug);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    }
  }

  async function replaceUrlWithParserAndInput(nextParser: string, nextInput: string) {
    try {
      const params = await encodeAppState(nextParser, nextInput);
      router.replace(buildAppUrl(params));
    } catch {
      // Ignore URL sync failures so parsing can still proceed.
    }
  }

  async function replaceUrlWithInputOnly(nextInput: string) {
    if (!nextInput) {
      router.replace("/");
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set("input", await compressToBase64(nextInput));
      router.replace(buildAppUrl(params));
    } catch {
      router.replace("/");
    }
  }

  async function submitParse(options?: {
    parser?: string;
    input?: string;
  }) {
    if (isBusy) {
      return;
    }

    const nextParser = options?.parser ?? parser;
    const nextInput = options?.input ?? input;
    const nextInputTooLarge = nextInput.length > MAX_PARSE_INPUT_CHARS;

    if (parsersLoading) {
      setFormError("The parser catalog is still loading.");
      return;
    }

    if (parsersError) {
      setFormError("The parser catalog is unavailable. Retry loading it first.");
      return;
    }

    if (!nextParser.trim()) {
      setFormError("Choose a parser before submitting.");
      return;
    }

    if (!nextInput.trim()) {
      setFormError("Paste terminal output before submitting.");
      return;
    }

    if (nextInputTooLarge) {
      setFormError(
        `Input is too large for this workspace. Keep it under ${MAX_PARSE_INPUT_CHARS.toLocaleString(
          "en-US",
        )} characters.`,
      );
      return;
    }

    parseAbortRef.current?.abort();
    const controller = new AbortController();
    parseAbortRef.current = controller;
    setIsSubmitting(true);
    setFormError("");
    setSharedParserMessage("");
    setResultData(null);
    setResultError(null);
    setResultView(null);
    setResultMeta(null);
    closeClipboardFallback();
    resetExportStates();
    setShareStateTemporarily("idle");
    closePalette();
    void replaceUrlWithParserAndInput(nextParser, nextInput);

    try {
      const { response, body } = await fetchJsonWithTimeout(
        "/api/parse",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            parser: nextParser,
            input: nextInput,
          } satisfies ParseRequestBody),
        },
        CLIENT_REQUEST_TIMEOUT_MS,
      );

      if (!response.ok || isApiErrorResponse(body)) {
        throw new ResultPanelError(
          createParseErrorView({
            code: isApiErrorResponse(body) ? body.code : "unexpected",
            parser: nextParser,
          }),
        );
      }

      if (!isParseSuccessResponse(body)) {
        throw new ResultPanelError(
          createParseErrorView({
            code: "unexpected",
            parser: nextParser,
          }),
        );
      }

      const nextResultView = formatResultForDisplay(body.data);
      setRenderSequence((current) => current + 1);
      setIsResultFlashing(true);

      startResultTransition(() => {
        setResultData(body.data);
        setResultView(nextResultView);
        setResultMeta(body.meta);
        setResultError(null);
        closeClipboardFallback();
        resetExportStates();
      });
    } catch (submitError) {
      if (isAbortError(submitError)) {
        return;
      }

      if (submitError instanceof ResultPanelError) {
        showResultError(submitError.view);
        return;
      }

      if (submitError instanceof TimeoutError) {
        showResultError(
          createParseErrorView({
            code: "timeout",
            parser: nextParser,
          }),
        );
        return;
      }

      showResultError(
        createParseErrorView({
          code: "network",
          parser: nextParser,
        }),
      );
    } finally {
      if (parseAbortRef.current === controller) {
        parseAbortRef.current = null;
      }

      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitParse();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submitParse();
    }
  }

  function handleClear() {
    parseAbortRef.current?.abort();
    parseAbortRef.current = null;
    setInput("");
    setFormError("");
    setIsSharedViewVisible(false);
    setSharedParserMessage("");
    setSharedInputWarning("");
    clearResultState();
    closePalette();
    setIsSubmitting(false);
    router.replace("/");
  }

  function getExportParserName() {
    return resultMeta?.parser || selectedParser?.slug || parser || "parser";
  }

  function getSerializedResult(spacing?: number) {
    if (!resultView) {
      return null;
    }

    const serialized = JSON.stringify(resultData, null, spacing);
    return typeof serialized === "string" ? serialized : null;
  }

  async function handleCopyJson(mode: "formatted" | "minified") {
    if (!resultView) {
      return;
    }

    const text = getSerializedResult(mode === "formatted" ? 2 : undefined);

    if (text === null) {
      setCopyStateTemporarily("failed");
      return;
    }

    const copied = await copyToClipboard(text);

    if (copied) {
      closeClipboardFallback();
      setCopyStateTemporarily("success");
      return;
    }

    openClipboardFallback(
      text,
      mode === "formatted"
        ? "Copy formatted JSON manually"
        : "Copy minified JSON manually",
    );
    setCopyStateTemporarily("manual");
  }

  function handleDownloadJson() {
    const text = getSerializedResult(2);

    if (text === null) {
      setJsonDownloadStateTemporarily("failed");
      return;
    }

    try {
      downloadBlob(
        new Blob([text], {
          type: "application/json;charset=utf-8",
        }),
        generateFilename(getExportParserName(), "json"),
      );
      setJsonDownloadStateTemporarily("success");
    } catch {
      setJsonDownloadStateTemporarily("failed");
    }
  }

  async function handleDownloadCsv() {
    if (!Array.isArray(resultData) || !showCsvDownload) {
      setCsvDownloadStateTemporarily("failed");
      return;
    }

    try {
      let csvText: string | null;

      if (resultData.length >= LARGE_CSV_ROW_THRESHOLD) {
        setCsvDownloadStateTemporarily("loading");
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });
        csvText = await generateCSVAsync(resultData);
      } else {
        csvText = generateCSV(resultData);
      }

      if (typeof csvText !== "string") {
        setCsvDownloadStateTemporarily("failed");
        return;
      }

      downloadBlob(
        new Blob([csvText], {
          type: "text/csv;charset=utf-8",
        }),
        generateFilename(getExportParserName(), "csv"),
      );
      setCsvDownloadStateTemporarily("success");
    } catch {
      setCsvDownloadStateTemporarily("failed");
    }
  }

  async function handleShareUrl() {
    if (!resultView) {
      return;
    }

    const nextUrl = window.location.href;
    const copied = await copyToClipboard(nextUrl);

    if (copied) {
      setShareStateTemporarily("copied");
      return;
    }

    setShareStateTemporarily("manual", nextUrl);
  }

  return (
    <main className="app-shell">
      <div className="app-shell__content">
        <WorkbenchHeader githubUrl={GITHUB_URL} />

        <div className="panel-grid">
          <section className="panel">
            <div className="panel__header">
              <div className="panel__title-group">
                <p className="panel__eyebrow">Input</p>
                <h2 className="panel__title">Raw CLI output</h2>
                <p className="panel__description">
                  Choose a parser, paste the original command output, and submit
                  it for conversion. The placeholder updates with a live example
                  for the selected parser.
                </p>
              </div>

              <div className="status-chip status-chip--accent">
                {MAX_PARSE_INPUT_CHARS.toLocaleString("en-US")} chars max
              </div>
            </div>

            <div className="panel__body">
              <form className="input-form" onSubmit={handleSubmit}>
                <ParserSelector
                  ref={paletteRef}
                  totalParsers={parsers.length}
                  totalMatches={filteredParsers.length}
                  visibleParsers={visibleParsers}
                  selectedParser={selectedParser}
                  isPaletteOpen={isPaletteOpen}
                  parsersLoading={parsersLoading}
                  disabled={isBusy || (parsersLoading && parsers.length === 0)}
                  paletteQuery={paletteQuery}
                  highlightedIndex={highlightedIndex}
                  selectedSlug={parser}
                  searchInputRef={paletteInputRef}
                  onToggle={() => {
                    setIsPaletteOpen((current) => !current);
                    setHighlightedIndex(0);
                  }}
                  onClose={closePalette}
                  onPaletteQueryChange={setPaletteQuery}
                  onPaletteKeyDown={handlePaletteKeyDown}
                  onHighlightIndexChange={setHighlightedIndex}
                  onSelectParser={selectParser}
                />

                {parsersError ? (
                  <div className="catalog-banner">
                    <div className="catalog-banner__copy">
                      <p className="catalog-banner__title">Catalog unavailable</p>
                      <p className="catalog-banner__message">{parsersError}</p>
                    </div>
                    <button
                      type="button"
                      className="catalog-banner__action"
                      onClick={reloadParsers}
                      disabled={parsersLoading}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {isSharedViewVisible ? (
                  <div className="catalog-banner">
                    <div className="catalog-banner__copy">
                      <p className="catalog-banner__title">Shared sample loaded</p>
                      <p className="catalog-banner__message">
                        This workspace was prefilled from a shared URL.
                      </p>
                    </div>
                  </div>
                ) : null}

                {sharedParserMessage ? (
                  <div className="catalog-banner">
                    <div className="catalog-banner__copy">
                      <p className="catalog-banner__title">Parser unavailable</p>
                      <p className="catalog-banner__message">{sharedParserMessage}</p>
                    </div>
                  </div>
                ) : null}

                {sharedInputWarning ? (
                  <div className="catalog-banner">
                    <div className="catalog-banner__copy">
                      <p className="catalog-banner__title">Shared input trimmed</p>
                      <p className="catalog-banner__message">{sharedInputWarning}</p>
                    </div>
                  </div>
                ) : null}

                <div className="field-label-row">
                  <label className="field-label" htmlFor="raw-input">
                    Sample
                  </label>
                  <div className="editor-shell__status">
                    {formatBytes(inputBytes)} pasted
                  </div>
                </div>

                <div
                  className={cx(
                    "editor-shell",
                    inputTooLarge && "editor-shell--warning",
                  )}
                >
                  <div className="editor-shell__toolbar">
                    <p className="field-caption">
                      {selectedParser
                        ? `Example placeholder is tuned for ${selectedParser.slug}.`
                        : "Select a parser to load a realistic placeholder example."}
                    </p>
                    <div className="editor-shell__status">
                      {isSharedStateLoading
                        ? "Loading shared sample"
                        : selectedParser
                          ? selectedParser.slug
                          : "No parser selected"}
                    </div>
                  </div>

                  <textarea
                    id="raw-input"
                    value={input}
                    onChange={(event) => {
                      setInput(event.target.value);
                      if (sharedInputWarning) {
                        setSharedInputWarning("");
                      }
                      if (formError) {
                        setFormError("");
                      }
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder={placeholder}
                    className="editor-shell__textarea"
                    disabled={isBusy || isSharedStateLoading}
                    spellCheck={false}
                  />

                  <div className="editor-shell__footer">
                    <span>
                      {selectedParser
                        ? "Paste the raw command output exactly as it appeared in the terminal."
                        : "Parser-specific placeholder text appears here after you choose a parser."}
                    </span>
                    <span className="editor-shell__count">
                      {inputCharacters.toLocaleString("en-US")} chars
                    </span>
                  </div>
                </div>

                <p
                  className={cx(
                    "helper-message",
                    helperTone === "warning" && "helper-message--warning",
                    helperTone === "error" && "helper-message--error",
                  )}
                >
                  {helperMessage}
                </p>

                <div className="input-actions">
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={!canSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="button__spinner" aria-hidden="true" />
                        Parsing...
                      </>
                    ) : (
                      "Parse output"
                    )}
                  </button>

                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={handleClear}
                    disabled={
                      !input &&
                      !resultView &&
                      !resultError &&
                      !formError &&
                      !isSharedViewVisible &&
                      !sharedParserMessage &&
                      !sharedInputWarning
                    }
                  >
                    Clear input & output
                  </button>

                  <div className="shortcut-hint">
                    <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Enter</kbd>
                  </div>
                </div>
              </form>
            </div>
          </section>

          <ResultPanel
            selectedParser={selectedParser}
            commandPreview={commandPreview}
            resultView={resultView}
            resultMeta={resultMeta}
            resultError={resultError}
            emptyState={emptyState}
            copyState={copyState}
            jsonDownloadState={jsonDownloadState}
            csvDownloadState={csvDownloadState}
            showCsvDownload={showCsvDownload}
            csvWarning={csvWarning}
            isLoading={isBusy || isSharedStateLoading}
            isFlashing={isResultFlashing}
            renderSequence={renderSequence}
            onCopyFormatted={() => {
              void handleCopyJson("formatted");
            }}
            onCopyMinified={() => {
              void handleCopyJson("minified");
            }}
            onDownloadJson={handleDownloadJson}
            onDownloadCsv={() => {
              void handleDownloadCsv();
            }}
            shareState={shareState}
            shareUrl={manualShareUrl}
            canShare={Boolean(resultView && parser.trim() && input.trim())}
            onShareUrl={() => {
              void handleShareUrl();
            }}
          />
        </div>

        {clipboardFallback ? (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeClipboardFallback();
              }
            }}
          >
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clipboard-fallback-title"
            >
              <div className="modal__header">
                <div>
                  <p className="panel__eyebrow">Clipboard fallback</p>
                  <h2 id="clipboard-fallback-title" className="modal__title">
                    {clipboardFallback.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeClipboardFallback}
                >
                  Close
                </button>
              </div>

              <p className="modal__description">
                Your browser blocked clipboard access. The JSON is selected below
                so you can copy it manually.
              </p>

              <textarea
                ref={clipboardFallbackRef}
                className="modal__textarea"
                readOnly
                value={clipboardFallback.text}
              />

              <div className="modal__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={selectClipboardFallbackText}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={closeClipboardFallback}
                >
                  Done
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <footer className="footer">
          ParseDeck turns terminal output into structured JSON with <code>jc</code>{" "}
          by Kelly Brazil, provided under the MIT License.
        </footer>
      </div>
    </main>
  );
}
