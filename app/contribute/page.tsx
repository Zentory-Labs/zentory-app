"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";

export default function ContributePage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push("/contribute/dashboard");
    }
  }, [isConnected, router]);

  function handleConnect() {
    window.dispatchEvent(new Event("open-wallet-modal"));
  }

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#b08d57]/6 rounded-full blur-3xl pointer-events-none" />

      {/* Icon */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
        style={{ background: "rgba(176,141,87,0.12)", border: "1px solid rgba(176,141,87,0.25)" }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#b08d57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 17L12 22L22 17" stroke="#b08d57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12L12 17L22 12" stroke="#b08d57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Badge */}
      <div
        className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold mb-6"
        style={{
          background: "rgba(176,141,87,0.08)",
          borderColor: "rgba(176,141,87,0.3)",
          color: "#b08d57",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#b08d57", boxShadow: "0 0 8px #b08d57" }} />
        Quant Research Network
      </div>

      {/* Heading */}
      <h1
        className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
        style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
      >
        Contribute Research
      </h1>
      <p
        className="text-base leading-relaxed max-w-lg mb-10"
        style={{ color: "rgba(234,234,234,0.55)", fontFamily: "'Montserrat', sans-serif" }}
      >
        Build a publicly verifiable on-chain track record. Stake ZENT as a bond against accuracy. Receive ZENT credits for premium access when your research contributes to the ZENT Alpha Vault.
      </p>

      {/* connect button */}
      <button
        onClick={handleConnect}
        className="px-8 py-4 rounded-2xl font-bold text-base transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #b08d57 0%, #8b6635 100%)",
          color: "#0b0b0d",
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: "0 0 40px rgba(176,141,87,0.25)",
        }}
      >
        Connect Wallet
      </button>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-3xl">
        {[
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b08d57" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ),
            title: "API Key Management",
            desc: "Generate and revoke API keys to authenticate your research submissions",
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b08d57" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            ),
            title: "Publish Research",
            desc: "Submit directional research with confidence scores and expiry windows",
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b08d57" strokeWidth="1.5">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            ),
            title: "Performance Analytics",
            desc: "Track accuracy, rank, and ZENT payouts across epochs",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl p-5 text-left"
            style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(176,141,87,0.1)", border: "1px solid rgba(176,141,87,0.2)" }}
            >
              {f.icon}
            </div>
            <h3
              className="text-sm font-bold mb-1"
              style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
            >
              {f.title}
            </h3>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "rgba(234,234,234,0.45)", fontFamily: "'Montserrat', sans-serif" }}
            >
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
