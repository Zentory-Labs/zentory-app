import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

// Countries restricted from interacting with the testnet protocol per
// docs/regulatory-memo.md. Whitepaper §6.5 + ToS §8 promise this surface.
const RESTRICTED_COUNTRIES = new Set([
  "US", // United States
  // EU member states (27)
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // OFAC + comprehensively sanctioned
  "KP", "IR", "SY", "BY", "MM", "VE", "CU",
]);

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

  if (!isAlwaysOpen && !isInternal && RESTRICTED_COUNTRIES.has(country)) {
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
