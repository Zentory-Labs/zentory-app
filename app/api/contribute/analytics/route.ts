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
    const epochs = parseInt(searchParams.get("epochs") ?? "20", 10);
    const assetClass = searchParams.get("assetClass") ?? undefined;

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
      .from("provider_stats")
      .select("epoch, asset_class, total_signals, resolved_signals, avg_accuracy, total_payout, cumulative_payout")
      .eq("provider", provider)
      .order("epoch", { ascending: false })
      .limit(epochs);

    if (assetClass) {
      query = query.eq("asset_class", assetClass);
    }

    const { data: stats, error: statsError } = await query;

    if (statsError) {
      console.error("[GET /api/contribute/analytics]", statsError.message);
      return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }

    const statsData = stats ?? [];
    const totalResearch = statsData.reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total_signals as number) ?? 0), 0);
    const resolvedResearch = statsData.reduce((sum: number, s: Record<string, unknown>) => sum + ((s.resolved_signals as number) ?? 0), 0);
    const avgAccuracy =
      resolvedResearch > 0
        ? statsData.reduce((sum: number, s: Record<string, unknown>) => sum + ((s.avg_accuracy as number) ?? 0) * ((s.resolved_signals as number) ?? 0), 0) / resolvedResearch
        : 0;
    const totalPayout = statsData.reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total_payout as number) ?? 0), 0);

    const { data: rankData } = await supabase
      .from("provider_stats")
      .select("provider")
      .eq("asset_class", assetClass ?? "CRYPTO_PERP")
      .order("cumulative_payout", { ascending: false })
      .limit(100);

    const rank = rankData
      ? (rankData as Array<{ provider: string }>).findIndex((r: { provider: string }) => r.provider === provider) + 1
      : null;

    const accuracyHistory = [...statsData]
      .reverse()
      .map((s: Record<string, unknown>) => ({
        epoch: s.epoch,
        accuracy: s.avg_accuracy ?? 0,
      }));

    return NextResponse.json({
      totalResearch,
      resolvedResearch,
      avgAccuracy: Math.round(avgAccuracy * 100) / 100,
      totalPayout: Math.round(totalPayout),
      currentRank: rank,
      accuracyHistory,
    });
  } catch (err) {
    console.error("[GET /api/contribute/analytics]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
