import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

// Countries blocked for restricted asset classes (stocks, forex, commodities research)
const RESTRICTED_COUNTRIES = new Set([
  "US", // United States
  // EU countries requiring restrictions
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // OFAC / other restricted
  "KP", "IR", "SY", "BY", "MM", "VE", "CU",
]);

// Routes that require geo-blocking (restricted asset class research)
const RESTRICTED_ROUTES = ["/markets", "/research/stocks", "/research/forex", "/research/commodities"];

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

  // Check if route requires geo-blocking
  const isRestrictedRoute = RESTRICTED_ROUTES.some(route => pathname.startsWith(route));

  if (isRestrictedRoute && RESTRICTED_COUNTRIES.has(country)) {
    return NextResponse.redirect(new URL("/blocked", request.url));
  }

  return await updateSession(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
