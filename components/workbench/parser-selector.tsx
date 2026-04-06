import {
  forwardRef,
  useEffect,
  useId,
  type KeyboardEventHandler,
  type RefObject,
} from "react";
import type { ParserSummary } from "@/lib/api";

type ParserSelectorProps = {
  totalParsers: number;
  totalMatches: number;
  visibleParsers: ParserSummary[];
  selectedParser: ParserSummary | null;
  isPaletteOpen: boolean;
  parsersLoading: boolean;
  disabled: boolean;
  paletteQuery: string;
  highlightedIndex: number;
  selectedSlug: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onClose: () => void;
  onPaletteQueryChange: (value: string) => void;
  onPaletteKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onHighlightIndexChange: (index: number) => void;
  onSelectParser: (slug: string) => void;
};

export const ParserSelector = forwardRef<HTMLDivElement, ParserSelectorProps>(
  function ParserSelector(
    {
      totalParsers,
      totalMatches,
      visibleParsers,
      selectedParser,
      isPaletteOpen,
      parsersLoading,
      disabled,
      paletteQuery,
      highlightedIndex,
      selectedSlug,
      searchInputRef,
      onToggle,
      onClose,
      onPaletteQueryChange,
      onPaletteKeyDown,
      onHighlightIndexChange,
      onSelectParser,
    },
    ref,
  ) {
    const listboxId = useId();

    useEffect(() => {
      if (!isPaletteOpen || !visibleParsers.length) {
        return;
      }

      const activeOption = document.getElementById(
        `${listboxId}-option-${highlightedIndex}`,
      );

      activeOption?.scrollIntoView({
        block: "nearest",
      });
    }, [highlightedIndex, isPaletteOpen, listboxId, visibleParsers.length]);

    return (
      <div ref={ref} className="parser-select">
        <div className="field-label-row">
          <label className="field-label" htmlFor={`${listboxId}-search`}>
            Parser
          </label>
          <p className="field-caption">Search by parser name or description</p>
        </div>

        <button
          type="button"
          aria-controls={listboxId}
          aria-expanded={isPaletteOpen}
          aria-haspopup="listbox"
          className="parser-select__trigger"
          onClick={onToggle}
          disabled={disabled}
        >
          <div className="parser-select__trigger-copy">
            <span className="parser-select__trigger-name">
              {selectedParser ? selectedParser.slug : "Select a parser"}
            </span>
            <span className="parser-select__trigger-description">
              {selectedParser
                ? selectedParser.description
                : "Open the catalog and choose the format that matches your CLI output."}
            </span>
          </div>
          <span className="parser-select__trigger-meta">
            {parsersLoading
              ? "Loading catalog..."
              : `${totalParsers.toLocaleString("en-US")} available`}
            <span className="parser-select__caret" aria-hidden="true">
              v
            </span>
          </span>
        </button>

        {isPaletteOpen ? (
          <button
            type="button"
            className="parser-select__backdrop"
            onClick={onClose}
            aria-label="Close parser selector"
          />
        ) : null}

        {isPaletteOpen ? (
          <div className="parser-select__popover">
            <div className="parser-select__header">
              <div>
                <p className="parser-select__header-title">Search parser catalog</p>
                <p className="field-caption">
                  Arrow keys navigate. Enter selects. Escape closes.
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={onClose}
                aria-label="Close parser catalog"
              >
                Close
              </button>
            </div>

            <input
              ref={searchInputRef}
              id={`${listboxId}-search`}
              type="search"
              value={paletteQuery}
              onChange={(event) => {
                onPaletteQueryChange(event.target.value);
                onHighlightIndexChange(0);
              }}
              onKeyDown={onPaletteKeyDown}
              placeholder="Filter parsers"
              className="parser-select__search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isPaletteOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                visibleParsers[highlightedIndex]
                  ? `${listboxId}-option-${highlightedIndex}`
                  : undefined
              }
            />

            <div className="field-label-row">
              <p className="field-caption">
                {totalMatches
                  ? `${totalMatches.toLocaleString("en-US")} matching parsers`
                  : "No parsers match"}
              </p>
              {paletteQuery ? (
                <p className="field-caption">Filter: {paletteQuery}</p>
              ) : null}
            </div>

            {visibleParsers.length ? (
              <div id={listboxId} role="listbox" className="parser-select__results">
                {visibleParsers.map((entry, index) => (
                  <button
                    key={entry.slug}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={entry.slug === selectedSlug}
                    className="parser-select__option"
                    data-highlighted={index === highlightedIndex}
                    data-selected={entry.slug === selectedSlug}
                    onMouseEnter={() => onHighlightIndexChange(index)}
                    onClick={() => onSelectParser(entry.slug)}
                  >
                    <div className="parser-select__option-copy">
                      <p className="parser-select__option-name">{entry.slug}</p>
                      <p className="parser-select__option-description">
                        {entry.description}
                      </p>
                    </div>
                    <span className="parser-select__option-tag">
                      {entry.slug === selectedSlug ? "Selected" : "Parser"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="parser-select__results-empty">No parsers match</div>
            )}
          </div>
        ) : null}
      </div>
    );
  },
);
