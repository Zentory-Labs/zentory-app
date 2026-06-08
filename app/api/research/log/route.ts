import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { Asset, Direction, ResearchContributor } from "@/lib/research";
import { geoBlockCheck } from "@/lib/geo-blocking";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/research/log
 * Logs trading research to Supabase.
 *
 * Phase 1: open to anyone (testnet, no real capital at stake).
 * Phase 2: will be gated by ZENT governance — only proposals passed by
 * token holders can trigger keeper execution.
 */
export async function POST(req: NextRequest) {
  const block = geoBlockCheck(req);
  if (block) return block;

  // Audit DAPP-5: this submission endpoint is open (Phase-1 testnet). Rate-limit
  // per IP to stop bulk signal spam from polluting the signals table / metrics.
  // (Full ZENT-governance gating before mainnet remains future work.)
  const { ok } = await rateLimit(`research-log:ip:${clientIp(req)}`, 20, 60);
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

    const supabase = await createClient();
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
      console.error("[POST /api/research/log]", error.message);
      return NextResponse.json({ error: "Failed to store research" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[POST /api/research/log]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
