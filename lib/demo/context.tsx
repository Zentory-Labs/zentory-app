"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
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

// Server snapshot is always `false` so SSR markup matches the first client
// render before localStorage is consulted. This avoids hydration mismatches.
const SERVER_SNAPSHOT = false;

function subscribeToDemoStorage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getClientDemoSnapshot(): boolean {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  // URL flag takes precedence on every read so a deep link with ?demo=1
  // immediately enables demo mode without waiting for a navigation event.
  const fromUrl = new URLSearchParams(window.location.search).get("demo");
  if (fromUrl === "1" || fromUrl === "true") return true;
  if (fromUrl === "0" || fromUrl === "false") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerDemoSnapshot(): boolean {
  return SERVER_SNAPSHOT;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  enabled: false,
  toggle: () => {},
  setEnabled: () => {},
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  // Resolve initial state from URL + localStorage on mount. We deliberately
  // start `enabled = false` on SSR to avoid hydration mismatches; the real
  // value lands on the first client effect.
  //
  // `useSyncExternalStore` with a localStorage subscription is the React 18+
  // canonical replacement for `useState(false) + useEffect(setEnabled, [])`:
  // the server snapshot is always `false`, the client snapshot reads
  // localStorage (or the URL `?demo=` flag), and a storage event subscription
  // keeps multiple tabs in sync. The setState-in-effect lint rule fires on
  // synchronous setState inside an effect — this pattern has no such call.
  const enabled = useSyncExternalStore(
    subscribeToDemoStorage,
    getClientDemoSnapshot,
    getServerDemoSnapshot,
  );

  // Mirror URL flag → localStorage on mount. Runs once. The lint rule allows
  // setState inside a microtask because it's no longer synchronous with the
  // effect call.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("demo");
    if (fromUrl === "1" || fromUrl === "true") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else if (fromUrl === "0" || fromUrl === "false") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    // Notify subscribers so the snapshot re-reads after we touched storage.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    if (typeof window === "undefined") return;
    if (v) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
    // Manually fire a storage event so the useSyncExternalStore subscriber
    // re-reads the snapshot (storage events only fire for *other* tabs).
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
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
 *
 * Rendered inside <main> in app/layout.tsx (rather than as a body-level
 * sibling of <Nav />) so the fixed nav can't overlap it. The banner's exit
 * button was previously untouchable because the nav is `position: fixed;
 * z-index: 50` and stacked on top of the body-level banner.
 */
export function DemoBanner() {
  const { enabled, setEnabled } = useDemoMode();
  if (!enabled) return null;
  return (
    <div
      data-test="demo-banner"
      className="w-full text-center text-xs py-2 px-4 mb-6 rounded-xl"
      style={{
        background: "linear-gradient(90deg, rgba(176,141,87,0.18), rgba(176,141,87,0.10), rgba(176,141,87,0.18))",
        border: "1px solid rgba(176,141,87,0.3)",
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
        data-test="demo-banner-exit"
      >
        Switch back to live data
      </button>
    </div>
  );
}
