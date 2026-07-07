import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";
import { isRestrictedCountry } from "@/lib/geo-blocking";

// The restricted-country list (US securities law, EU MiCA, OFAC sanctions) is the
// single source of truth in lib/geo-blocking.ts — imported above so this site-wide
// proxy and the per-route API checks can never drift apart. Rationale + scope:
// docs/regulatory-memo.md, whitepaper §6.5, ToS §8.

// Always-public routes — never geo-blocked, regardless of country. These are
// pure-content marketing/informational pages and the geo-block landing page
// itself. Everything else is gated by RESTRICTED_COUNTRIES.
const ALWAYS_OPEN_ROUTES = [
  "/blocked",         // the geo-block landing itself
  "/state-of-protocol", // public transparency — fine for restricted users to read
  "/bug-bounty",      // bug reports welcome from any jurisdiction
  "/admin",           // internal — guard separately; not investor-facing
];

function getCountry(request: Request): string {
  const req = request as any;
  const country = req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    "XX";
  return country.toUpperCase();
}

export async function proxy(request: Request) {
  const req = request as any;
  const pathname = new URL(request.url).pathname;
  const country = getCountry(request);

  // Always-open routes bypass the geo-block entirely.
  const isAlwaysOpen = ALWAYS_OPEN_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));

  // Internal cron / health routes — Vercel's cron infra calls these from a
  // datacenter (often US-east), so geo-blocking them would brick the keeper.
  const isInternal = pathname.startsWith("/api/cron/") || pathname === "/api/version";

  if (!isAlwaysOpen && !isInternal && isRestrictedCountry(country)) {
    // For /api/* paths, return JSON 451 — redirecting an API call to an
    // HTML page would break clients. For everything else, redirect to the
    // /blocked landing page.
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({ error: "Access restricted in your region.", code: "GEO_BLOCKED" }),
        { status: 451, headers: { "content-type": "application/json" } }
      );
    }
    return NextResponse.redirect(new URL("/blocked", request.url));
  }

  return await updateSession(req);
}

export const config = {
  // Run on every route except Next.js internals + static assets. Geo-block
  // logic above decides which routes actually redirect.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots.txt|sitemap.xml).*)",
  ],
};
