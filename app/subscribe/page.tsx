"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { erc20Abi } from "viem";
import { addresses, SUBSCRIPTION_VAULT_ABI } from "@/lib/contracts";

// ─── Tier definitions ─────────────────────────────────────────────────────────

const ZENT_USD = 0.08;

interface Tier {
  id: number;
  name: string;
  priceZent: number;
  priceUsd: number; // estimated USD equivalent at current ZENT price
  emoji: string;
  assets: string[];
  assetKeys: string[];
  description: string;
  color: string;
  badge: string;
  badgeBorder: string;
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 0,
    name: "BASIC",
    priceZent: 100,
    priceUsd: 8,
    emoji: "Lock",
    assets: ["Crypto Spot", "Crypto Perp"],
    assetKeys: ["CRYPTO_SPOT", "CRYPTO_PERP"],
    description: "Access quant research for spot and perpetuals across top exchanges.",
    color: "#b08d57",
    badge: "rgba(176,141,87,0.15)",
    badgeBorder: "rgba(176,141,87,0.3)",
    popular: false,
  },
  {
    id: 1,
    name: "PRO",
    priceZent: 500,
    priceUsd: 40,
    emoji: "Bolt",
    assets: ["Crypto Spot", "Crypto Perp", "Equity"],
    assetKeys: ["CRYPTO_SPOT", "CRYPTO_PERP", "EQUITY"],
    description: "Everything in Basic plus equity research powered by Ondo and Synthetix.",
    color: "#c2353f",
    badge: "rgba(194,53,63,0.12)",
    badgeBorder: "rgba(194,53,63,0.3)",
    popular: true,
  },
  {
    id: 2,
    name: "ELITE",
    priceZent: 2000,
    priceUsd: 160,
    emoji: "Crown",
    assets: ["Crypto Spot", "Crypto Perp", "Equity", "Forex", "Commodities"],
    assetKeys: ["CRYPTO_SPOT", "CRYPTO_PERP", "EQUITY", "FOREX", "COMMODITIES"],
    description: "Full multi-asset coverage: crypto, equities, forex, and commodities.",
    color: "#eaeaea",
    badge: "rgba(234,234,234,0.06)",
    badgeBorder: "rgba(234,234,234,0.12)",
    popular: false,
  },
];

const ASSET_CLASS_TABLE = [
  { label: "Crypto Spot",    basic: true,  pro: true,  elite: true  },
  { label: "Crypto Perp",   basic: true,  pro: true,  elite: true  },
  { label: "Equity",         basic: false, pro: true,  elite: true  },
  { label: "Forex",         basic: false, pro: false, elite: true  },
  { label: "Commodities",    basic: false, pro: false, elite: true  },
];

const FAQ_ITEMS = [
  {
    q: "How does billing work?",
    a: "Subscriptions are billed monthly in ZENT tokens. ZENT tokens go directly to research contributors and stakers within the protocol.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, you can cancel at any time. Your access remains active until the end of the current billing period.",
  },
  {
    q: "What if I miss a research update?",
    a: "All research is recorded on-chain with timestamps. You can review the full research history to catch up on any missed updates.",
  },
  {
    q: "Do I need a minimum ZENT balance?",
    a: "Yes. You need sufficient ZENT tokens in your wallet to pay for your chosen subscription tier.",
  },
  {
    q: "Is research financial advice?",
    a: "No. Research is informational output from quant strategies. You execute trades on your own wallet. Zentory Protocol is not a financial advisor.",
  },
];

// ─── Subscribe Button ───────────────────────────────────────────────────
// Proper 2-step flow: approve ZENT → wait → subscribe to vault

type SubscribeState = "idle" | "approving" | "subscribing" | "done" | "error";

const HYPER_EVM_CHAIN_ID = 998;

function CryptoSubscribeButton({ tier }: { tier: Tier }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [state, setState] = useState<SubscribeState>("idle");
  const [error, setError] = useState<string | null>(null);

  const wrongNetwork = isConnected && chainId && chainId !== HYPER_EVM_CHAIN_ID;

  const { writeContract, data: approveHash, isPending: isApproving } =
    useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash ?? undefined,
  });

  const {
    writeContract: writeSubscribe,
    data: subscribeHash,
    isPending: isSubscribing,
  } = useWriteContract();
  const { isLoading: isSubscribeConfirming, isSuccess: isSubscribed } =
    useWaitForTransactionReceipt({ hash: subscribeHash ?? undefined });

  // Once approve is confirmed, automatically trigger subscribe
  useEffect(() => {
    if (
      state === "approving" &&
      isApproveConfirming === false &&
      approveHash &&
      !isApproving
    ) {
      const amountWei = BigInt(tier.priceZent) * 10n ** 18n;
      setState("subscribing");
      writeSubscribe({
        address: addresses.SubscriptionVault as `0x${string}`,
        abi: SUBSCRIPTION_VAULT_ABI as any,
        functionName: "subscribe",
        args: [BigInt(tier.id), BigInt(1)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveConfirming, approveHash, isApproving]);

  // Track subscription success
  useEffect(() => {
    if (state === "subscribing" && isSubscribed) {
      setState("done");
    }
  }, [state, isSubscribed]);

  async function handleSubscribe() {
    if (!isConnected) {
      window.dispatchEvent(new Event("open-wallet-modal"));
      return;
    }
    setError(null);
    try {
      const amountWei = BigInt(tier.priceZent) * 10n ** 18n;
      setState("approving");

      writeContract({
        address: addresses.ZENT as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [addresses.SubscriptionVault as `0x${string}`, amountWei],
      });
    } catch (e: unknown) {
      setState("error");
      setError(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  const isWorking = state === "approving" || state === "subscribing";

  if (!isConnected) {
    return (
      <div className="space-y-2">
        {wrongNetwork && (
          <div
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{
                background: "#ef4444",
                boxShadow: "0 0 6px #ef4444",
              }}
            />
            <span
              className="text-xs"
              style={{
                color: "#ef4444",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Wrong network
            </span>
            <button
              onClick={() => switchChain?.({ chainId: HYPER_EVM_CHAIN_ID })}
              className="text-xs font-semibold underline"
              style={{
                color: "#ef4444",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Switch
            </button>
          </div>
        )}
        <button
          onClick={() => window.dispatchEvent(new Event("open-wallet-modal"))}
          className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{
            background: "rgba(139,30,45,0.12)",
            border: "1px solid rgba(139,30,45,0.35)",
            color: "#c2353f",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (state === "done" || isSubscribed) {
    return (
      <div
        className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-center"
        style={{
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.3)",
          color: "#22c55e",
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        Subscription Active
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSubscribe}
        disabled={isWorking}
        className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
        style={{
          background: isWorking
            ? undefined
            : tier.color === "#eaeaea"
            ? "rgba(234,234,234,0.1)"
            : tier.color,
          border: `1px solid ${tier.badgeBorder}`,
          color:
            tier.color === "#eaeaea"
              ? "#eaeaea"
              : tier.color === "#b08d57"
              ? "#0b0b0d"
              : "#eaeaea",
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: isWorking ? undefined : `0 0 24px ${tier.badge}`,
        }}
      >
        {state === "approving"
          ? isApproving
            ? "Waiting for wallet…"
            : "Confirming approval…"
          : state === "subscribing"
          ? isSubscribing
            ? "Waiting for wallet…"
            : "Confirming subscription…"
          : `ZENT – ${tier.priceZent.toLocaleString()}/mo`}
      </button>

      {state === "error" && error && (
        <p
          className="text-xs text-center"
          style={{ color: "#ef4444", fontFamily: "'Montserrat', sans-serif" }}
        >
          {error}
        </p>
      )}

      {(approveHash || subscribeHash) && (
        <a
          href={`https://hypurrscan.io/tx/${subscribeHash || approveHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-center transition-colors"
          style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
        >
          View transaction →
        </a>
      )}
    </div>
  );
}

// ─── HowItWorks ───────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Choose & Connect",
      desc: "Select your subscription tier and connect your wallet.",
      icon: "Link",
    },
    {
      num: "02",
      title: "Pay with ZENT",
      desc: "Subscribe in ZENT tokens. Your payment goes directly to research contributors and stakers.",
      icon: "Diamond",
    },
    {
      num: "03",
      title: "Follow Research",
      desc: "Access research in your dashboard and execute trades on your own wallet.",
      icon: "Research",
    },
  ];

  return (
    <section className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h2
          className="text-3xl font-bold tracking-tight mb-3"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: "#eaeaea",
          }}
        >
          How It Works
        </h2>
        <p
          className="text-sm"
          style={{
            color: "rgba(234,234,234,0.5)",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Three steps to access the full research network
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((s) => (
          <div
            key={s.num}
            className="p-6 rounded-2xl text-center"
            style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
          >
            <div className="text-4xl mb-4">{s.icon}</div>
            <div
              className="text-xs font-bold mb-2 uppercase tracking-widest"
              style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
            >
              {s.num}
            </div>
            <h3
              className="text-base font-semibold mb-2"
              style={{
                color: "#eaeaea",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {s.title}
            </h3>
            <p
              className="text-sm"
              style={{
                color: "rgba(234,234,234,0.5)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h2
          className="text-3xl font-bold tracking-tight mb-3"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: "#eaeaea",
          }}
        >
          Frequently Asked Questions
        </h2>
      </div>
      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden"
            style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
          >
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-left"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
            >
              <span
                className="font-medium text-sm"
                style={{
                  color: "#eaeaea",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {item.q}
              </span>
              <span
                className="text-lg transition-transform duration-200"
                style={{
                  color: "#b08d57",
                  transform: openIndex === i ? "rotate(45deg)" : "none",
                }}
              >
                +
              </span>
            </button>
            {openIndex === i && (
              <div style={{ borderTop: "1px solid #2a2f3a" }}>
                <p
                  className="pt-4 pb-4 px-6 text-sm leading-relaxed"
                  style={{
                    color: "rgba(234,234,234,0.55)",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {item.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── AssetClassTable ─────────────────────────────────────────────────────────

function AssetClassTable() {
  return (
    <section className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2
          className="text-3xl font-bold tracking-tight mb-3"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: "#eaeaea",
          }}
        >
          Asset Class Coverage
        </h2>
        <p
          className="text-sm"
          style={{
            color: "rgba(234,234,234,0.5)",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Each tier unlocks different asset classes
        </p>
      </div>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid #2a2f3a" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid #2a2f3a",
              }}
            >
              <th
                className="px-6 py-4 text-left font-semibold uppercase tracking-wider"
                style={{
                  color: "rgba(234,234,234,0.5)",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                Asset Class
              </th>
              {["BASIC", "PRO", "ELITE"].map((t) => (
                <th
                  key={t}
                  className="px-6 py-4 text-center font-semibold uppercase tracking-wider"
                  style={{
                    color: "rgba(234,234,234,0.5)",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ASSET_CLASS_TABLE.map((row, i) => (
              <tr
                key={row.label}
                style={{
                  borderBottom:
                    i < ASSET_CLASS_TABLE.length - 1
                      ? "1px solid #2a2f3a"
                      : undefined,
                }}
              >
                <td
                  className="px-6 py-4 font-medium"
                  style={{
                    color: "#eaeaea",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {row.label}
                </td>
                {[row.basic, row.pro, row.elite].map((val, j) => (
                  <td key={j} className="px-6 py-4 text-center text-lg">
                    {val ? (
                      <span style={{ color: "#22c55e" }}>Yes</span>
                    ) : (
                      <span style={{ color: "rgba(234,234,234,0.2)" }}>—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionVaultPage() {
  return (
    <div
      className="w-full overflow-x-hidden"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#8b1e2d]/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#b08d57]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <main className="mx-auto max-w-7xl px-6 py-28 space-y-24">
        {/* ── Hero ── */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
            style={{
              background: "rgba(139, 30, 45, 0.15)",
              borderColor: "rgba(139, 30, 45, 0.4)",
              color: "#c2353f",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "#c2353f",
                boxShadow: "0 0 8px #c2353f",
              }}
            />
            Multi-Asset Research Network
          </div>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ color: "#eaeaea" }}
          >
            Access the Full Research Network
          </h1>
          <p
            className="text-base leading-relaxed max-w-xl mx-auto"
            style={{ color: "rgba(234,234,234,0.6)" }}
          >
            Subscribe to quant research contributors across crypto, equities, forex,
            and commodities. Execute on your own wallet — fully transparent, all
            on-chain.
          </p>
        </section>

        {/* ── Tier Cards ── */}
        <section>
          <div className="text-center mb-8">
            <h2
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
            >
              Subscribe with ZENT
            </h2>
            <p
              className="text-sm"
              style={{
                color: "rgba(234,234,234,0.5)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Pay monthly in ZENT tokens — stake, subscribe, and access the full research network
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TIERS.map((tier) => (
              <div
                key={`crypto-${tier.name}`}
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: "#1c1c21",
                  border: `1px solid ${
                    tier.popular ? tier.badgeBorder : "#2a2f3a"
                  }`,
                  boxShadow: tier.popular
                    ? `0 0 60px ${tier.badge}`
                    : undefined,
                }}
              >
                {tier.popular && (
                  <div
                    className="py-1.5 text-center text-xs font-bold uppercase tracking-widest"
                    style={{
                      background: tier.color,
                      color: "#0b0b0d",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    Most Popular
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1 space-y-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div
                        className="text-xl font-bold uppercase tracking-widest mb-1"
                        style={{
                          color: tier.color,
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        {tier.name}
                      </div>
                      <h3
                        className="text-base font-semibold"
                        style={{
                          color: "rgba(234,234,234,0.7)",
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        Subscription
                      </h3>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-semibold border"
                      style={{
                        background: "rgba(176,141,87,0.1)",
                        borderColor: "rgba(176,141,87,0.25)",
                        color: "#b08d57",
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      ZENT
                    </span>
                  </div>

                  {/* Crypto Price */}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-3xl font-bold"
                        style={{
                          color: "#eaeaea",
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        {tier.priceZent.toLocaleString()}
                      </span>
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: "#b08d57",
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        ZENT/mo
                      </span>
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: "rgba(234,234,234,0.4)" }}
                    >
                      ≈ ${tier.priceUsd}/month at ZENT ~${ZENT_USD}
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "rgba(234,234,234,0.55)" }}
                  >
                    {tier.description}
                  </p>

                  {/* Asset classes */}
                  <div className="flex flex-wrap gap-2">
                    {tier.assets.map((asset) => (
                      <span
                        key={asset}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                        style={{
                          background: tier.badge,
                          borderColor: tier.badgeBorder,
                          color: tier.color,
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        {asset}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="mt-auto pt-2">
                    <CryptoSubscribeButton tier={tier} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <HowItWorks />

        {/* ── Asset Class Table ── */}
        <AssetClassTable />

        {/* ── FAQ ── */}
        <FAQ />
      </main>
    </div>
  );
}
