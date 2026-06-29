"use client";

import Link from "next/link";

// Fiat on-ramp via Onramper (aggregates Transak, MoonPay, etc.).
// Setup before this earns / works in production:
//   1. Create an Onramper partner account; put the API key in NEXT_PUBLIC_ONRAMPER_API_KEY.
//   2. Set your markup ("partner fee") in the Onramper dashboard — that's your revenue.
//      The licensed ramp holds the money-transmitter license; Zentory does not custody funds.
//   3. Verify iframe params against https://docs.onramper.com (this is a scaffold).
// Note: fiat ramps settle USDC on major chains, not HyperEVM directly — so the honest flow is
// buy USDC here, then bridge it onto HyperEVM (the /bridge page), then deposit in a vault.

const GOLD = "#b08d57";
const ONRAMPER_KEY = process.env.NEXT_PUBLIC_ONRAMPER_API_KEY ?? "";

function onramperSrc(): string {
  const params = new URLSearchParams({
    apiKey: ONRAMPER_KEY,
    mode: "buy",
    defaultCrypto: "usdc",
    themeName: "dark",
    primaryColor: GOLD,
  });
  return `https://buy.onramper.com/?${params.toString()}`;
}

export default function BuyPage() {
  return (
    <div className="space-y-10 pb-12">
      <header className="space-y-3 max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Buy Crypto</p>
        <h1 className="text-4xl font-bold tracking-tight text-white">Card to crypto, in one step</h1>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(234,234,234,0.65)" }}>
          Buy USDC with a card, Apple Pay, or bank transfer through a licensed provider — then bridge it
          onto HyperEVM and into a Zentory vault. Zentory never holds your funds or your card details;
          the regulated ramp handles payments and compliance.
        </p>
      </header>

      <div className="grid lg:grid-cols-[420px_1fr] gap-10 items-start">
        <div className="flex justify-center lg:justify-start w-full">
          {ONRAMPER_KEY ? (
            <iframe
              title="Buy crypto with Onramper"
              src={onramperSrc()}
              height={630}
              width={420}
              allow="accelerometer; autoplay; camera; gyroscope; payment; microphone"
              className="rounded-2xl max-w-full"
              style={{ border: "1px solid rgba(42,47,58,0.6)", background: "#111114" }}
            />
          ) : (
            <div className="h-[630px] w-full max-w-[420px] rounded-2xl flex flex-col items-center justify-center text-center p-8 gap-3"
              style={{ background: "#111114", border: "1px solid rgba(42,47,58,0.6)" }}>
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Coming soon</span>
              <span className="text-sm leading-relaxed" style={{ color: "rgba(191,195,199,0.75)" }}>
                Card &amp; bank on-ramp is launching shortly. For now,{" "}
                <Link href="/bridge" className="underline" style={{ color: GOLD }}>bridge crypto from another chain</Link>{" "}
                onto HyperEVM in seconds.
              </span>
            </div>
          )}
        </div>

        {/* Funnel: buy → bridge → vault */}
        <div className="space-y-4">
          <div className="rounded-2xl p-6" style={{ background: "#111114", border: "1px solid rgba(42,47,58,0.6)" }}>
            <h2 className="text-lg font-semibold text-white mb-4">Three steps onto HyperEVM</h2>
            <ol className="space-y-3 text-sm" style={{ color: "rgba(234,234,234,0.7)" }}>
              <li><span className="font-mono" style={{ color: GOLD }}>1.</span> Buy USDC here with fiat.</li>
              <li><span className="font-mono" style={{ color: GOLD }}>2.</span> <Link href="/bridge" className="underline hover:text-[#b08d57]">Bridge it onto HyperEVM</Link> in seconds.</li>
              <li><span className="font-mono" style={{ color: GOLD }}>3.</span> <Link href="/" className="underline hover:text-[#b08d57]">Deposit in a vault</Link> and track NAV on-chain.</li>
            </ol>
          </div>
          <p className="text-xs" style={{ color: "rgba(191,195,199,0.6)" }}>
            Payments and KYC are handled by Onramper&apos;s licensed ramp partners. Zentory is a non-custodial
            interface and is not a money transmitter.
          </p>
        </div>
      </div>
    </div>
  );
}
