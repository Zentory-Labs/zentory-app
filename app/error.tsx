"use client";

/**
 * Per-route error boundary. Next.js App Router invokes this when a Server
 * Component or Client Component below the segment throws. Anything thrown
 * here is forwarded to the global error boundary (`app/global-error.tsx`)
 * only if this component itself throws — so we MUST render a fallback here.
 *
 * The boundary exists for VAL-DAPP-134:
 *   - Renders an honest empty/error UI instead of a blank page or default
 *     Next.js stack trace.
 *   - Captures the exception to Sentry (handles are off; PII scrubbed in
 *     sentry.server.config.ts + lib/sentry-scrub.ts).
 *   - Provides a recovery affordance — "Try again" resets the segment.
 *   - The site chrome (Nav, footer) keeps rendering because the boundary
 *     is mounted INSIDE the root layout.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

const gold = "#b08d57";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Forward to Sentry so the team can see what blew up. The Providers
    // mounted-gate + sendDefaultPii:false means no user identity leaks.
    // We tag with `scope: "route-error"` so this is filterable in the
    // dashboard.
    try {
      Sentry.captureException(error, { extra: { scope: "route-error" } });
    } catch {
      // never let reporting break the UI
    }
  }, [error]);

  return (
    <div
      className="rounded-2xl p-8 mx-auto my-12 max-w-2xl"
      style={{
        background: "#1c1c21",
        border: "1px solid rgba(194,53,63,0.35)",
        color: "#eaeaea",
        fontFamily: "var(--font-montserrat), sans-serif",
      }}
      role="alert"
      aria-live="polite"
      data-test="route-error-boundary"
    >
      <div
        className="text-xs uppercase tracking-widest font-semibold mb-3"
        style={{ color: "#c2353f" }}
      >
        Something went wrong
      </div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: "#eaeaea" }}>
        We couldn&apos;t render this page
      </h1>
      <p className="text-sm mb-6" style={{ color: "#bfc3c7" }}>
        The error has been recorded. You can try the page again, or head back to
        the homepage and keep exploring.
      </p>

      {error.digest && (
        <div
          className="text-xs mb-6 px-3 py-2 rounded font-mono break-all"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid #2a2f3a",
            color: "#6a6f75",
            fontFamily: "var(--font-space-mono), monospace",
          }}
        >
          ref: {error.digest}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: gold,
            color: "#0b0b0d",
            border: "1px solid #b08d57",
          }}
          data-test="route-error-retry"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "transparent",
            color: "#eaeaea",
            border: "1px solid #2a2f3a",
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
