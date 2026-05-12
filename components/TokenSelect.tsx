"use client";

import { useState, useRef, useEffect } from "react";

const ALL_TOKENS = ["ZENT", "ETH", "BTC", "USDT", "SOL"] as const;
type TokenSymbol = (typeof ALL_TOKENS)[number];

interface TokenOption {
  symbol: TokenSymbol;
}

interface TokenSelectProps {
  value: TokenSymbol;
  onChange: (symbol: TokenSymbol) => void;
  excludeSymbol?: TokenSymbol;
}

export function TokenSelect({ value, onChange, excludeSymbol }: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options: TokenOption[] = excludeSymbol
    ? ALL_TOKENS.filter((t) => t !== excludeSymbol).map((t) => ({ symbol: t }))
    : ALL_TOKENS.map((t) => ({ symbol: t }));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all cursor-pointer"
        style={{
          background: "rgba(42,47,58,0.8)",
          borderColor: "#2a2f3a",
          color: "#eaeaea",
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        <span>{value}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="#6a6f75"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 rounded-xl overflow-hidden z-50"
          style={{
            minWidth: "100%",
            background: "rgba(20, 20, 23, 0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid #2a2f3a",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          }}
        >
          {options.map(({ symbol }) => (
            <button
              key={symbol}
              type="button"
              onClick={() => { onChange(symbol); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors"
              style={{
                color: symbol === value ? "#b08d57" : "#eaeaea",
                fontFamily: "'Montserrat', sans-serif",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                if (symbol !== value) (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,30,45,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
