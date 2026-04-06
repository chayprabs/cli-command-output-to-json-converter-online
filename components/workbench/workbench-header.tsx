type WorkbenchHeaderProps = {
  githubUrl?: string | null;
};

function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7.5h16M7.5 4v16M4.5 19.5l15-15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5.25"
        y="5.25"
        width="13.5"
        height="13.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.475 2 2 6.589 2 12.25c0 4.53 2.865 8.372 6.839 9.73.5.095.682-.221.682-.493 0-.244-.009-.89-.014-1.747-2.782.618-3.369-1.378-3.369-1.378-.455-1.185-1.111-1.5-1.111-1.5-.908-.636.069-.623.069-.623 1.004.072 1.531 1.056 1.531 1.056.892 1.562 2.341 1.111 2.91.85.091-.665.349-1.111.635-1.366-2.221-.26-4.555-1.139-4.555-5.069 0-1.119.389-2.034 1.029-2.751-.103-.26-.446-1.308.098-2.727 0 0 .839-.275 2.75 1.051A9.36 9.36 0 0 1 12 6.84c.85.004 1.707.118 2.507.347 1.91-1.326 2.748-1.051 2.748-1.051.546 1.419.203 2.467.1 2.727.641.717 1.027 1.632 1.027 2.751 0 3.94-2.338 4.806-4.566 5.061.359.319.679.948.679 1.911 0 1.38-.012 2.492-.012 2.83 0 .274.18.593.688.492C19.138 20.618 22 16.778 22 12.25 22 6.589 17.523 2 12 2Z" />
    </svg>
  );
}

export function WorkbenchHeader({ githubUrl }: WorkbenchHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand" aria-label="ParseDeck">
        <div className="brand__mark">
          <BrandMark />
        </div>
        <div className="brand__text">
          <h1 className="brand__name">ParseDeck</h1>
          <p className="brand__meta">Focused parser workbench for terminal output</p>
        </div>
      </div>

      {githubUrl ? (
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="icon-button"
          aria-label="Open GitHub repository"
          title="Open GitHub repository"
        >
          <GitHubIcon />
        </a>
      ) : null}
    </header>
  );
}
