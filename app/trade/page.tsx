"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  getPerps, getAllMids, getL2Book, getClearinghouseState,
  HL_BUILDER_FEE, HL_LIVE_ORDERS, fmtUsd,
  type PerpMeta, type L2Book, type ClearinghouseState,
} from "@/lib/hyperliquid";
import { approveBuilderFee, placeOrder } from "@/lib/hyperliquid-exchange";

const GOLD = "#b08d57";
const GREEN = "#34d399";
const RED = "#c2353f";
const PANEL = "#1c1c21";
const BORDER = "1px solid #2a2f3a";
const POLL_MS = 2500;

export default function TradePage() {
  const { address, isConnected } = useAccount();
  const [perps, setPerps] = useState<PerpMeta[]>([]);
  const [coin, setCoin] = useState("BTC");
  const [mids, setMids] = useState<Record<string, string>>({});
  const [book, setBook] = useState<L2Book | null>(null);
  const [chState, setChState] = useState<ClearinghouseState | null>(null);
  const [err, setErr] = useState(false);

  // order ticket
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [limitPx, setLimitPx] = useState("");

  // live-order state
  const { data: walletClient } = useWalletClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [feeApproved, setFeeApproved] = useState(false);

  const meta = useMemo(() => perps.find((p) => p.name === coin), [perps, coin]);
  const mark = mids[coin] ? Number(mids[coin]) : null;

  useEffect(() => {
    getPerps().then(setPerps).catch(() => setErr(true));
  }, []);

  // poll market data for the selected coin
  useEffect(() => {
    let alive = true;
    const tick = () => {
      Promise.all([getAllMids(), getL2Book(coin)])
        .then(([m, b]) => { if (alive) { setMids(m); setBook(b); setErr(false); } })
        .catch(() => alive && setErr(true));
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [coin]);

  // poll the connected wallet's positions
  useEffect(() => {
    if (!isConnected || !address) { setChState(null); return; }
    let alive = true;
    const tick = () => getClearinghouseState(address).then((s) => alive && setChState(s)).catch(() => {});
    tick();
    const id = setInterval(tick, POLL_MS * 2);
    return () => { alive = false; clearInterval(id); };
  }, [address, isConnected]);

  const notional = useMemo(() => {
    const px = type === "limit" && limitPx ? Number(limitPx) : mark ?? 0;
    return (Number(size) || 0) * px;
  }, [size, limitPx, type, mark]);
  // builder fee (f is tenths of a bp → fraction = f / 100_000)
  const builderFee = notional * (HL_BUILDER_FEE / 100_000);

  const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // One-time: authorize Zentory's builder fee for the connected wallet.
  const onApprove = useCallback(async () => {
    if (!walletClient) { setStatus("Connect your wallet first."); return; }
    setBusy(true); setStatus(null);
    try {
      await approveBuilderFee(walletClient);
      setFeeApproved(true);
      setStatus("Builder fee approved — you can place orders.");
    } catch (e) { setStatus(`Approval failed: ${errMsg(e)}`); }
    finally { setBusy(false); }
  }, [walletClient]);

  // Place a live order with the Zentory builder code attached.
  const onPlace = useCallback(async () => {
    if (!HL_LIVE_ORDERS) { setStatus("Live routing isn't configured yet — set NEXT_PUBLIC_HL_BUILDER_ADDRESS."); return; }
    if (!walletClient) { setStatus("Connect your wallet first."); return; }
    if (!Number(size)) { setStatus("Enter a size."); return; }
    // Market orders still need a price on HL — use an aggressive marketable price (~5 sig figs).
    const px = type === "limit"
      ? limitPx
      : mark ? Number((side === "buy" ? mark * 1.02 : mark * 0.98).toPrecision(5)).toString() : "";
    if (!px) { setStatus("No price available — try again in a moment."); return; }
    setBusy(true); setStatus(null);
    try {
      await placeOrder({ walletClient, coin, isBuy: side === "buy", sz: size, price: px, isMarket: type === "market" });
      setStatus(`Order submitted ✓ — ${side === "buy" ? "long" : "short"} ${size} ${coin}.`);
    } catch (e) { setStatus(`Order failed: ${errMsg(e)}`); }
    finally { setBusy(false); }
  }, [walletClient, coin, side, size, type, limitPx, mark]);

  const bids = book?.levels?.[0]?.slice(0, 11) ?? [];
  const asks = (book?.levels?.[1]?.slice(0, 11) ?? []).slice().reverse();

  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-2 max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Zentory Terminal</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Trade Hyperliquid</h1>
        <p className="text-sm" style={{ color: "#bfc3c7" }}>
          Live perps on Hyperliquid&apos;s on-chain orderbook. Hyperliquid provides the liquidity;
          Zentory routes your order and earns a small builder fee — non-custodial, you sign every trade.
        </p>
        <p className="text-[11px]" style={{ color: "rgba(224,161,58,0.9)" }}>
          Note: the orderbook and positions shown are <strong>Hyperliquid L1 mainnet</strong>. Zentory&apos;s
          vaults run on HyperEVM testnet — these are separate networks.
        </p>
      </header>

      {/* market bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl p-4" style={{ background: PANEL, border: BORDER }}>
        <select value={coin} onChange={(e) => setCoin(e.target.value)}
          className="bg-transparent text-white text-lg font-semibold outline-none cursor-pointer"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>
          {perps.map((p) => <option key={p.name} value={p.name} style={{ background: "#1c1c21" }}>{p.name}-PERP</option>)}
        </select>
        <div className="text-2xl font-bold tabular-nums text-white">
          {mark !== null ? `$${fmtUsd(mark, mark < 10 ? 5 : 2)}` : <span style={{ color: "#6a6f75" }}>—</span>}
        </div>
        {meta && <div className="text-xs px-2 py-1 rounded" style={{ color: GOLD, border: `1px solid ${GOLD}55` }}>up to {meta.maxLeverage}× leverage</div>}
        {err && <div className="text-xs" style={{ color: RED }}>market data unavailable — retrying…</div>}
        <div className="ml-auto text-xs" style={{ color: "#6a6f75" }}>live · updates {POLL_MS / 1000}s</div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* orderbook */}
        <div className="rounded-2xl p-5" style={{ background: PANEL, border: BORDER }}>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "#6a6f75" }}>Order book · {coin}</div>
          <div className="grid grid-cols-2 text-[11px] mb-2" style={{ color: "#6a6f75" }}>
            <span>Price (USD)</span><span className="text-right">Size ({coin})</span>
          </div>
          <div className="space-y-0.5 text-sm tabular-nums">
            {asks.map((l, i) => (
              <div key={`a${i}`} className="grid grid-cols-2"><span style={{ color: RED }}>{fmtUsd(Number(l.px), Number(l.px) < 10 ? 5 : 1)}</span><span className="text-right" style={{ color: "#bfc3c7" }}>{l.sz}</span></div>
            ))}
            <div className="py-1.5 my-1 text-center text-base font-semibold tabular-nums border-y" style={{ color: GOLD, borderColor: "#2a2f3a" }}>
              {mark !== null ? `$${fmtUsd(mark, mark < 10 ? 5 : 2)}` : "—"}
            </div>
            {bids.map((l, i) => (
              <div key={`b${i}`} className="grid grid-cols-2"><span style={{ color: GREEN }}>{fmtUsd(Number(l.px), Number(l.px) < 10 ? 5 : 1)}</span><span className="text-right" style={{ color: "#bfc3c7" }}>{l.sz}</span></div>
            ))}
            {!book && <div className="text-center py-8" style={{ color: "#6a6f75" }}>loading book…</div>}
          </div>
        </div>

        {/* order ticket — hidden until live order routing is enabled + verified */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: PANEL, border: BORDER }}>
          {!HL_LIVE_ORDERS ? (
            <div className="space-y-2 py-1">
              <p className="text-sm font-semibold text-white">Trading launches soon</p>
              <p className="text-[11px] leading-snug" style={{ color: "#bfc3c7" }}>
                The live orderbook and your Hyperliquid positions are shown in real time below.
                Order routing turns on once the Zentory builder wallet is funded and verified —
                non-custodial, you sign every trade.
              </p>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as const).map((s) => (
              <button key={s} onClick={() => setSide(s)}
                className="py-2 rounded-lg text-sm font-semibold capitalize transition-colors"
                style={side === s
                  ? { background: s === "buy" ? GREEN : RED, color: "#0b0b0d" }
                  : { background: "rgba(255,255,255,0.04)", color: "#bfc3c7" }}>
                {s === "buy" ? "Long / Buy" : "Short / Sell"}
              </button>
            ))}
          </div>

          <div className="flex gap-2 text-xs">
            {(["market", "limit"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className="px-3 py-1 rounded capitalize"
                style={type === t ? { color: GOLD, border: `1px solid ${GOLD}55` } : { color: "#bfc3c7", border: "1px solid transparent" }}>{t}</button>
            ))}
          </div>

          {type === "limit" && (
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider" style={{ color: "#6a6f75" }}>Limit price</span>
              <input value={limitPx} onChange={(e) => setLimitPx(e.target.value)} inputMode="decimal" placeholder={mark ? String(mark) : "0.00"}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-transparent text-white outline-none tabular-nums" style={{ border: BORDER }} />
            </label>
          )}

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: "#6a6f75" }}>Size ({coin})</span>
            <input value={size} onChange={(e) => setSize(e.target.value)} inputMode="decimal" placeholder="0.00"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-transparent text-white outline-none tabular-nums" style={{ border: BORDER }} />
          </label>

          <div className="text-xs space-y-1.5 pt-1" style={{ color: "#bfc3c7" }}>
            <div className="flex justify-between"><span>Order value</span><span className="tabular-nums text-white">${fmtUsd(notional)}</span></div>
            <div className="flex justify-between"><span>Zentory builder fee ({(HL_BUILDER_FEE / 1000).toFixed(2)} bp)</span><span className="tabular-nums" style={{ color: GOLD }}>~${fmtUsd(builderFee, 4)}</span></div>
          </div>

          {HL_LIVE_ORDERS && isConnected && !feeApproved && (
            <button onClick={onApprove} disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
              {busy ? "Approving…" : "Approve Zentory builder fee (one-time)"}
            </button>
          )}
          <button onClick={onPlace}
            disabled={!Number(size) || busy || (HL_LIVE_ORDERS && isConnected && !feeApproved)}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
            style={{ background: side === "buy" ? GREEN : RED, color: "#0b0b0d" }}>
            {!isConnected ? "Connect wallet to trade" : busy ? "Submitting…" : `${side === "buy" ? "Long" : "Short"} ${coin}`}
          </button>

          {status && <p className="text-[11px] leading-snug" style={{ color: "#bfc3c7" }}>{status}</p>}
          </>
          )}
        </div>
      </div>

      {/* positions */}
      <div className="rounded-2xl p-5" style={{ background: PANEL, border: BORDER }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider" style={{ color: "#6a6f75" }}>Your Hyperliquid positions</span>
          {chState && <span className="text-xs tabular-nums" style={{ color: "#bfc3c7" }}>
            Account ${fmtUsd(Number(chState.marginSummary.accountValue))} · Withdrawable ${fmtUsd(Number(chState.withdrawable))}
          </span>}
        </div>
        {!isConnected ? (
          <p className="text-sm py-4 text-center" style={{ color: "#6a6f75" }}>Connect your wallet to see positions.</p>
        ) : !chState || chState.assetPositions.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "#6a6f75" }}>No open positions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums min-w-[480px]">
              <thead><tr className="text-left text-[11px] uppercase" style={{ color: "#6a6f75" }}>
                <th className="py-1.5">Market</th><th>Side</th><th>Size</th><th>Entry</th><th className="text-right">uPnL</th>
              </tr></thead>
              <tbody style={{ color: "#eaeaea" }}>
                {chState.assetPositions.map(({ position: p }) => {
                  const sz = Number(p.szi); const pnl = Number(p.unrealizedPnl);
                  return (
                    <tr key={p.coin} className="border-t" style={{ borderColor: "rgba(42,47,58,0.5)" }}>
                      <td className="py-2 font-medium text-white">{p.coin}</td>
                      <td style={{ color: sz >= 0 ? GREEN : RED }}>{sz >= 0 ? "Long" : "Short"}</td>
                      <td>{Math.abs(sz)}</td>
                      <td>{p.entryPx ? `$${fmtUsd(Number(p.entryPx))}` : "—"}</td>
                      <td className="text-right" style={{ color: pnl >= 0 ? GREEN : RED }}>{pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
