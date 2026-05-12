import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[GET /api/analytics/asset-classes] createClient failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("signals")
      .select("asset_class, accuracy_bps, payout_zent, provider")
      .not("accuracy_bps", "is", null);

    if (error) {
      console.error("[GET /api/analytics/asset-classes] query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const signals = data ?? [];

    const groups: Record<
      string,
      { total: number; accuracySum: number; wins: number; payoutSum: number; providers: Set<string> }
    > = {};

    for (const s of signals) {
      const ac = s.asset_class ?? "UNKNOWN";
      if (!groups[ac]) {
        groups[ac] = { total: 0, accuracySum: 0, wins: 0, payoutSum: 0, providers: new Set() };
      }
      groups[ac].total++;
      groups[ac].accuracySum += s.accuracy_bps ?? 0;
      if ((s.accuracy_bps ?? 0) > 5000) groups[ac].wins++;
      groups[ac].payoutSum += s.payout_zent ?? 0;
      if (s.provider) groups[ac].providers.add(s.provider);
    }

    const result = Object.entries(groups)
      .map(([asset_class, g]) => ({
        assetClass: asset_class,
        totalSignals: g.total,
        avgAccuracy: g.total > 0 ? g.accuracySum / g.total / 100 : 0,
        winRate: g.total > 0 ? (g.wins / g.total) * 100 : 0,
        netPayoutZent: g.payoutSum,
        providers: g.providers.size,
      }))
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy);

    return NextResponse.json({ assetClasses: result });
  } catch (err) {
    console.error("[GET /api/analytics/asset-classes] unexpected error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
