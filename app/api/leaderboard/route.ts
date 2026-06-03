import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getLeaderboard, setLeaderboard } from "@/lib/cache";

export async function GET() {
  // Try cache first
  const cached = await getLeaderboard<{ providers: unknown[]; count: number }>();
  if (cached) {
    return NextResponse.json(cached, { status: 200 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    // Public read endpoint: "Supabase not configured yet" is a normal early state
    // (the indexer hasn't populated provider_stats / env vars not set). Degrade to
    // an empty leaderboard with 200 so the page shows its honest empty state instead
    // of logging 500s; warn server-side so the misconfig stays discoverable.
    console.warn("[GET /api/leaderboard] Supabase not configured; returning empty leaderboard:", String(err));
    return NextResponse.json({ providers: [], count: 0, degraded: "supabase-unconfigured" }, { status: 200 });
  }

  try {
    const { data, error } = await supabase
      .from("provider_stats")
      .select(
        "provider, total_signals, resolved_signals, avg_accuracy_bps, total_payout_zent, current_rank, last_signal_at, zent_staked"
      )
      .order("current_rank", { ascending: true })
      .limit(50);

    if (error) {
      // e.g. provider_stats not created yet — show empty, don't 500.
      console.warn("[GET /api/leaderboard] query failed; returning empty leaderboard:", error.message);
      return NextResponse.json({ providers: [], count: 0, degraded: "query-error" }, { status: 200 });
    }

    const providers = (data ?? []).map((row) => {
      const addr = row.provider ?? "0x0000000000000000000000000000000000000000";
      const accuracyBps = Number(row.avg_accuracy_bps ?? 0);
      const accuracyPercent = accuracyBps / 100;
      const grade =
        accuracyPercent >= 80 ? "A+" :
        accuracyPercent >= 70 ? "A"  :
        accuracyPercent >= 60 ? "B"  :
        accuracyPercent >= 50 ? "C"  : "D";

      const zentPayout = Number(row.total_payout_zent ?? 0);
      const zentEarned = (zentPayout / 1e18).toFixed(4);

      // provider_stats.last_signal_at is a bigint epoch in SECONDS → ms for Date math.
      const lastSignalMs = row.last_signal_at
        ? Number(row.last_signal_at) * 1000
        : Date.now();
      const hoursAgo = Math.floor((Date.now() - lastSignalMs) / 3_600_000);
      const lastSignal = hoursAgo <= 0 ? "<1h ago" : `${hoursAgo}h ago`;

      return {
        rank: Number(row.current_rank ?? 0),
        provider: addr,
        providerShort: addr.slice(0, 6) + "..." + addr.slice(-4),
        totalSignals: Number(row.total_signals ?? 0),
        resolvedSignals: Number(row.resolved_signals ?? 0),
        accuracyPercent,
        accuracyGrade: grade,
        zentEarned,
        lastSignal,
        assetClasses: ["CRYPTO_PERP", "EQUITY"] as string[],
      };
    });

    const result = { providers, count: providers.length };
    await setLeaderboard(result);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.warn("[GET /api/leaderboard] unexpected error; returning empty leaderboard:", err);
    return NextResponse.json({ providers: [], count: 0, degraded: "error" }, { status: 200 });
  }
}
