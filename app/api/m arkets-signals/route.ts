import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/markets-signals
 * Server-side proxy for the Markets page live signal feed.
 * Reads from Supabase directly (no CORS/RPC issues).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("signals")
      .select("id, provider, asset, direction, price, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[GET /api/markets-signals]", error.message);
      return NextResponse.json({ signals: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signals: data ?? [] });
  } catch (err) {
    console.error("[GET /api/markets-signals]", err);
    return NextResponse.json({ signals: [] }, { status: 500 });
  }
}
