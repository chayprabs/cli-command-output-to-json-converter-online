"use client";

import type { ParseOptions } from "@/lib/parse-options";
import { cx } from "./workbench-styles";

type ParseOptionsBarProps = {
  options: ParseOptions;
  autoParseEnabled: boolean;
  disabled: boolean;
  onChange: (next: ParseOptions) => void;
  onAutoParseChange: (enabled: boolean) => void;
};

export function ParseOptionsBar({
  options,
  autoParseEnabled,
  disabled,
  onChange,
  onAutoParseChange,
}: ParseOptionsBarProps) {
  return (
    <div className="parse-options" role="group" aria-label="Parse options">
      <label className="parse-options__item">
        <input
          type="radio"
          name="output-format"
          checked={options.outputFormat !== "yaml"}
          disabled={disabled}
          onChange={() => onChange({ ...options, outputFormat: "json" })}
        />
        JSON
      </label>
      <label className="parse-options__item">
        <input
          type="radio"
          name="output-format"
          checked={options.outputFormat === "yaml"}
          disabled={disabled}
          onChange={() => onChange({ ...options, outputFormat: "yaml" })}
        />
        YAML
      </label>
      <label className={cx("parse-options__item", "parse-options__item--checkbox")}>
        <input
          type="checkbox"
          checked={Boolean(options.prettify)}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...options, prettify: event.target.checked })
          }
        />
        Prettify
      </label>
      <label className={cx("parse-options__item", "parse-options__item--checkbox")}>
        <input
          type="checkbox"
          checked={Boolean(options.slurp)}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...options, slurp: event.target.checked })
          }
        />
        Slurp (-d)
      </label>
      <label className={cx("parse-options__item", "parse-options__item--checkbox")}>
        <input
          type="checkbox"
          checked={autoParseEnabled}
          disabled={disabled}
          onChange={(event) => onAutoParseChange(event.target.checked)}
        />
        Auto-parse
      </label>
    </div>
  );
}
