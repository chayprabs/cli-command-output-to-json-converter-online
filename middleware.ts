import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SHARED_SECURITY_HEADERS = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
} as const;

const API_ONLY_HEADERS = {
  "Cache-Control": "no-store, no-cache",
  Pragma: "no-cache",
} as const;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const isApi = request.nextUrl.pathname.startsWith("/api");

  for (const [key, value] of Object.entries(SHARED_SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  const isParserCatalogGet =
    request.nextUrl.pathname === "/api/parsers" && request.method === "GET";

  if (isApi && !isParserCatalogGet) {
    for (const [key, value] of Object.entries(API_ONLY_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
