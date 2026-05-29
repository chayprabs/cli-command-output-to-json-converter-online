import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer__nav" aria-label="Legal">
        <Link href="/privacy">Privacy Policy</Link>
        <span className="site-footer__sep" aria-hidden="true">
          ·
        </span>
        <Link href="/terms">Terms &amp; Conditions</Link>
      </nav>
    </footer>
  );
}
