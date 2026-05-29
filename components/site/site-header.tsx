import Link from "next/link";
import {
  GITHUB_URL,
  PRODUCT_NAME,
  TWITTER_URL,
  WEBSITE_URL,
} from "@/lib/site-config";
import { GitHubIcon, GlobeIcon, XIcon } from "./icons";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand">
          {PRODUCT_NAME}
        </Link>

        <nav className="site-header__nav" aria-label="External links">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="site-header__link"
            aria-label="GitHub repository"
            title="GitHub"
          >
            <GitHubIcon />
          </a>
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noreferrer"
            className="site-header__link"
            aria-label="X (Twitter)"
            title="X"
          >
            <XIcon />
          </a>
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noreferrer"
            className="site-header__link"
            aria-label="Personal website"
            title="Website"
          >
            <GlobeIcon />
          </a>
        </nav>
      </div>
    </header>
  );
}
