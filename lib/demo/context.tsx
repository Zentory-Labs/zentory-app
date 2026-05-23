"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * DemoMode lets us render investor-friendly sample data on pages that would
 * otherwise look empty (no signals submitted yet, no proposals, no indexer
 * history). It is OFF by default — public visitors always see honest empty
 * states. Investors get a shareable link `?demo=1` that flips it ON.
 *
 * Activation order:
 *   1. URL param `?demo=1` (or `?demo=true`) — highest precedence; also
 *      writes to localStorage so navigating between pages keeps it on.
 *   2. URL param `?demo=0` (or `?demo=false`) — turns it off + clears storage.
 *   3. localStorage `zentory.demoMode === '1'` — persists across reloads.
 *   4. Default: OFF.
 *
 * Every UI surface that swaps to sample data MUST:
 *   - Check `useDemoMode().enabled` first.
 *   - Show a `<DemoBadge />` inline so the data is unambiguously labeled.
 */

interface DemoModeContextValue {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
}

const STORAGE_KEY = "zentory.demoMode";

const DemoModeContext = createContext<DemoModeContextValue>({
  enabled: false,
  toggle: () => {},
  setEnabled: () => {},
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);

  // Resolve initial state from URL + localStorage on mount. We deliberately
  // start `enabled = false` on SSR to avoid hydration mismatches; the real
  // value lands on the first client effect.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("demo");

    let resolved: boolean | null = null;
    if (fromUrl === "1" || fromUrl === "true") {
      resolved = true;
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else if (fromUrl === "0" || fromUrl === "false") {
      resolved = false;
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      resolved = window.localStorage.getItem(STORAGE_KEY) === "1";
    }

    setEnabledState(resolved);
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (typeof window === "undefined") return;
    if (v) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);

  const value = useMemo<DemoModeContextValue>(
    () => ({ enabled, toggle, setEnabled }),
    [enabled, toggle, setEnabled]
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}

// ─── Visual primitives ──────────────────────────────────────────────────────

/**
 * Small inline pill that goes next to any number/chart sourced from the
 * sample generators. Lets investors visually distinguish demo data from
 * the genuinely-on-chain values on the same page.
 */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${className}`}
      style={{
        background: "rgba(176, 141, 87, 0.15)",
        color: "#b08d57",
        border: "1px solid rgba(176, 141, 87, 0.3)",
        fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
      }}
      title="Sample data for demonstration. On mainnet, this populates from the on-chain SignalRegistry, EpochScoring, and vault contracts."
    >
      Sample
    </span>
  );
}

/**
 * Full-width banner anchored at the top of every page when demo mode is ON.
 * Explains what investors are seeing + gives them a one-click way to switch
 * back to live data.
 */
export function DemoBanner() {
  const { enabled, setEnabled } = useDemoMode();
  if (!enabled) return null;
  return (
    <div
      className="w-full text-center text-xs py-2 px-4"
      style={{
        background: "linear-gradient(90deg, rgba(176,141,87,0.18), rgba(176,141,87,0.10), rgba(176,141,87,0.18))",
        borderBottom: "1px solid rgba(176,141,87,0.3)",
        color: "#e6d3a0",
        fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
      }}
    >
      <span className="font-semibold">DEMO MODE</span> — you&apos;re viewing sample data for the investor walkthrough. On mainnet, every number comes from the on-chain SignalRegistry, EpochScoring, and vault contracts.{" "}
      <button
        type="button"
        onClick={() => setEnabled(false)}
        className="underline ml-1 hover:no-underline"
        style={{ color: "#e6d3a0" }}
      >
        Switch back to live data
      </button>
    </div>
  );
}
