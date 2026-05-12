#!/usr/bin/env node
/**
 * Seed script — populates Supabase with test signals using the REST API.
 * Run: node scripts/seed_signals.js
 */

const SUPABASE_URL = "https://kwofgouhrdnolkatznor.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_KEY) {
  console.error("❌  Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY env var");
  process.exit(1);
}

const ASSETS = ["BTC", "ETH", "SOL", "XRP"];
const PROVIDERS = ["gp", "lumibot", "manual"];
const DIRECTIONS = ["LONG", "SHORT"];
const NOW = Math.floor(Date.now() / 1000);
const ONE_HOUR = 3600;

async function restUpsert(table, records) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(records),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`   ⚠️  ${table}: ${text.slice(0, 200)}`);
    return false;
  }
  console.log(`   ✅ ${table}: ${records.length} rows`);
  return true;
}

async function main() {
  // Build signals — existing schema columns only
  const signals = [];
  for (let i = 0; i < 60; i++) {
    const createdAt = new Date((NOW - i * ONE_HOUR * 2) * 1000);
    const asset = ASSETS[i % ASSETS.length];
    const provider = PROVIDERS[i % PROVIDERS.length];
    const direction = DIRECTIONS[i % 2];
    const basePrices = { BTC: 96500, ETH: 3420, SOL: 140, XRP: 2.3 };
    const price = basePrices[asset] * (1 + (Math.random() - 0.5) * 0.05);
    const size = (i % 5 + 1) * 0.1;

    signals.push({
      provider,
      asset,
      direction,
      size,
      price: Math.round(price * 100) / 100,
      status: i < 5 ? "pending" : i < 50 ? "executed" : "failed",
      tx_hash: i < 50 ? `0x${Math.random().toString(16).slice(2)}${i.toString().padStart(60, "0")}` : null,
      executed_by: i < 50 ? `0x${Math.random().toString(16).slice(2)}${(i + 100).toString().padStart(60, "0")}` : null,
      executor_address: i < 50 ? `0x${Math.random().toString(16).slice(2)}${(i + 200).toString().padStart(60, "0")}` : null,
    });
  }

  // Build provider_stats
  const providerStats = PROVIDERS.map((_, i) => ({
    provider: `0x${(i + 10).toString(16).padStart(40, "0")}${"a".repeat(24)}`,
    total_signals: 20 + i * 5,
    resolved_signals: 15 + i * 4,
    avg_accuracy_bps: 5500 + i * 300,
    total_payout_zent: (Math.floor(Math.random() * 50000) * 10 ** 18).toString(),
    current_rank: i + 1,
    last_signal_at: NOW - i * ONE_HOUR,
    updated_at: NOW,
  }));

  // Build epochs
  const epochs = [
    { epoch_id: 1, start_time: NOW - ONE_HOUR * 8, end_time: NOW - ONE_HOUR * 4, total_signals: 12, settled_signals: 12, settled: true, settled_at: NOW - ONE_HOUR * 4 },
    { epoch_id: 2, start_time: NOW - ONE_HOUR * 4, end_time: NOW, total_signals: 8, settled_signals: 0, settled: false, settled_at: null },
  ];

  // Build subscriptions
  const subscriptions = [
    { subscriber: "0x1234567890123456789012345678901234567890", tier_id: 0, tier_name: "BASIC", token_id: 1, asset_class_bitmap: "0x01", expiration: NOW + 30 * 24 * ONE_HOUR, zent_paid: (100n * 10n ** 18n).toString(), subscribed_at: NOW - 5 * 24 * ONE_HOUR, cancelled_at: null, refund_zent: null },
    { subscriber: "0x2345678901234567890123456789012345678901", tier_id: 1, tier_name: "PRO", token_id: 2, asset_class_bitmap: "0x03", expiration: NOW + 20 * 24 * ONE_HOUR, zent_paid: (500n * 10n ** 18n).toString(), subscribed_at: NOW - 10 * 24 * ONE_HOUR, cancelled_at: null, refund_zent: null },
    { subscriber: "0x3456789012345678901234567890123456789012", tier_id: 2, tier_name: "ELITE", token_id: 3, asset_class_bitmap: "0x1F", expiration: NOW + 25 * 24 * ONE_HOUR, zent_paid: (2000n * 10n ** 18n).toString(), subscribed_at: NOW - 3 * 24 * ONE_HOUR, cancelled_at: null, refund_zent: null },
  ];

  console.log("🌱  Seeding signals...");
  await restUpsert("signals", signals);

  console.log("🌱  Seeding provider_stats...");
  await restUpsert("provider_stats", providerStats);

  console.log("🌱  Seeding epochs...");
  await restUpsert("epochs", epochs);

  console.log("🌱  Seeding subscriptions...");
  await restUpsert("subscriptions", subscriptions);

  console.log("\n🎉  Done! Visit http://localhost:3006/markets to see live data.");
}

main().catch(console.error);
