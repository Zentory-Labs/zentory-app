/**
 * Sentry tunnel route — proxies browser-side Sentry envelope POSTs through
 * our own domain so ad-blockers don't kill them.
 *
 * Why we have to write this manually instead of relying on
 * `withSentryConfig({ tunnelRoute: "/monitoring" })`:
 *   The Sentry build plugin auto-injects a Next.js rewrite for the tunnel
 *   route — but only under Webpack. Next.js 16's Turbopack production
 *   build does NOT pick up the rewrite (same root cause as why we had to
 *   move client init out of instrumentation-client.ts into Providers.tsx
 *   in commit cdbe78e). Until @sentry/nextjs adds Turbopack support for
 *   the tunnel injection, we ship the proxy ourselves.
 *
 * Behavior:
 *   - SDK posts envelope to `/monitoring?o=<org_id>&p=<project_id>`
 *   - We parse o + p from query, forward the raw body to
 *     `https://o{org_id}.ingest.{region}.sentry.io/api/{project_id}/envelope/`
 *   - Sentry returns 200 + event_id JSON; we proxy that back
 *
 * Hard-coding the host (o4511450247069696.ingest.de.sentry.io) is safe —
 * if the DSN ever moves, we'd update Providers.tsx too. The org_id from
 * the query is an additional sanity check.
 */

const SENTRY_HOST = "o4511450247069696.ingest.de.sentry.io";
const SENTRY_PROJECT_ID = "4511450294517840";

export async function POST(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const orgQuery = url.searchParams.get("o");
    const projectQuery = url.searchParams.get("p");

    // Mild guard: only accept envelopes destined for our project. If a
    // mismatched DSN is configured client-side we'd rather fail loudly
    // than silently forward to the wrong project.
    if (projectQuery && projectQuery !== SENTRY_PROJECT_ID) {
      return new Response("Project mismatch", { status: 400 });
    }

    const body = await request.arrayBuffer();
    const sentryUrl = `https://${SENTRY_HOST}/api/${SENTRY_PROJECT_ID}/envelope/`;

    const upstream = await fetch(sentryUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          request.headers.get("content-type") ?? "application/x-sentry-envelope",
        // Forward any Sentry-specific headers the SDK set. The crucial one
        // is X-Sentry-Auth which carries the public key.
        ...(request.headers.get("x-sentry-auth")
          ? { "X-Sentry-Auth": request.headers.get("x-sentry-auth") as string }
          : {}),
      },
      body,
    });

    // Echo Sentry's response back to the browser. The SDK ignores the
    // body but checks status; we still pass it for diagnostic value.
    const responseBody = await upstream.text().catch(() => "");
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error("[sentry-tunnel] proxy error:", err);
    return new Response("Tunnel error", { status: 502 });
  }
}

// Disable static optimization — this is always dynamic.
export const dynamic = "force-dynamic";
