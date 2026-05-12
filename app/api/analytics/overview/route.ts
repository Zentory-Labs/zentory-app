import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[GET /api/analytics/overview] createClient failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("signals")
      .select("accuracy_bps, payout_zent, provider, asset_class");

    if (error) {
      console.error("[GET /api/analytics/overview] query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const signals = data ?? [];
    const withAccuracy = signals.filter((s) => s.accuracy_bps != null);
    const totalSignals = withAccuracy.length;

    const overallAccuracy =
      totalSignals > 0
        ? withAccuracy.reduce((sum, s) => sum + (s.accuracy_bps ?? 0), 0) / totalSignals
        : 0;

    const wins = withAccuracy.filter((s) => s.accuracy_bps > 5000).length;
    const winRate = totalSignals > 0 ? (wins / totalSignals) * 100 : 0;

    const totalRewardsZent = signals
      .filter((s) => (s.payout_zent ?? 0) > 0)
      .reduce((sum, s) => sum + (s.payout_zent ?? 0), 0);

    const totalSlashesZent = signals
      .filter((s) => (s.payout_zent ?? 0) < 0)
      .reduce((sum, s) => sum + Math.abs(s.payout_zent ?? 0), 0);

    const uniqueProviders = new Set(signals.map((s) => s.provider)).size;

    // Best/worst asset class
    const classStats: Record<
      string,
      { total: number; sum: number }
    > = {};
    for (const s of withAccuracy) {
      const ac = s.asset_class ?? "UNKNOWN";
      if (!classStats[ac]) classStats[ac] = { total: 0, sum: 0 };
      classStats[ac].total++;
      classStats[ac].sum += s.accuracy_bps ?? 0;
    }
    let bestAssetClass = "—";
    let worstAssetClass = "—";
    let bestAvg = -Infinity;
    let worstAvg = Infinity;
    for (const [ac, stats] of Object.entries(classStats)) {
      if (stats.total > 0) {
        const avg = stats.sum / stats.total;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestAssetClass = ac;
        }
        if (avg < worstAvg) {
          worstAvg = avg;
          worstAssetClass = ac;
        }
      }
    }

    return NextResponse.json({
      totalSignals,
      overallAccuracy: Math.round(overallAccuracy) / 100,
      winRate: Math.round(winRate * 10) / 10,
      totalRewardsZent: totalRewardsZent.toFixed(4),
      totalSlashesZent: totalSlashesZent.toFixed(4),
      uniqueProviders,
      bestAssetClass,
      worstAssetClass,
    });
  } catch (err) {
    console.error("[GET /api/analytics/overview] unexpected error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
