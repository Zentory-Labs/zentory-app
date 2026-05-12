import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[GET /api/leaderboard/[provider]] createClient failed:", err);
    return NextResponse.json({ epochs: [], error: String(err) }, { status: 500 });
  }

  const { provider } = await params;

  try {
    const { data, error } = await supabase
      .from("epoch_history")
      .select("epoch_id, avg_accuracy_bps, total_payout_zent, settled_signals")
      .eq("provider", provider)
      .order("epoch_id", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[GET /api/leaderboard/[provider]] query error:", error.message);
      return NextResponse.json({ epochs: [], error: error.message }, { status: 500 });
    }

    const epochs = (data ?? []).map((row) => ({
      epochId: Number(row.epoch_id ?? 0),
      avgAccuracyBps: Number(row.avg_accuracy_bps ?? 0),
      totalPayoutZent: (Number(row.total_payout_zent ?? 0) / 1e18).toFixed(4),
      settledSignals: Number(row.settled_signals ?? 0),
    }));

    return NextResponse.json({ epochs, count: epochs.length });
  } catch (err) {
    console.error("[GET /api/leaderboard/[provider]] unexpected error:", err);
    return NextResponse.json({ epochs: [], error: String(err) }, { status: 500 });
  }
}
