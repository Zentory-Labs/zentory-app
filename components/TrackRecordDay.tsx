"use client";

import { useEffect, useState } from "react";

/**
 * Canonical "Day N of 90" counter — drives the mainnet-gate progress shown on
 * the dApp homepage, /track-record, and (parity source of truth) the marketing
 * site's /roadmap + homepage. The window starts 2026-06-08T00:00Z and is
 * capped at 90 days (the mainnet-gate live-track-record minimum).
 *
 * Single source of truth: this formula. The marketing site mirrors it
 * (zentorylabs.com/components/TrackRecordDay.tsx). Keep the two in sync; if
 * you change the start date or cap, change both files in the same commit.
 *
 * Computed client-side (in useEffect) so:
 *   1. SSR never bakes in a stale day count.
 *   2. The first paint shows "Day — of 90" (no hydration mismatch).
 *   3. The counter advances every midnight UTC without a re-render loop.
 */
const TRACK_RECORD_START_MS = Date.UTC(2026, 5, 8); // 2026-06-08T00:00Z
const TRACK_RECORD_CAP_DAYS = 90;

export function trackRecordDay(now: number = Date.now()): number {
  const elapsedDays = Math.floor((now - TRACK_RECORD_START_MS) / 86_400_000) + 1;
  return Math.min(TRACK_RECORD_CAP_DAYS, Math.max(1, elapsedDays));
}

interface TrackRecordDayProps {
  /** Render the parenthesized mainnet-gate form ("Day N of 90") instead of just "Day N". */
  of90?: boolean;
  /** Class applied to the wrapping <span>. Defaults to inline. */
  className?: string;
  /** data-test attribute for Playwright selectors (default: "track-record-day"). */
  testId?: string;
}

/**
 * The "Day N" counter used on every investor-facing surface so all three
 * stay numerically identical (VAL-FLOW-068).
 *
 * Examples:
 *   <TrackRecordDay />                 → "Day 81"
 *   <TrackRecordDay of90 />            → "Day 81 of 90"
 */
export default function TrackRecordDay({
  of90 = false,
  className,
  testId = "track-record-day",
}: TrackRecordDayProps) {
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => {
    // The day counter is a client-only computed value. We start at `null`
    // so the first paint matches the server-rendered HTML, then fill it in
    // after hydration. The eslint-disable covers the Next 16
    // `react-hooks/set-state-in-effect` rule, which would otherwise flag
    // this exact "compute on mount, avoid SSR hydration mismatch" pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(trackRecordDay());
  }, []);

  return (
    <span className={className} data-test={testId}>
      Day {day ?? "—"}
      {of90 ? <> of {TRACK_RECORD_CAP_DAYS}</> : null}
    </span>
  );
}
