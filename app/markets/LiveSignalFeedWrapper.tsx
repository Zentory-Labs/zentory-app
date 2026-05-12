"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface RecentSignal {
  id: string;
  provider: string;
  market: string;
  direction: "BUY" | "SELL";
  price: number;
  confidence: number;
  time: string;
  assetClass: string;
}

const MOCK_MARKETS = [
  { symbol: "BTC-PERP", assetClass: "CRYPTO_PERP", avgAccuracy: 67 },
  { symbol: "ETH-PERP", assetClass: "CRYPTO_PERP", avgAccuracy: 61 },
  { symbol: "SOL-PERP", assetClass: "CRYPTO_PERP", avgAccuracy: 58 },
  { symbol: "XRP-PERP", assetClass: "CRYPTO_PERP", avgAccuracy: 54 },
  { symbol: "AAPL", assetClass: "EQUITY", avgAccuracy: 55 },
];

const ASSET_CLASS_COLORS: Record<string, string> = {
  CRYPTO_SPOT: "#B08D57",
  CRYPTO_PERP: "#B08D57",
  EQUITY: "#627EEA",
  FOREX: "#14F195",
  COMMODITY: "#F7931A",
};

interface LiveSignalFeedProps {
  signals?: RecentSignal[];
}

export default function LiveSignalFeedWrapper({ signals: initialSignals }: LiveSignalFeedProps) {
  const [signals, setSignals] = useState<RecentSignal[]>(initialSignals ?? []);

  const fetchSignals = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("signals")
        .select("id, provider, asset, direction, price, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error || !data || data.length === 0) return;

      const mapped: RecentSignal[] = data.map((s: Record<string, unknown>) => {
        const assetLower = (s.asset as string).toLowerCase();
        const market = MOCK_MARKETS.find((m) =>
          m.symbol.toLowerCase().startsWith(assetLower) ||
          assetLower.startsWith(m.symbol.toLowerCase().replace("-perp", ""))
        );
        const hoursAgo = s.created_at
          ? Math.floor((Date.now() - new Date(s.created_at as string).getTime()) / 3600000)
          : 0;
        return {
          id: s.id as string,
          provider: (s.provider as string) === "gp" ? "Genesis Pulse"
            : (s.provider as string) === "lumibot" ? "Lumibot" : "Manual",
          market: market?.symbol ?? `${s.asset}-PERP`,
          direction: (s.direction as string) === "LONG" ? "BUY" : "SELL",
          price: s.price as number,
          confidence: market?.avgAccuracy ?? 65,
          time: hoursAgo <= 0 ? "<1h ago" : `${hoursAgo}h ago`,
          assetClass: market?.assetClass ?? "CRYPTO_PERP",
        };
      });
      setSignals(mapped);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, 30_000);
    return () => clearInterval(id);
  }, [fetchSignals]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
        <h2 className="text-lg font-bold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
          Live Research Feed
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", fontFamily: "'Montserrat', sans-serif" }}>
          auto-refresh 30s
        </span>
      </div>
      <div
        className="rounded-2xl overflow-hidden divide-y"
        style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
      >
        {signals.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: "rgba(234,234,234,0.4)" }}>
            No recent research
          </div>
        ) : (
          signals.slice(0, 8).map((sig) => {
            const color = ASSET_CLASS_COLORS[sig.assetClass] ?? "#B08D57";
            return (
              <div key={sig.id} className="flex items-center gap-4 px-5 py-3.5">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold font-mono"
                  style={{
                    background: sig.direction === "BUY" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    color: sig.direction === "BUY" ? "#22c55e" : "#ef4444",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {sig.direction}
                </span>
                <span className="text-sm font-semibold" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
                  {sig.provider}
                </span>
                <span className="text-xs" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
                  on
                </span>
                <span className="text-sm font-bold" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
                  {sig.market}
                </span>
                <span className="text-xs" style={{ color: "rgba(234,234,234,0.3)", fontFamily: "'Montserrat', sans-serif" }}>
                  @
                </span>
                <span className="text-sm font-mono" style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}>
                  {sig.price > 100 ? `$${sig.price.toLocaleString()}` : sig.price.toFixed(4)}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs font-mono" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
                    {sig.confidence}%
                  </span>
                  <span className="text-xs" style={{ color: "rgba(234,234,234,0.3)", fontFamily: "'Montserrat', sans-serif" }}>
                    {sig.time}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
