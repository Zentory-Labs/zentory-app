import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { Asset, Direction, ResearchContributor } from "@/lib/research";
import { geoBlockCheck } from "@/lib/geo-blocking";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const block = geoBlockCheck(request);
  if (block) return block;
  // Supabase is intentionally offline pre-mainnet. Return an empty list so the
  // public /research page renders an honest empty state instead of a red
  // "Failed to load research." banner.
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("signals")
      .select("id, provider, asset, direction, price, status, created_at, tx_hash")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[GET /api/research]", error.message);
      return NextResponse.json([], { status: 200 });
    }
    // The signals table still holds April 2026 demo seed rows (includes SHORT
    // directions the spot vaults never trade). Their synthetic tx_hash values
    // are 73 chars with long zero-runs — a real EVM tx hash is exactly 66 hex
    // chars. Only rows backed by a structurally valid hash are public; the
    // rest stay in the DB but the page renders its honest empty state.
    const rows = (data ?? []).filter(
      (r: { tx_hash?: string | null }) =>
        typeof r.tx_hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(r.tx_hash),
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/research]", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const block = geoBlockCheck(req);
  if (block) return block;

  // Audit DAPP-5: open submission endpoint — rate-limit per IP to stop bulk
  // signal spam. (Full ZENT-governance gating before mainnet remains future work.)
  const { ok } = await rateLimit(`research-submit:ip:${clientIp(req)}`, 20, 60);
  if (!ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

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
