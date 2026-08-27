"use client";

/**
 * Per-route error boundary for /trade. Wraps the segment so a server-side
 * render failure (incl. EPIPE on dev-server stdout) renders an honest UI
 * instead of crashing the page or surfacing a noisy Sentry event.
 *
 * Distinct from the root `app/error.tsx` (which gates the whole tree under
 * the root layout) — this one is mounted INSIDE `/trade`'s layout, so the
 * site chrome stays rendering around the fallback.
 */

import { useEffect } from "react";
import Link from "next/link";

const gold = "#b08d57";
const red = "#c2353f";

export default function TradeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Lazy import so the boundary itself stays SSR-cheap and Sentry is not
    // pulled into the initial server bundle for a happy-path render.
    import("@sentry/nextjs")
      .then((Sentry) => {
        try {
          Sentry.captureException(error, { extra: { scope: "trade-route-error" } });
        } catch {
          /* never let reporting break the UI */
        }
      })
      .catch(() => {});
  }, [error]);

  return (
    <div
      className="rounded-2xl p-8 mx-auto my-12 max-w-2xl"
      style={{
        background: "#1c1c21",
        border: `1px solid rgba(194,53,63,0.35)`,
        color: "#eaeaea",
        fontFamily: "var(--font-montserrat), sans-serif",
      }}
      role="alert"
      aria-live="polite"
      data-test="trade-route-error-boundary"
    >
      <div
        className="text-xs uppercase tracking-widest font-semibold mb-3"
        style={{ color: red }}
      >
        Trade page failed to load
      </div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: "#eaeaea" }}>
        We couldn&apos;t fetch live market data
      </h1>
      <p className="text-sm mb-6" style={{ color: "#bfc3c7" }}>
        The trading page hit a transient error. You can retry, or open a vault
        directly while the data feed recovers.
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
          data-test="trade-route-error-retry"
        >
          Try again
        </button>
        <Link
          href="/vaults"
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "transparent",
            color: "#eaeaea",
            border: "1px solid #2a2f3a",
          }}
        >
          Browse vaults
        </Link>
      </div>
    </div>
  );
}
