/**
 * Custom 404 page. Next.js renders this for any unmatched route.
 *
 * Implements VAL-DAPP-135: the page renders the canonical "This page could
 * not be found" copy so the validation probe sees the expected text + 404
 * status, with a recovery affordance to get back to a known-good surface.
 *
 * Uses inline styles (not CSS modules) to match the rest of the dApp.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page not found · ZENTORY",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div
      className="rounded-2xl p-10 mx-auto my-16 max-w-2xl text-center"
      style={{
        background: "#1c1c21",
        border: "1px solid #2a2f3a",
        color: "#eaeaea",
        fontFamily: "var(--font-montserrat), sans-serif",
      }}
      data-test="not-found"
    >
      <div
        className="text-xs uppercase tracking-widest font-semibold mb-3"
        style={{ color: "#b08d57" }}
      >
        ZENTORY · 404
      </div>
      <h1
        className="text-5xl font-black mb-4"
        style={{
          color: "#c2353f",
          fontFamily: "var(--font-montserrat), sans-serif",
        }}
      >
        404
      </h1>
      <p className="text-lg font-semibold mb-2" style={{ color: "#eaeaea" }}>
        This page could not be found.
      </p>
      <p className="text-sm mb-8" style={{ color: "#bfc3c7" }}>
        The URL you followed doesn&apos;t match any surface we ship. Check the
        address bar, or pick a destination below.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "#b08d57",
            color: "#0b0b0d",
            border: "1px solid #b08d57",
          }}
          data-test="not-found-home"
        >
          Back to home
        </Link>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "transparent",
            color: "#eaeaea",
            border: "1px solid #2a2f3a",
          }}
        >
          Dashboard
        </Link>
        <Link
          href="/track-record"
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "transparent",
            color: "#eaeaea",
            border: "1px solid #2a2f3a",
          }}
        >
          Track record
        </Link>
      </div>
    </div>
  );
}
