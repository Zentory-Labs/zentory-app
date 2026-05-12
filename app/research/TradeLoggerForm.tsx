"use client";

import { useState, useTransition } from "react";
import type { Asset, Direction } from "@/lib/research";
import { logResearch, executeResearch } from "@/lib/research";

const ASSETS: Asset[] = ["BTC", "ETH", "XRP", "SOL"];
const DIRECTIONS: Direction[] = ["LONG", "SHORT", "CLOSE"];

type Toast = { kind: "success" | "error"; message: string } | null;

export default function TradeLoggerForm() {
  const [asset, setAsset] = useState<Asset>("BTC");
  const [direction, setDirection] = useState<Direction>("LONG");
  const [size, setSize] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [toast, setToast] = useState<Toast>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    const sizeNum = parseFloat(size);
    const priceNum = parseFloat(price);
    if (isNaN(sizeNum) || isNaN(priceNum) || sizeNum <= 0 || priceNum <= 0) {
      showToast("error", "Enter valid size and price.");
      return;
    }
    startTransition(async () => {
      try {
        const research = await logResearch({ provider: "manual", asset, direction, size: sizeNum, price: priceNum });
        showToast("success", `Research published (${research.id}). Ready to execute.`);
        setSize("");
        setPrice("");
      } catch {
        showToast("error", "Failed to log research. Check your connection.");
      }
    });
  }

  async function handleExecute() {
    const sizeNum = parseFloat(size);
    const priceNum = parseFloat(price);
    if (isNaN(sizeNum) || isNaN(priceNum) || sizeNum <= 0 || priceNum <= 0) {
      showToast("error", "Enter valid size and price before executing.");
      return;
    }
    startTransition(async () => {
      try {
        const research = await logResearch({ provider: "manual", asset, direction, size: sizeNum, price: priceNum });
        const result = await executeResearch(research as Parameters<typeof executeResearch>[0]);
        showToast("success", `Trade executed on-chain. TX: ${result.txHash.slice(0, 12)}…`);
        setSize("");
        setPrice("");
      } catch {
        showToast("error", "Execution failed. Ensure keeper key is set and wallet has HYPE.");
      }
    });
  }

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Publish Research</h2>
      <p className="text-xs text-white/40 mb-5">Submit manually or execute directly on-chain via the keeper wallet.</p>

      {toast && (
        <div className={`mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium border ${
          toast.kind === "success"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          {toast.kind === "success" ? (
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {toast.message}
        </div>
      )}

      <form onSubmit={handleLog} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50 uppercase tracking-wider">Asset</label>
            <select value={asset} onChange={(e) => setAsset(e.target.value as Asset)} className={inputClass + " cursor-pointer"}>
              {ASSETS.map((a) => <option key={a} value={a} className="bg-[#0d0d14]">{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50 uppercase tracking-wider">Size</label>
            <input type="number" step="any" min="0" placeholder="0.00" value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50 uppercase tracking-wider">Direction</label>
          <div className="grid grid-cols-3 gap-2">
            {DIRECTIONS.map((d) => {
              const selected = direction === d;
              return (
                <button key={d} type="button" onClick={() => setDirection(d)}
                  className={`rounded-lg border py-2.5 text-sm font-semibold font-mono uppercase tracking-wider transition-all ${
                    d === "LONG" ? selected ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "border-white/10 text-white/40 hover:border-emerald-500/20"
                  : d === "SHORT" ? selected ? "bg-red-500/20 text-red-400 border-red-500/40" : "border-white/10 text-white/40 hover:border-red-500/20"
                  : selected ? "bg-white/10 text-white border-white/30" : "border-white/10 text-white/40 hover:border-white/20"
                  }`}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50 uppercase tracking-wider">Price (USD)</label>
          <input type="number" step="any" min="0" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isPending}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40 transition-all">
            {isPending ? "Publishing…" : "Publish Research"}
          </button>
          <button type="button" disabled={isPending} onClick={handleExecute}
            className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-40 transition-all">
            {isPending ? "Executing…" : "Execute Trade"}
          </button>
        </div>
      </form>
    </div>
  );
}
