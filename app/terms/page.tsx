import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GITHUB_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms & Conditions — ParseDeck",
  description:
    "Terms of use for ParseDeck: free tool, no warranty, limited liability.",
};

export default function TermsPage() {
  return (
    <div className="app-page">
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__inner">
          <p className="legal-page__back">
            <Link href="/">← Back to ParseDeck</Link>
          </p>
          <h1>Terms &amp; Conditions</h1>
          <p className="legal-page__muted">Last updated: May 29, 2026</p>

          <h2>Agreement</h2>
          <p>
            By accessing or using ParseDeck (&quot;the Service&quot;), you agree to
            these Terms. If you do not agree, do not use the Service.
          </p>

          <h2>Service description</h2>
          <p>
            ParseDeck is a free web tool that converts pasted terminal output into
            JSON using the open-source <code>jc</code> parser. The Service is
            provided for convenience only and may change, suspend, or end at any
            time without notice.
          </p>

          <h2>No professional advice</h2>
          <p>
            Output from ParseDeck is not legal, security, financial, or operational
            advice. You must independently verify all results before relying on them
            in production, compliance, or safety-critical contexts.
          </p>

          <h2>Disclaimer of warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
            INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            NON-INFRINGEMENT, AND ACCURACY OF PARSED OUTPUT. WE DO NOT WARRANT THAT
            THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATOR OF
            PARSEDECK AND ITS CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR
            ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING
            FROM OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE
            POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ANY CLAIM SHALL
            NOT EXCEED ONE U.S. DOLLAR (US$1.00) OR THE AMOUNT YOU PAID TO USE THE
            SERVICE IN THE PAST TWELVE MONTHS, WHICHEVER IS GREATER (TYPICALLY
            ZERO FOR THIS FREE SERVICE).
          </p>

          <h2>Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless the operator from any
            claims, damages, losses, or expenses (including reasonable attorneys&apos;
            fees) arising from your use of the Service, content you submit, or your
            violation of these Terms or applicable law.
          </p>

          <h2>Acceptable use</h2>
          <p>
            You may not use the Service unlawfully, to process data you lack rights
            to handle, to probe or disrupt infrastructure, or to circumvent rate
            limits or security controls.
          </p>

          <h2>Rate limits</h2>
          <p>
            Fair-use rate limits apply. Abuse may result in temporary or permanent
            blocking of your IP address.
          </p>

          <h2>Open source</h2>
          <p>
            ParseDeck source code is available at{" "}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>{" "}
            under the MIT License. Third-party components (including <code>jc</code>)
            retain their respective licenses; see NOTICE.
          </p>

          <h2>Governing law</h2>
          <p>
            These Terms are governed by the laws applicable where the operator
            resides, without regard to conflict-of-law rules. Disputes shall be
            resolved in the courts of that jurisdiction, and you consent to their
            exclusive venue except where prohibited.
          </p>

          <h2>Severability</h2>
          <p>
            If any provision is held invalid, the remaining provisions remain in
            full force.
          </p>

          <h2>Changes</h2>
          <p>
            We may modify these Terms at any time. Continued use after posting
            changes constitutes acceptance.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
