import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
// Audit #21: `api_keys` is the authn root for this surface and is no longer
// anon-readable, and `signals` / `provider_stats` have no anon write policy.
// Audit #22 (Q16): the gate below enforces `expires_at`. The whole route
// family runs on the service-role key; the x-api-key check is the authn gate.
import { createAdminClient } from "@/utils/supabase/admin";
import { requireValidApiKey, apiKeyErrorResponse } from "../_auth";

export async function GET(req: NextRequest) {
  let keyRow;
  try {
    keyRow = await requireValidApiKey(req);
  } catch (e) {
    const resp = apiKeyErrorResponse(e);
    if (resp) return resp;
    throw e;
  }
  const provider = keyRow.provider;
  const apiKey = req.headers.get("x-api-key") ?? "";

  try {
    const { searchParams } = new URL(req.url);
    const assetClass = searchParams.get("assetClass") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    // Touch last_used_at so the API-keys page can surface "last seen" honestly.
    await supabase
      .from("api_keys")
      .update({ last_used_at: Math.floor(Date.now() / 1000) })
      .eq("id", keyRow.id);

    let query = supabase
      .from("signals")
      .select("id, signal_id, provider, asset, asset_class, asset_id, direction, confidence, expires_at, status, submitted_at, created_at, accuracy_bps, payout_zent", { count: "exact" })
      .eq("provider", provider)
      .order("submitted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (assetClass) query = query.eq("asset_class", assetClass);
    if (status) query = query.eq("status", status);

    const { data: signals, error: signalsError, count } = await query;

    if (signalsError) {
      console.error("[GET /api/contribute/research]", signalsError.message);
      return NextResponse.json({ error: "Failed to fetch research" }, { status: 500 });
    }

    return NextResponse.json({
      research: signals ?? [],
      total: count ?? 0,
    });
  } catch (err) {
    console.error("[GET /api/contribute/research]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
