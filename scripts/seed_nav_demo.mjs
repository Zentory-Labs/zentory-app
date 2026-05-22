// One-off seed for the investor demo: 14 days of fresh zBTC NAV history
// ending NOW so the vault chart isn't empty during the demo.
//
// RLS on public.vault_nav_history allows insert with check (true), so the
// anon (publishable) key is sufficient — no service role key needed.
//
// Usage:  node scripts/seed_nav_demo.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const VAULTS = [
  { symbol: "zBTC", initialNav: 1.0, dailyDrift: 0.0015, vol: 0.0008, totalAssetsRaw: 5_00000000 },
  { symbol: "zETH", initialNav: 1.0, dailyDrift: 0.0012, vol: 0.0007, totalAssetsRaw: 80_000000000000000000n },
  { symbol: "zSOL", initialNav: 1.0, dailyDrift: 0.0009, vol: 0.0010, totalAssetsRaw: 1200_000000000000000000n },
  { symbol: "zXRP", initialNav: 1.0, dailyDrift: 0.0008, vol: 0.0006, totalAssetsRaw: 50000_000000n },
];

const HOURS = 14 * 24; // 14 days, hourly cadence
const now = Date.now();
const startMs = now - HOURS * 3600 * 1000;

const rowsByVault = {};
for (const v of VAULTS) {
  rowsByVault[v.symbol] = [];
  let nav = v.initialNav;
  let hodl = v.initialNav;
  const hourlyDrift = v.dailyDrift / 24;
  for (let h = 0; h <= HOURS; h++) {
    const ts = new Date(startMs + h * 3600 * 1000);
    const navNoise = (Math.random() - 0.5) * v.vol;
    const hodlNoise = (Math.random() - 0.5) * v.vol * 0.5;
    nav = nav * (1 + hourlyDrift + navNoise);
    hodl = hodl * (1 + hourlyDrift * 0.55 + hodlNoise);
    const alpha = ((nav - hodl) / hodl) * 100;
    rowsByVault[v.symbol].push({
      vault_symbol: v.symbol,
      snapshot_at: ts.toISOString(),
      nav_per_share: Number(nav.toFixed(6)),
      total_assets: typeof v.totalAssetsRaw === "bigint" ? v.totalAssetsRaw.toString() : v.totalAssetsRaw,
      hodl_nav: Number(hodl.toFixed(6)),
      alpha_pct: Number(alpha.toFixed(4)),
    });
  }
}

// Remove any rows in the same 14-day window first to avoid double-seeding
for (const v of VAULTS) {
  const { error } = await supabase
    .from("vault_nav_history")
    .delete()
    .eq("vault_symbol", v.symbol)
    .gte("snapshot_at", new Date(startMs).toISOString());
  if (error) console.error(`[delete ${v.symbol}] ${error.message}`);
}

let total = 0;
for (const v of VAULTS) {
  const rows = rowsByVault[v.symbol];
  // Chunk inserts at 500 rows
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("vault_nav_history").insert(chunk);
    if (error) {
      console.error(`[insert ${v.symbol} chunk ${i}] ${error.message}`);
      process.exit(1);
    }
    total += chunk.length;
  }
  const last = rows[rows.length - 1];
  console.log(
    `${v.symbol}: ${rows.length} rows, final NAV ${last.nav_per_share}, alpha ${last.alpha_pct}%`
  );
}

console.log(`\nSeeded ${total} rows across ${VAULTS.length} vaults.`);
