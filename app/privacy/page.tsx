import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — ParseDeck",
};

const contact =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "[your contact email here]";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-page__inner">
        <p className="legal-page__back">
          <Link href="/">← Back to ParseDeck</Link>
        </p>
        <h1>Privacy</h1>

        <h2>Data we collect</h2>
        <p>
          ParseDeck does not create user accounts and does not store your pasted
          input. When you submit text to ParseDeck, it is sent to our server over
          HTTPS, processed by the jc parsing tool, and the structured result is
          returned to your browser. The input is not written to disk and is not
          retained after the request completes.
        </p>
        <p>
          We collect standard server request logs including: your IP address (used
          to enforce fair-use rate limits), the time and duration of each request,
          the parser format you selected, the size of your input in bytes, and the
          HTTP status code. We do not log the content of your input or your parse
          results.
        </p>

        <h2>Cookies</h2>
        <p>
          ParseDeck does not set any application cookies. Your infrastructure
          provider may set short-lived cookies for security or routing purposes as
          part of standard network operation.
        </p>

        <h2>Analytics</h2>
        <p>
          None. ParseDeck does not include analytics, tracking pixels, or
          telemetry scripts.
        </p>

        <h2>Third-party services</h2>
        <p>
          Parsing is performed by jc, an open-source Python tool (MIT license, by
          Kelly Brazil) running on our server. Your input is processed by jc locally
          on that server — it is not sent to any external jc service or API.
        </p>
        <p>
          Your hosting provider processes standard HTTP traffic as part of
          delivery. They do not receive the content of your input beyond what is
          inherent in routing your HTTPS request.
        </p>

        <h2>localStorage &amp; URL state</h2>
        <p>
          ParseDeck may store your current parser selection in browser storage and
          encode your parser selection and input in the URL hash for sharing
          purposes. This data stays in your browser and is not transmitted
          separately to any server except when you submit a parse request.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about this privacy notice, contact {contact}.
        </p>
        <p className="legal-page__muted">Last updated: 2026-05-18</p>
      </div>
    </main>
  );
}
