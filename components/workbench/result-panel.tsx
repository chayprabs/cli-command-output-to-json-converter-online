"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ParseMeta, ParserSummary } from "@/lib/api";
import {
  formatBytes,
  getJsonTokenClassName,
  type ResultView,
} from "@/lib/client";
import { cx } from "./workbench-styles";

export type ResultCopyState = "idle" | "success" | "manual" | "failed";
export type ResultDownloadState = "idle" | "loading" | "success" | "failed";
export type ShareCopyState = "idle" | "copied" | "manual";

export type ResultErrorView = {
  label: string;
  title: string;
  message: string;
  hint: string;
};

export type EmptyStateView = {
  label: string;
  title: string;
  message: string;
  hint: string;
};

type ResultPanelProps = {
  selectedParser: ParserSummary | null;
  commandPreview: string;
  resultView: ResultView | null;
  resultMeta: ParseMeta | null;
  resultError: ResultErrorView | null;
  emptyState: EmptyStateView;
  copyState: ResultCopyState;
  jsonDownloadState: ResultDownloadState;
  csvDownloadState: ResultDownloadState;
  showCsvDownload: boolean;
  csvWarning: string | null;
  isLoading: boolean;
  isFlashing: boolean;
  renderSequence: number;
  onCopyFormatted: () => void;
  onCopyMinified: () => void;
  onDownloadJson: () => void;
  onDownloadCsv: () => void;
  shareState: ShareCopyState;
  shareUrl: string;
  canShare: boolean;
  onShareUrl: () => void;
};

function CommandIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 8 4 12l4 4M16 8l4 4-4 4M13 6l-2 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.75 8.75h8.5v10.5h-8.5z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.75 15.25h-1V5.75h9.5v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 8.5a3 3 0 1 0-2.82-4H12a3 3 0 0 0 .18 1.02L8.62 7.4a3 3 0 0 0-2.12-.9 3 3 0 1 0 2.12 5.1l3.56 1.88A3 3 0 0 0 12 14.5a3 3 0 1 0 .62 1.9l-3.56-1.88a3.01 3.01 0 0 0 0-3.04l3.56-1.88A3 3 0 0 0 15 8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18.25h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m5.5 12.5 4 4 9-9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getCopyButtonLabel(copyState: ResultCopyState) {
  switch (copyState) {
    case "success":
      return "Copied!";
    case "manual":
      return "Manual copy";
    case "failed":
      return "Copy failed";
    default:
      return "Copy formatted";
  }
}

function getDownloadButtonLabel(
  state: ResultDownloadState,
  format: "JSON" | "CSV",
) {
  switch (state) {
    case "loading":
      return `Exporting ${format}`;
    case "success":
      return "Saved";
    case "failed":
      return "Retry";
    default:
      return format;
  }
}

function getShareButtonLabel(shareState: ShareCopyState) {
  switch (shareState) {
    case "copied":
      return "Link copied!";
    case "manual":
      return "Copy link manually";
    default:
      return "Share link";
  }
}

export function ResultPanel({
  selectedParser,
  commandPreview,
  resultView,
  resultMeta,
  resultError,
  emptyState,
  copyState,
  jsonDownloadState,
  csvDownloadState,
  showCsvDownload,
  csvWarning,
  isLoading,
  isFlashing,
  renderSequence,
  onCopyFormatted,
  onCopyMinified,
  onDownloadJson,
  onDownloadCsv,
  shareState,
  shareUrl,
  canShare,
  onShareUrl,
}: ResultPanelProps) {
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement | null>(null);
  const copyMenuId = useId();
  const mode = isLoading
    ? "loading"
    : resultError
      ? "error"
      : resultView
        ? "result"
        : "empty";

  useEffect(() => {
    if (!isCopyMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!copyMenuRef.current?.contains(event.target as Node)) {
        setIsCopyMenuOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCopyMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCopyMenuOpen]);

  useEffect(() => {
    if (!resultView || isLoading) {
      setIsCopyMenuOpen(false);
    }
  }, [isLoading, resultView]);

  return (
    <section
      className={cx(
        "panel",
        isFlashing && "panel--flash",
        resultError && "panel--error",
      )}
    >
      <div className="panel__header">
        <div className="panel__title-group">
          <p className="panel__eyebrow">Output</p>
          <h2 className="panel__title">
            {selectedParser ? selectedParser.slug : "JSON output"}
          </h2>
          <p className="panel__description">
            {selectedParser
              ? selectedParser.description
              : "Structured JSON appears here after you choose a parser and run a sample."}
          </p>
        </div>

        <div className="panel__actions">
          <div className="tooltip-anchor">
            <button
              type="button"
              className={cx(
                "icon-button",
                shareState === "copied" && "icon-button--success",
              )}
              onClick={onShareUrl}
              disabled={!canShare || isLoading}
              aria-label={canShare ? "Copy shareable link" : "Parse something first"}
            >
              <ShareIcon />
              {getShareButtonLabel(shareState)}
            </button>

            {!canShare ? (
              <div className="tooltip-bubble" role="tooltip">
                Parse something first
              </div>
            ) : null}

            {shareState === "manual" && shareUrl ? (
              <div className="share-popover" role="status" aria-live="polite">
                <p className="share-popover__title">Copy this URL manually</p>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="share-popover__input"
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                  onClick={(event) => {
                    event.currentTarget.select();
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel__body">
        <div className="result-panel__toolbar">
          <div className="split-button" ref={copyMenuRef}>
            <button
              type="button"
              className={cx(
                "icon-button",
                "split-button__main",
                copyState === "success" && "icon-button--success",
                copyState === "manual" && "icon-button--warning",
                copyState === "failed" && "icon-button--danger",
              )}
              onClick={onCopyFormatted}
              disabled={!resultView || isLoading}
            >
              {copyState === "success" ? <CheckIcon /> : <CopyIcon />}
              {getCopyButtonLabel(copyState)}
            </button>

            <button
              type="button"
              className="icon-button split-button__toggle"
              aria-haspopup="menu"
              aria-expanded={isCopyMenuOpen}
              aria-controls={copyMenuId}
              onClick={() => {
                setIsCopyMenuOpen((current) => !current);
              }}
              disabled={!resultView || isLoading}
            >
              <ChevronDownIcon />
            </button>

            {isCopyMenuOpen ? (
              <div id={copyMenuId} role="menu" className="result-menu">
                <button
                  type="button"
                  role="menuitem"
                  className="result-menu__item"
                  onClick={() => {
                    setIsCopyMenuOpen(false);
                    onCopyFormatted();
                  }}
                >
                  Copy formatted JSON
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="result-menu__item"
                  onClick={() => {
                    setIsCopyMenuOpen(false);
                    onCopyMinified();
                  }}
                >
                  Copy minified JSON
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={cx(
              "icon-button",
              jsonDownloadState === "success" && "icon-button--success",
              jsonDownloadState === "failed" && "icon-button--danger",
            )}
            onClick={onDownloadJson}
            disabled={!resultView || isLoading}
          >
            {jsonDownloadState === "loading" ? (
              <span className="button__spinner" aria-hidden="true" />
            ) : jsonDownloadState === "success" ? (
              <CheckIcon />
            ) : (
              <DownloadIcon />
            )}
            {getDownloadButtonLabel(jsonDownloadState, "JSON")}
          </button>

          {showCsvDownload ? (
            <button
              type="button"
              className={cx(
                "icon-button",
                csvDownloadState === "success" && "icon-button--success",
                csvDownloadState === "failed" && "icon-button--danger",
              )}
              onClick={onDownloadCsv}
              disabled={!resultView || isLoading || csvDownloadState === "loading"}
              title={csvWarning ?? undefined}
              aria-label={
                csvWarning ? `Download CSV. ${csvWarning}` : "Download CSV"
              }
            >
              {csvDownloadState === "loading" ? (
                <span className="button__spinner" aria-hidden="true" />
              ) : csvDownloadState === "success" ? (
                <CheckIcon />
              ) : (
                <DownloadIcon />
              )}
              {getDownloadButtonLabel(csvDownloadState, "CSV")}
            </button>
          ) : null}
        </div>

        <div className="result-panel__command-row">
          <div className="code-chip" title={commandPreview}>
            <CommandIcon />
            <code>{commandPreview}</code>
          </div>

          {resultMeta ? (
            <>
              <div className="result-meta">{resultMeta.durationMs} ms</div>
              <div className="result-meta">{formatBytes(resultMeta.inputBytes)} in</div>
              <div className="result-meta">{formatBytes(resultMeta.outputBytes)} out</div>
            </>
          ) : null}

          {resultView && !resultView.tokens ? (
            <div className="result-meta">Large output shown without token colors</div>
          ) : null}
        </div>

        <div className="result-panel__token-legend" aria-hidden="true">
          <span>keys</span>
          <span>strings</span>
          <span>numbers</span>
          <span>booleans</span>
          <span>null</span>
        </div>

        <div className="result-panel__viewport" tabIndex={0}>
          <div
            key={`${mode}-${renderSequence}`}
            className={cx("result-panel__stage", `result-panel__stage--${mode}`)}
          >
            {mode === "loading" ? (
              <div className="loading-state">
                <p className="loading-state__label">Parsing sample</p>
                <div className="loading-state__skeleton">
                  <div className="skeleton-row skeleton-row--1" />
                  <div className="skeleton-row skeleton-row--2" />
                  <div className="skeleton-row skeleton-row--3" />
                  <div className="skeleton-row skeleton-row--4" />
                  <div className="skeleton-row skeleton-row--5" />
                </div>
                <div className="surface-card">
                  <p className="surface-card__title">Working on the result</p>
                  <p className="surface-card__copy">
                    ParseDeck is waiting for the parser response and will pretty-print
                    the JSON with a 2-space indent as soon as it returns.
                  </p>
                </div>
              </div>
            ) : null}

            {mode === "error" && resultError ? (
              <div className="error-state">
                <div className="error-state__label">{resultError.label}</div>
                <h3 className="error-state__title">{resultError.title}</h3>
                <p className="error-state__message">{resultError.message}</p>
                <p className="error-state__hint">{resultError.hint}</p>
              </div>
            ) : null}

            {mode === "empty" ? (
              <div className="empty-state">
                <div className="empty-state__label">{emptyState.label}</div>
                <h3 className="empty-state__title">{emptyState.title}</h3>
                <p className="empty-state__message">{emptyState.message}</p>
                <p className="empty-state__hint">{emptyState.hint}</p>
                <div className="surface-card">
                  <p className="surface-card__title">What lands here</p>
                  <p className="surface-card__copy">
                    Parsed output is formatted as readable JSON, tokenized in the
                    browser, and ready to copy into scripts, notes, or automation.
                  </p>
                </div>
              </div>
            ) : null}

            {mode === "result" && resultView ? (
              <>
                {resultMeta ? (
                  <div className="result-panel__metrics">
                    <div className="result-meta">Parser: {resultMeta.parser}</div>
                    <div className="result-meta">
                      Rendered: {formatBytes(resultView.byteLength)}
                    </div>
                  </div>
                ) : null}

                <div className="result-panel__scroller">
                  <pre className="json-output">
                    {resultView.tokens
                      ? resultView.tokens.map((token, index) => (
                          <span
                            key={`${token.type}-${index}`}
                            className={getJsonTokenClassName(token.type)}
                          >
                            {token.value}
                          </span>
                        ))
                      : resultView.text}
                  </pre>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
