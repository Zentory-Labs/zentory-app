"use client";

import { useState, useEffect } from "react";
import { insertWhitelistEmail } from "@/lib/whitelist";

const STORAGE_KEY = "zentory_waitlist_last_seen";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2353f" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function WhitelistPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const openHandler = () => setIsOpen(true);
    window.addEventListener("open-waitlist-modal", openHandler);

    return () => window.removeEventListener("open-waitlist-modal", openHandler);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    const result = await insertWhitelistEmail(email);
    if (result) {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
    >
      <div
        className="relative w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{
          background: "rgba(28,28,33,0.97)",
          border: "1px solid rgba(42,47,58,0.8)",
          backdropFilter: "blur(40px)",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
          style={{ color: "#6a6f75" }}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        {status === "success" ? (
          /* Success state */
          <div className="text-center py-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(139,30,45,0.15)", border: "1px solid rgba(139,30,45,0.3)" }}
            >
              <CheckIcon />
            </div>
            <h3
              id="waitlist-title"
              className="text-xl font-bold text-white mb-2"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              You&apos;re on the list.
            </h3>
            <p className="text-sm text-white/60 mb-6">
              Welcome to the Zentory waitlist. We&apos;ll send you an email with updates, early access, and everything that&apos;s coming.
            </p>
            <button
              onClick={handleClose}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: "#8b1e2d",
                color: "#eaeaea",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Got it
            </button>
          </div>
        ) : (
          /* Form state */
          <>
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{
                background: "rgba(139,30,45,0.15)",
                border: "1px solid rgba(139,30,45,0.3)",
                color: "#c2353f",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#c2353f", boxShadow: "0 0 6px #c2353f" }}
              />
              Early Access — Limited Spots
            </div>

            <h3
              id="waitlist-title"
              className="text-2xl font-bold text-white mb-2"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Join the Zentory Waitlist
            </h3>
            <p className="text-sm text-white/60 mb-6">
              Be first to access alpha vaults, research feeds, and protocol launches. No spam — ever.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3 mb-3"
                style={{
                  background: "rgba(11,11,13,0.6)",
                  border: errorMsg ? "1px solid rgba(194,53,63,0.6)" : "1px solid #2a2f3a",
                }}
              >
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg(""); }}
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                  disabled={status === "loading"}
                  required
                />
              </div>

              {errorMsg && (
                <p className="text-xs mb-3" style={{ color: "#c2353f" }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "loading" || !email}
                className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                style={{
                  background: status === "loading" ? "rgba(139,30,45,0.5)" : "#8b1e2d",
                  color: "#eaeaea",
                  fontFamily: "'Montserrat', sans-serif",
                  boxShadow: "0 0 30px rgba(139,30,45,0.3)",
                }}
                onMouseEnter={(e) => { if (status !== "loading" && email) (e.currentTarget as HTMLButtonElement).style.background = "#c2353f"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#8b1e2d"; }}
              >
                {status === "loading" ? "Joining..." : "Join Waitlist"}
              </button>
            </form>

            <p className="text-center text-xs mt-4" style={{ color: "rgba(106,111,117,0.7)" }}>
              No credit card required. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
