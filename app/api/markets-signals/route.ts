import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { geoBlockCheck } from "@/lib/geo-blocking";
import { getMarketsSignals, setMarketsSignals } from "@/lib/cache";

/**
 * GET /api/markets-signals
 * Server-side proxy for the Markets page live signal feed.
 * Reads from Supabase directly (no CORS/RPC issues).
 * Cached for 5 minutes via Upstash Redis.
 */
export async function GET(request: Request) {
  const block = geoBlockCheck(request);
  if (block) return block;

  const cached = await getMarketsSignals<{ signals: unknown[]; count: number }>();
  if (cached) {
    return NextResponse.json(cached, { status: 200 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[GET /api/markets-signals] createClient failed:", err);
    return NextResponse.json({ signals: [], error: String(err) }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("signals")
      .select("id, provider, asset, direction, price, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[GET /api/markets-signals] query error:", error.message);
      return NextResponse.json({ signals: [], error: error.message }, { status: 500 });
    }

    const result = { signals: data ?? [], count: data?.length ?? 0 };
    await setMarketsSignals(result);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[GET /api/markets-signals] unexpected error:", err);
    return NextResponse.json({ signals: [], error: String(err) }, { status: 500 });
  }
}
