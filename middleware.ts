import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
} as const;

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(API_SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
