import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { Asset, Direction, ResearchContributor } from "@/lib/research";
import { geoBlockCheck } from "@/lib/geo-blocking";

export async function GET(request: Request) {
  const block = geoBlockCheck(request);
  if (block) return block;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("signals")
      .select("id, provider, asset, direction, price, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[GET /api/research]", error.message);
      return NextResponse.json({ error: "Failed to fetch research" }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[GET /api/research]", err);
    return NextResponse.json({ error: "Failed to fetch research" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const block = geoBlockCheck(req);
  if (block) return block;

  try {
    const body = await req.json();
    const { provider, asset, direction, size, price } = body as {
      provider: ResearchContributor;
      asset: Asset;
      direction: Direction;
      size: number;
      price: number;
    };

    if (!provider || !asset || !direction || typeof size !== "number" || typeof price !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let supabase;
    try {
      supabase = await createClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("signals")
      .insert({
        provider,
        asset,
        direction,
        size,
        price,
        status: "pending",
        tx_hash: null,
        executed_by: null,
        executor_address: null,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/research]", error.message);
      return NextResponse.json({ error: "Failed to store research" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[POST /api/research]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
