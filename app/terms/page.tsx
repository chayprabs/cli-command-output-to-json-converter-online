import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — ParseDeck",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-page__inner">
        <p className="legal-page__back">
          <Link href="/">← Back to ParseDeck</Link>
        </p>
        <h1>Terms of use</h1>

        <p>
          <strong>Use at your own risk.</strong> ParseDeck is provided free of charge
          and as-is, without warranty of any kind, under the MIT License.
        </p>

        <h2>No warranty on output correctness</h2>
        <p>
          Parsing is performed by jc, an open-source tool. The operator of
          ParseDeck makes no warranty that parsed results are accurate, complete, or
          suitable for any purpose. Always verify results independently.
        </p>

        <h2>Acceptable use</h2>
        <p>
          You may not use ParseDeck to submit input in a manner that violates
          applicable laws. You are responsible for ensuring you have the right to
          process and share the terminal output you submit. You may not attempt to
          circumvent rate limits or security measures.
        </p>

        <h2>No sensitive data</h2>
        <p>
          While input is never stored, you should avoid pasting terminal output
          containing passwords, API tokens, private key material, or other sensitive
          credentials. Transmission occurs over HTTPS but the operator cannot
          guarantee the security of all infrastructure components.
        </p>

        <h2>Rate limits</h2>
        <p>
          ParseDeck enforces per-IP rate limits to ensure fair access. Deliberate
          attempts to exceed limits may result in your IP being temporarily
          blocked.
        </p>

        <h2>Open source</h2>
        <p>
          ParseDeck&apos;s source code is available at the GitHub repository under
          the MIT License. The jc parsing runtime is also MIT licensed (copyright
          Kelly Brazil). See the NOTICE file for attribution.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated at any time. Continued use constitutes
          acceptance.
        </p>

        <p className="legal-page__muted">Last updated: 2026-05-18</p>
      </div>
    </main>
  );
}
