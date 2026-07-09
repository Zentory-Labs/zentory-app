"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useDisconnect, useConnect, useChainId, useSwitchChain } from "wagmi";

const HYPER_EVM_CHAIN_ID = 998;

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Authentic brand SVGs. Used only as fallback when the connector itself
// doesn't expose connector.icon (EIP-6963 injected wallets like Rabby and
// most browser-installed wallets do — we prefer their own icon over ours).
function MetaMaskMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 35 33" xmlns="http://www.w3.org/2000/svg">
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.25">
        <path d="M32.96 1l-13.13 9.72 2.45-5.7z" fill="#E17726" stroke="#E17726"/>
        <path d="M2.04 1l13 9.81-2.32-5.79z" fill="#E27625" stroke="#E27625"/>
        <path d="M28.23 23.55l-3.5 5.33 7.48 2.05 2.14-7.26z" fill="#E27625" stroke="#E27625"/>
        <path d="M.66 23.67l2.13 7.26 7.47-2.05-3.5-5.33z" fill="#E27625" stroke="#E27625"/>
        <path d="M9.84 14.51L7.78 17.6l7.4.33-.25-7.97z" fill="#E27625" stroke="#E27625"/>
        <path d="M25.16 14.51l-5.14-4.65-.17 8.05 7.39-.32z" fill="#E27625" stroke="#E27625"/>
        <path d="M10.26 28.88l4.47-2.16-3.85-3.01z" fill="#E27625" stroke="#E27625"/>
        <path d="M20.27 26.72l4.46 2.16-.6-5.17z" fill="#E27625" stroke="#E27625"/>
        <path d="M24.73 28.88l-4.46-2.16.36 2.9-.04 1.22z" fill="#D5BFB2" stroke="#D5BFB2"/>
        <path d="M10.26 28.88l4.15 1.96-.03-1.22.34-2.9z" fill="#D5BFB2" stroke="#D5BFB2"/>
        <path d="M14.48 21.78l-3.7-1.09 2.61-1.2z" fill="#233447" stroke="#233447"/>
        <path d="M20.51 21.78l1.09-2.29 2.62 1.2z" fill="#233447" stroke="#233447"/>
        <path d="M10.26 28.88l.65-5.33-4.15.12z" fill="#CC6228" stroke="#CC6228"/>
        <path d="M24.08 23.55l.65 5.33 3.5-5.21z" fill="#CC6228" stroke="#CC6228"/>
        <path d="M27.23 17.6l-7.39.32.68 3.86 1.09-2.29 2.62 1.2z" fill="#CC6228" stroke="#CC6228"/>
        <path d="M10.78 20.69l2.61-1.2 1.09 2.29.68-3.86-7.4-.32z" fill="#CC6228" stroke="#CC6228"/>
        <path d="M7.78 17.6l3.11 6.06-.11-3.01zm16.45 3.05l-.12 3.01 3.12-6.06zm-9.05-2.73l-.68 3.86.85 4.4.2-5.79zm5.66 0l-.36 2.45.16 5.81.86-4.4z" fill="#E27525" stroke="#E27525"/>
        <path d="M20.51 21.78l-.86 4.4.62.43 3.85-3.01.12-3.01zm-9.73-1.19l.11 3.01 3.85 3.01.62-.43-.85-4.4z" fill="#F5841F" stroke="#F5841F"/>
        <path d="M20.55 30.84l.04-1.22-.34-.29h-4.5l-.31.29.03 1.22-4.15-1.96 1.45 1.19 2.94 2.04h5.06l2.95-2.04 1.45-1.19z" fill="#C0AC9D" stroke="#C0AC9D"/>
        <path d="M20.27 26.72l-.62-.43h-3.31l-.61.43-.34 2.9.31-.29h4.5l.34.29z" fill="#161616" stroke="#161616"/>
        <path d="M33.52 11.35L34.64 6 32.96 1 20.27 10.41l4.89 4.1 6.9 2.02 1.53-1.78-.66-.48 1.06-.97-.81-.62 1.06-.81zM.36 6l1.12 5.35-.71.53 1.05.81-.8.62 1.05.97-.66.48 1.53 1.78 6.9-2.02 4.89-4.1L2.04 1z" fill="#763E1A" stroke="#763E1A"/>
        <path d="M32.07 16.53l-6.9-2.02 2.06 3.09-3.11 6.06 4.12-.05h6.16zm-22.23-2.02l-6.9 2.02-2.32 7.08H6.79l4.12.05-3.11-6.06zm10.16 3.78l.44-7.59 1.99-5.39h-8.86l1.99 5.39.44 7.59.17 2.39.01 5.78h3.65l.01-5.78z" fill="#F5841F" stroke="#F5841F"/>
      </g>
    </svg>
  );
}

function CoinbaseWalletMark() {
  // Coinbase: blue circle with inner white circle
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#0052FF"/>
      <path d="M16 6.4c-5.302 0-9.6 4.298-9.6 9.6s4.298 9.6 9.6 9.6 9.6-4.298 9.6-9.6S21.302 6.4 16 6.4zm-2.667 12.8a.667.667 0 01-.666-.667v-5.066c0-.368.298-.667.666-.667h5.334c.368 0 .666.299.666.667v5.066c0 .368-.298.667-.666.667h-5.334z" fill="#FFFFFF"/>
    </svg>
  );
}

function WalletConnectMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#3B99FC"/>
      <path d="M9.585 12.4a8.876 8.876 0 0112.83 0l.426.434a.43.43 0 010 .61l-1.459 1.482a.215.215 0 01-.301 0l-.586-.595a6.193 6.193 0 00-8.99 0l-.626.635a.215.215 0 01-.301 0l-1.46-1.483a.43.43 0 010-.61zm15.85 2.94l1.298 1.32a.43.43 0 010 .61l-5.858 5.948a.43.43 0 01-.602 0l-4.158-4.222a.108.108 0 00-.15 0l-4.158 4.222a.43.43 0 01-.601 0L5.348 17.27a.43.43 0 010-.61l1.298-1.32a.43.43 0 01.601 0l4.158 4.223a.108.108 0 00.151 0l4.158-4.223a.43.43 0 01.602 0l4.158 4.223a.108.108 0 00.15 0l4.158-4.223a.43.43 0 01.601 0z" fill="#FFFFFF"/>
    </svg>
  );
}

function InjectedMark() {
  // Clean generic wallet — used only when no name/icon match
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <path d="M9 11.5h11a3 3 0 013 3v6a3 3 0 01-3 3h-11a3 3 0 01-3-3v-6a3 3 0 013-3z" stroke="#b08d57" strokeWidth="1.5"/>
      <path d="M18 17.5h2.5" stroke="#b08d57" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 11.5v-2a2 2 0 012-2h8" stroke="#b08d57" strokeWidth="1.5"/>
    </svg>
  );
}

function WalletIconFallback({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("metamask")) return <MetaMaskMark />;
  if (n.includes("coinbase")) return <CoinbaseWalletMark />;
  if (n.includes("walletconnect") || n === "walletconnect") return <WalletConnectMark />;
  return <InjectedMark />;
}

// Helper text for the universal connectors so users know what works without a
// browser extension (the key to "connect any wallet").
function connectorSubtitle(id: string): string | null {
  if (id === "walletConnect") return "Scan with any mobile wallet";
  if (id.toLowerCase().includes("coinbase")) return "No extension needed";
  return null;
}

export function WalletButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [open, setOpen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionTimeoutId, setConnectionTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // SSR/hydration guard — wagmi resolves isConnected/address asynchronously
  // from localStorage on the client. Rendering the Connected branch before
  // mount produces a different tree than the server did, throwing React
  // error #418 and (critically) preventing onClick handlers across the
  // entire app from binding correctly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const wrongNetwork = mounted && isConnected && chainId !== HYPER_EVM_CHAIN_ID;
  // EIP-6963 wallets (MetaMask, Phantom, Rabby, Coinbase extension, …) each show
  // up as their own connector with an icon. If none are discovered the user has no
  // browser wallet — but can still connect via WalletConnect (QR) or Coinbase, so
  // this drives a helpful note, not a dead end. (window.ethereum is unreliable
  // under EIP-6963 — some wallets only announce via events.)
  const injectedDetected = connectors.some(
    (c) => c.id !== "walletConnect" && !c.id.toLowerCase().includes("coinbase") && Boolean((c as { icon?: string }).icon)
  );
  const noInjected = mounted && !injectedDetected;

  // Clear connection error when modal opens
  useEffect(() => {
    if (open) setConnectionError(null);
  }, [open]);

  // Set up connection timeout when connecting starts
  useEffect(() => {
    if (isConnecting) {
      const timer = setTimeout(() => {
        setConnectionError("Connection timed out. Try again or use a different wallet.");
      }, 15000);
      setConnectionTimeoutId(timer);
      return () => clearTimeout(timer);
    } else {
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
        setConnectionTimeoutId(null);
      }
    }
  }, [isConnecting]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Listen for open-wallet-modal event from Nav
  useEffect(() => {
    const handler = () => { if (!isConnected) setOpen(true); };
    window.addEventListener("open-wallet-modal", handler);
    return () => window.removeEventListener("open-wallet-modal", handler);
  }, [isConnected]);

  // NOTE: auto-reconnect is handled by wagmi's WagmiProvider (reconnectOnMount
  // defaults to true). A manual connect() on mount here raced with wagmi's own
  // hydration (<Hydrate>) and triggered a "setState while rendering" warning that
  // could break onClick binding across the app — so it's intentionally removed.

  async function handleConnect(connectorUid: string) {
    const connector = connectors.find(c => c.uid === connectorUid);
    if (!connector) return;
    setConnectionError(null);
    setOpen(false); // close the modal deterministically before the wallet prompt
    try {
      connect({ connector });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled") || msg.includes("rejected the request")) {
        setConnectionError("Connection rejected. Please approve the request in your wallet.");
      } else if (msg.includes("timeout")) {
        setConnectionError("Connection timed out. Try again or use a different wallet.");
      } else {
        setConnectionError(msg || "Failed to connect. Please try again.");
      }
    }
  }

  function handleSwitchNetwork() {
    switchChain({ chainId: HYPER_EVM_CHAIN_ID });
  }

  if (mounted && isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {/* Network indicator dot */}
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center border"
          style={{ background: wrongNetwork ? "rgba(194,53,63,0.15)" : "rgba(139,30,45,0.2)", borderColor: wrongNetwork ? "rgba(194,53,63,0.4)" : "rgba(139,30,45,0.4)" }}
          title={wrongNetwork ? "Wrong network — switch to HyperEVM Testnet" : "HyperEVM Testnet"}
        >
          <div className="h-2 w-2 rounded-full" style={{ background: wrongNetwork ? "#c2353f" : "#b08d57", boxShadow: wrongNetwork ? "0 0 8px #c2353f" : "0 0 8px #b08d57" }} />
        </div>

        <span className="hidden sm:block font-mono text-xs" style={{ color: "#bfc3c7" }}>{shorten(address)}</span>

        {wrongNetwork ? (
          <button
            onClick={handleSwitchNetwork}
            className="rounded-lg border px-3 py-1.5 text-xs transition-all duration-300"
            style={{
              background: "rgba(194,53,63,0.1)",
              borderColor: "rgba(194,53,63,0.4)",
              color: "#c2353f",
              fontFamily: "var(--font-montserrat), sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#c2353f";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(194,53,63,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(194,53,63,0.4)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(194,53,63,0.1)";
            }}
          >
            Switch Network
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            className="rounded-lg border px-3 py-1.5 text-xs transition-all duration-300"
            style={{
              background: "transparent",
              borderColor: "#2a2f3a",
              color: "#bfc3c7",
              fontFamily: "var(--font-montserrat), sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#8b1e2d";
              (e.currentTarget as HTMLButtonElement).style.color = "#c2353f";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2f3a";
              (e.currentTarget as HTMLButtonElement).style.color = "#bfc3c7";
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isConnecting}
        className="rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-300 flex items-center gap-2"
        style={{
          background: isConnecting ? "rgba(139,30,45,0.1)" : "rgba(139,30,45,0.2)",
          borderColor: isConnecting ? "rgba(139,30,45,0.3)" : "rgba(139,30,45,0.45)",
          color: isConnecting ? "#b08d57" : "#c2353f",
          fontFamily: "var(--font-montserrat), sans-serif",
        }}
      >
        {isConnecting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Connecting…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16 12h.01M8 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M6 10V8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2v-2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Connect Wallet
          </>
        )}
        {!isConnecting && (
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-[100]"
          style={{
            background: "rgba(20, 20, 23, 0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid #2a2f3a",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(139, 30, 45, 0.08)",
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: "1px solid #2a2f3a" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "#bfc3c7" }}>Select wallet</p>
          </div>

          {noInjected && (
            <div className="px-4 py-3" style={{ borderBottom: "1px solid #2a2f3a" }}>
              <p className="text-xs leading-relaxed" style={{ color: "#bfc3c7", fontFamily: "var(--font-montserrat), sans-serif" }}>
                No browser wallet extension found. Use{" "}
                <span style={{ color: "#b08d57" }}>WalletConnect</span> to scan with any mobile wallet
                (MetaMask, Phantom, Rabby, Trust…), or Coinbase below — both work without an extension.
                To use an extension, install one and refresh.
              </p>
            </div>
          )}

          {connectionError && (
            <div className="px-4 py-2" style={{ borderBottom: "1px solid #2a2f3a" }}>
              <p className="text-xs" style={{ color: "#c2353f", fontFamily: "var(--font-montserrat), sans-serif" }}>
                {connectionError}
              </p>
            </div>
          )}

          <div className="py-2">
            {connectors
              .filter((c, _i, arr) => {
                // Hide the generic "Injected" fallback when EIP-6963 wallets
                // (Rabby, MetaMask, Phantom, etc.) are also detected — it's
                // a duplicate row that confuses users.
                if (c.name === "Injected" && arr.length > 1) return false;
                return true;
              })
              .map((connector) => {
              const name = connector.name ?? "Unknown Wallet";
              // Wagmi / EIP-6963 detected wallets expose their own icon
              // (data URL or HTTP URL). Prefer it over our fallback marks
              // so e.g. Rabby, Phantom, Frame, etc. show their real logos.
              const connectorIcon = (connector as { icon?: string }).icon;
              return (
                <button
                  key={connector.uid}
                  onClick={() => {
                    handleConnect(connector.uid);
                    if (!isConnecting) setOpen(false);
                  }}
                  disabled={isConnecting}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors disabled:opacity-50"
                  style={{ color: "#bfc3c7" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(139, 30, 45, 0.08)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#eaeaea";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "#bfc3c7";
                  }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden flex-shrink-0">
                    {connectorIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={connectorIcon}
                        alt={name}
                        width={28}
                        height={28}
                        className="h-7 w-7 object-contain"
                      />
                    ) : (
                      <WalletIconFallback name={name} />
                    )}
                  </span>
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-montserrat), sans-serif" }}>{name}</span>
                    {connectorSubtitle(connector.id) && (
                      <span className="text-[11px]" style={{ color: "#6a6f75", fontFamily: "var(--font-montserrat), sans-serif" }}>
                        {connectorSubtitle(connector.id)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
