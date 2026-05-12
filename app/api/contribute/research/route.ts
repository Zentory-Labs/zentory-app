import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/utils/supabase/server";

function deriveProviderFromApiKey(apiKey: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  return supabase
    .from("api_keys")
    .select("provider, is_active")
    .eq("key_hash", keyHash)
    .single();
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 64) {
      return NextResponse.json({ error: "Missing or invalid x-api-key header" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assetClass = searchParams.get("assetClass") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    let supabase;
    try {
      supabase = await createClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data: keyData, error: keyError } = await deriveProviderFromApiKey(apiKey, supabase);
    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    if (!keyData.is_active) {
      return NextResponse.json({ error: "API key is inactive" }, { status: 403 });
    }
    const provider = keyData.provider as string;

    let query = supabase
      .from("signals")
      .select("id, provider, asset, direction, size, price, status, submitted_at, created_at", { count: "exact" })
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
