import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Credits — ParseDeck",
};

export default function CreditsPage() {
  return (
    <main className="legal-page">
      <div className="legal-page__inner">
        <p className="legal-page__back">
          <Link href="/">← Back to ParseDeck</Link>
        </p>
        <h1>Credits</h1>

        <ul className="legal-page__list">
          <li>
            Parsing runtime:{" "}
            <a
              href="https://github.com/kellyjonbrazil/jc"
              target="_blank"
              rel="noreferrer"
            >
              jc
            </a>{" "}
            by Kelly Brazil (MIT)
          </li>
          <li>
            Framework:{" "}
            <a href="https://nextjs.org" target="_blank" rel="noreferrer">
              Next.js
            </a>
          </li>
        </ul>

        <p className="legal-page__muted">
          © 2026 Chaitanya Prabuddha — MIT License
        </p>
      </div>
    </main>
  );
}
