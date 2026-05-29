import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy — ParseDeck",
  description:
    "How ParseDeck handles your data: no accounts, no stored input, minimal server logs.",
};

const contact =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@chaitanyaprabuddha.com";

export default function PrivacyPage() {
  return (
    <div className="app-page">
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__inner">
          <p className="legal-page__back">
            <Link href="/">← Back to ParseDeck</Link>
          </p>
          <h1>Privacy Policy</h1>
          <p className="legal-page__muted">Last updated: May 29, 2026</p>

          <h2>Summary</h2>
          <p>
            ParseDeck does not require accounts and does not intentionally retain
            the text you paste. Each parse request is processed in memory and
            discarded when the response is sent.
          </p>

          <h2>What we process</h2>
          <p>
            When you submit terminal output, it travels over HTTPS to our server,
            is passed to the open-source <code>jc</code> tool for conversion, and
            the JSON result is returned to your browser. We do not write your input
            or parse results to application databases or long-term storage.
          </p>

          <h2>Server logs</h2>
          <p>
            Standard request logs may include: timestamp, HTTP status, selected
            parser name, input size in bytes, response time, and a hashed IP
            address for rate limiting. We do not log the content of your input or
            output.
          </p>

          <h2>Cookies and tracking</h2>
          <p>
            ParseDeck does not set marketing or analytics cookies. Your browser may
            store your last selected parser in local storage for convenience. Shared
            links may encode parser and input data in the URL hash; that data stays
            in your browser until you submit a parse.
          </p>

          <h2>Third parties</h2>
          <p>
            Parsing runs locally on our infrastructure using <code>jc</code> (MIT,
            Kelly Brazil). Your input is not sent to external parsing APIs. Hosting
            providers process network traffic necessary to deliver the site.
          </p>

          <h2>Children</h2>
          <p>
            ParseDeck is not directed at children under 13. We do not knowingly
            collect personal information from children.
          </p>

          <h2>Your responsibilities</h2>
          <p>
            Do not paste secrets, passwords, private keys, or regulated personal
            data. You are responsible for ensuring you have the right to process
            any content you submit.
          </p>

          <h2>Changes</h2>
          <p>
            We may update this policy. Continued use after changes constitutes
            acceptance of the revised policy.
          </p>

          <h2>Contact</h2>
          <p>
            Questions: <a href={`mailto:${contact}`}>{contact}</a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
