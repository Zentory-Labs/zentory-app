import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
// Audit #21: `api_keys` is the authn root for this surface and is no longer
// anon-readable, and `signals` / `provider_stats` have no anon write policy.
// Audit #22 (Q16): the gate below enforces `expires_at`. The whole route
// family runs on the service-role key; the x-api-key check is the authn gate.
import { createAdminClient } from "@/utils/supabase/admin";
import { requireValidApiKey, apiKeyErrorResponse, ApiKeyRow } from "./_auth";

const VALID_ASSET_CLASSES = ["CRYPTO_PERP", "CRYPTO_SPOT", "EQUITY", "FOREX", "COMMODITY"] as const;
const VALID_ASSETS = ["BTC", "ETH", "SOL", "XRP", "AAPL", "TSLA", "NVDA", "MSFT", "EURUSD", "GBPUSD", "GOLD", "OIL"] as const;
type AssetClass = (typeof VALID_ASSET_CLASSES)[number];
type Asset = (typeof VALID_ASSETS)[number];

export async function POST(req: NextRequest) {
  let keyRow: ApiKeyRow;
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
    const body = await req.json();
    const { assetClass, assetId, direction, confidence, expiresAt } = body as {
      assetClass?: string;
      assetId?: string;
      direction?: number;
      confidence?: number;
      expiresAt?: number;
    };

    if (!assetClass || !VALID_ASSET_CLASSES.includes(assetClass as AssetClass)) {
      return NextResponse.json({ error: `Invalid assetClass. Must be one of: ${VALID_ASSET_CLASSES.join(", ")}` }, { status: 400 });
    }
    if (!assetId || !VALID_ASSETS.includes(assetId as Asset)) {
      return NextResponse.json({ error: `Invalid assetId. Must be one of: ${VALID_ASSETS.join(", ")}` }, { status: 400 });
    }
    if (typeof direction !== "number" || direction < -10000 || direction > 10000) {
      return NextResponse.json({ error: "direction must be a number between -10000 and 10000" }, { status: 400 });
    }
    if (typeof confidence !== "number" || confidence < 1 || confidence > 10000) {
      return NextResponse.json({ error: "confidence must be a number between 1 and 10000" }, { status: 400 });
    }
    const now = Math.floor(Date.now() / 1000);
    const maxExpiry = now + 7 * 24 * 60 * 60;
    if (!expiresAt || typeof expiresAt !== "number" || expiresAt <= now || expiresAt > maxExpiry) {
      return NextResponse.json({ error: "expiresAt must be a unix timestamp greater than now and less than now + 7 days" }, { status: 400 });
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    await supabase
      .from("api_keys")
      .update({ last_used_at: now })
      .eq("key_hash", createHash("sha256").update(apiKey).digest("hex"));

    const signalId = `0x${Buffer.from(crypto.randomUUID().replace(/-/g, ""), "hex").slice(0, 32).toString("hex")}`;

    const { data: signalData, error: signalError } = await supabase
      .from("signals")
      .insert({
        signal_id: signalId,
        provider,
        asset_class: assetClass,
        asset_id: assetId,
        direction,
        confidence,
        expires_at: expiresAt,
        status: "Active",
        submitted_at: now,
      })
      .select("id")
      .single();

    if (signalError) {
      console.error("[POST /api/contribute] research insert error:", signalError.message);
      return NextResponse.json({ error: "Failed to store research" }, { status: 500 });
    }

    return NextResponse.json(
      { researchId: signalId, dbId: signalData.id, message: "Research submitted successfully — keeper will submit to chain" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/provider]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
