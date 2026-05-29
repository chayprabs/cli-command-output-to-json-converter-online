type IconProps = {
  className?: string;
};

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.475 2 2 6.589 2 12.25c0 4.53 2.865 8.372 6.839 9.73.5.095.682-.221.682-.493 0-.244-.009-.89-.014-1.747-2.782.618-3.369-1.378-3.369-1.378-.455-1.185-1.111-1.5-1.111-1.5-.908-.636.069-.623.069-.623 1.004.072 1.531 1.056 1.531 1.056.892 1.562 2.341 1.111 2.91.85.091-.665.349-1.111.635-1.366-2.221-.26-4.555-1.139-4.555-5.069 0-1.119.389-2.034 1.029-2.751-.103-.26-.446-1.308.098-2.727 0 0 .839-.275 2.75 1.051A9.36 9.36 0 0 1 12 6.84c.85.004 1.707.118 2.507.347 1.91-1.326 2.748-1.051 2.748-1.051.546 1.419.203 2.467.1 2.727.641.717 1.027 1.632 1.027 2.751 0 3.94-2.338 4.806-4.566 5.061.359.319.679.948.679 1.911 0 1.38-.012 2.492-.012 2.83 0 .274.18.593.688.492C19.138 20.618 22 16.778 22 12.25 22 6.589 17.523 2 12 2Z" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 12h18M12 3c2.5 2.8 3.8 6.2 3.8 9s-1.3 6.2-3.8 9M12 3c-2.5 2.8-3.8 6.2-3.8 9s1.3 6.2 3.8 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
