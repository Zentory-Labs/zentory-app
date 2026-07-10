"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { demoActivity, fmtTimeAgo, type DemoActivityItem } from "@/lib/demo/data";

/**
 * Rolling list of recent protocol activity — deposits, signals, fills,
 * subscriptions, stakes, epoch settlements. Tells the "live and busy"
 * story to investors on /home and /state-of-protocol.
 *
 * Live mode: shows the honest empty state ("Activity ingestion goes live
 * with mainnet"). Demo mode: shows the seeded sample feed + a Sample badge.
 */
const ICONS: Record<DemoActivityItem["kind"], string> = {
  deposit: "↓",
  withdrawal: "↑",
  signal: "✦",
  subscribe: "★",
  stake: "◇",
  epoch: "⟳",
};

const ICON_COLOR: Record<DemoActivityItem["kind"], string> = {
  deposit: "#34d399",
  withdrawal: "#c2353f",
  signal: "#c2353f",
  subscribe: "#b08d57",
  stake: "#b08d57",
  epoch: "#b08d57",
};

interface Props {
  /** Max rows to show. Defaults to 8. */
  limit?: number;
  /** Optional title; defaults to "Recent Activity". */
  title?: string;
}

export default function RecentActivityTicker({ limit = 8, title = "Recent Activity" }: Props) {
  const { enabled: demoMode } = useDemoMode();
  const [items, setItems] = useState<DemoActivityItem[]>([]);

  // Refresh fmtTimeAgo every 30s so timestamps stay current without
  // re-rendering the data itself.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (demoMode) {
      setItems(demoActivity(limit + 4)); // pull a few extra so older rows feel real
    } else {
      setItems([]);
    }
  }, [demoMode, limit]);

  const rows = useMemo(() => items.slice(0, limit), [items, limit]);

  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold uppercase tracking-widest inline-flex items-center gap-2"
          style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), var(--font-montserrat), sans-serif" }}
        >
          {title}
          {demoMode && <DemoBadge />}
        </h3>
        <Link
          href="/state-of-protocol"
          className="text-xs transition-colors hover:underline"
          style={{ color: "#b08d57" }}
        >
          See all →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: "#6a6f75" }}>
          Activity ingestion goes live with mainnet (Q4 2026).
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, idx) => (
            <li
              key={`${row.ts}-${idx}`}
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover:bg-white/[0.02]"
            >
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0"
                style={{
                  background: `${ICON_COLOR[row.kind]}1a`,
                  color: ICON_COLOR[row.kind],
                  border: `1px solid ${ICON_COLOR[row.kind]}33`,
                }}
                aria-hidden
              >
                {ICONS[row.kind]}
              </span>
              <span className="flex-1 text-sm" style={{ color: "#eaeaea", fontFamily: "var(--font-montserrat), var(--font-montserrat), sans-serif" }}>
                {row.text}
              </span>
              <span
                className="text-xs flex-shrink-0"
                style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), var(--font-montserrat), sans-serif" }}
              >
                {fmtTimeAgo(row.ts)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
