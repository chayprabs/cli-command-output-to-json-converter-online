"use client";

import type { StatusApiResponse } from "@/lib/api";

type RuntimeStatusBarProps = {
  status: StatusApiResponse | null;
  loading: boolean;
  error: string;
};

export function RuntimeStatusBar({
  status,
  loading,
  error,
}: RuntimeStatusBarProps) {
  if (loading) {
    return (
      <p className="runtime-status runtime-status--loading" role="status">
        Connecting to parsing runtime…
      </p>
    );
  }

  if (error) {
    return (
      <p className="runtime-status runtime-status--error" role="status">
        {error}
      </p>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <p className="runtime-status" role="status">
      <span>
        jc {status.jcVersion} · {status.parserCount} formats
      </span>
      <span className="runtime-status__limits">
        Limits: {status.rateLimit.requestsPerMinute}/min ·{" "}
        {status.rateLimit.inputMegabytesPerHour} MB/hr per IP
      </span>
    </p>
  );
}
