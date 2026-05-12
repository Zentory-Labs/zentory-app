"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useDisconnect, useConnect, useChainId, useSwitchChain } from "wagmi";

const HYPER_EVM_CHAIN_ID = 998;

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function WalletIconSvg({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("walletconnect")) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M1.5 6.5L6 10.5L1.5 14.5L1.5 6.5Z" stroke="#3b99fc" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8.5 14.5L11 10.5L8.5 6.5L8.5 14.5Z" stroke="#3b99fc" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M18.5 6.5L14 10.5L18.5 14.5L18.5 6.5Z" stroke="#3b99fc" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M14.5 6.5L12 10.5L14.5 14.5" stroke="#3b99fc" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (n.includes("metamask")) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M17.5 3L11 8.5L12.5 5.5L17.5 3Z" fill="#E17726" stroke="#E17726" strokeWidth="0.5"/>
        <path d="M2.5 3L9 8.5L7.5 5.5L2.5 3Z" fill="#E27625" stroke="#E27625" strokeWidth="0.5"/>
        <path d="M15.5 14L13 16L11.5 13.5L15.5 14Z" fill="#E27625" stroke="#E27625" strokeWidth="0.5"/>
        <path d="M4.5 14L7 16L8.5 13.5L4.5 14Z" fill="#E27625" stroke="#E27625" strokeWidth="0.5"/>
        <path d="M9 10.5L11 13L9 14.5L9 10.5Z" fill="#E27625" stroke="#E27625" strokeWidth="0.5"/>
        <path d="M11 13L13 14.5L11 10.5L11 13Z" fill="#E27625" stroke="#E27625" strokeWidth="0.5"/>
      </svg>
    );
  }
  if (n.includes("coinbase")) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="#0052FF" strokeWidth="1.5"/>
        <path d="M10 6V14M7 9H13M7 11H13" stroke="#0052FF" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (n.includes("rabby")) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <ellipse cx="10" cy="10" rx="7" ry="5" stroke="#FFD43B" strokeWidth="1.5"/>
        <circle cx="7" cy="9" r="1" fill="#FFD43B"/>
        <circle cx="13" cy="9" r="1" fill="#FFD43B"/>
        <path d="M7 12C7 12 8.5 14 10 14C11.5 14 13 12 13 12" stroke="#FFD43B" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="#6a6f75" strokeWidth="1.5"/>
      <path d="M10 6V10L13 13" stroke="#6a6f75" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
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

  const wrongNetwork = isConnected && chainId !== HYPER_EVM_CHAIN_ID;
  const noWallet = typeof window !== "undefined" && !(window as Window & { ethereum?: unknown }).ethereum;

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

  // Auto-reconnect on mount using last connected connector
  useEffect(() => {
    if (isConnected || isConnecting) return;
    const lastConnectorUid = localStorage.getItem("lastConnector");
    if (!lastConnectorUid) return;
    const connector = connectors.find(c => c.uid === lastConnectorUid);
    if (!connector) return;
    setOpen(false);
    setConnectionError(null);
    connect({ connector });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect(connectorUid: string) {
    const connector = connectors.find(c => c.uid === connectorUid);
    if (!connector) return;
    setConnectionError(null);
    try {
      connect({ connector });
      localStorage.setItem("lastConnector", connectorUid);
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

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {/* Network indicator dot */}
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center border"
          style={{ background: wrongNetwork ? "rgba(239,68,68,0.15)" : "rgba(139,30,45,0.2)", borderColor: wrongNetwork ? "rgba(239,68,68,0.4)" : "rgba(139,30,45,0.4)" }}
          title={wrongNetwork ? "Wrong network — switch to HyperEVM Testnet" : "HyperEVM Testnet"}
        >
          <div className="h-2 w-2 rounded-full" style={{ background: wrongNetwork ? "#ef4444" : "#b08d57", boxShadow: wrongNetwork ? "0 0 8px #ef4444" : "0 0 8px #b08d57" }} />
        </div>

        <span className="hidden sm:block font-mono text-xs" style={{ color: "#bfc3c7" }}>{shorten(address)}</span>

        {wrongNetwork ? (
          <button
            onClick={handleSwitchNetwork}
            className="rounded-lg border px-3 py-1.5 text-xs transition-all duration-300"
            style={{
              background: "rgba(239,68,68,0.1)",
              borderColor: "rgba(239,68,68,0.4)",
              color: "#ef4444",
              fontFamily: "'Montserrat', sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.4)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)";
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
              color: "#6a6f75",
              fontFamily: "'Montserrat', sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#8b1e2d";
              (e.currentTarget as HTMLButtonElement).style.color = "#c2353f";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2f3a";
              (e.currentTarget as HTMLButtonElement).style.color = "#6a6f75";
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
          fontFamily: "'Montserrat', sans-serif",
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
            <p className="text-xs uppercase tracking-wider" style={{ color: "#6a6f75" }}>Select wallet</p>
          </div>

          {noWallet && (
            <div className="px-4 py-3" style={{ borderBottom: "1px solid #2a2f3a" }}>
              <p className="text-xs" style={{ color: "#ef4444", fontFamily: "'Montserrat', sans-serif" }}>
                No wallet detected. Install MetaMask or use WalletConnect.
              </p>
            </div>
          )}

          {connectionError && (
            <div className="px-4 py-2" style={{ borderBottom: "1px solid #2a2f3a" }}>
              <p className="text-xs" style={{ color: "#ef4444", fontFamily: "'Montserrat', sans-serif" }}>
                {connectionError}
              </p>
            </div>
          )}

          <div className="py-2">
            {connectors.map((connector) => {
              const name = connector.name ?? "Unknown Wallet";
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
                  <WalletIconSvg name={name} />
                  <span className="text-sm font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
