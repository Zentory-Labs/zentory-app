import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
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
 *
 * Numeric chain_id validation (VAL-DAPP-137). The signals table stores
 * `chain_id` as a Postgres bigint; sending a string like `"abc"` here would
 * either crash the JSON parse in @supabase/supabase-js or silently coerce
 * (NaN) into the column and break the unique-constraint path. Either way
 * the request must be rejected with a 400 BEFORE we hand it to Supabase.
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
    const { provider, asset, direction, size, price, chain_id } = body as {
      provider: ResearchContributor;
      asset: Asset;
      direction: Direction;
      size: number;
      price: number;
      chain_id?: unknown;
    };

    if (!provider || !asset || !direction || typeof size !== "number" || typeof price !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // VAL-DAPP-137: optional chain_id MUST be a JSON number. Any string
    // (including "abc"), `null`, or non-finite number returns 400 with a
    // clear message instead of letting the value reach Supabase.
    if (chain_id !== undefined && chain_id !== null) {
      if (
        typeof chain_id !== "number" ||
        !Number.isFinite(chain_id) ||
        !Number.isInteger(chain_id)
      ) {
        return NextResponse.json(
          { error: "chain_id must be an integer (got non-numeric value)" },
          { status: 400 },
        );
      }
    }

    // Audit #21: anon has no INSERT policy on `signals` any more — this write
    // runs with the service-role key. The rate limit above is the gate.
    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const insertPayload: Record<string, unknown> = {
      provider,
      asset,
      direction,
      size,
      price,
      status: "pending",
      tx_hash: null,
      executed_by: null,
      executor_address: null,
    };
    if (typeof chain_id === "number") {
      insertPayload.chain_id = chain_id;
    }

    const { data, error } = await supabase
      .from("signals")
      .insert(insertPayload)
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
