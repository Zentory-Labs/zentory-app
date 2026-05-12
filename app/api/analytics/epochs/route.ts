import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[GET /api/analytics/epochs] createClient failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("epoch_history")
      .select("epoch_id, avg_accuracy_bps, total_signals, settled_signals, total_payout_zent, start_time, end_time")
      .order("epoch_id", { ascending: false })
      .limit(30);

    if (error) {
      console.error("[GET /api/analytics/epochs] query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const epochs = (data ?? []).map((e) => ({
      epochId: e.epoch_id,
      avgAccuracy: e.avg_accuracy_bps != null ? e.avg_accuracy_bps / 100 : 0,
      totalSignals: e.total_signals ?? 0,
      settledSignals: e.settled_signals ?? 0,
      totalPayoutZent: e.total_payout_zent ?? 0,
      startTime: e.start_time,
      endTime: e.end_time,
    }));

    return NextResponse.json({ epochs });
  } catch (err) {
    console.error("[GET /api/analytics/epochs] unexpected error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
