import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const uiFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const codeFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "ParseDeck — Terminal output to JSON",
    template: "%s",
  },
  description:
    "Paste CLI output, pick a command format, and get structured JSON instantly. Free online parser powered by jc.",
  keywords: [
    "terminal to json",
    "cli output parser",
    "jc online",
    "devops tools",
    "parse terminal output",
  ],
  openGraph: {
    title: "ParseDeck — Terminal output to JSON",
    description:
      "Paste CLI output, pick a format, and get structured JSON in your browser.",
    type: "website",
  },
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${uiFont.variable} ${codeFont.variable}`}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
      </head>
      <body className="app-body">
        {children}
      </body>
    </html>
  );
}
