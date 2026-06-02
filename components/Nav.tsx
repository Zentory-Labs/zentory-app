"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletSelector";
import { useDemoMode } from "@/lib/demo/context";
import dynamic from "next/dynamic";

const WhitelistPopup = dynamic(() => import("./WhitelistPopup"), { ssr: false });

// ─── Nav structure ──────────────────────────────────────────────────────────
//
// 5 top-level groups, each with sub-pages. Items with `external` open
// off-site (marketing whitepaper). Items with `desc` show a one-line
// helper under the link inside the dropdown.

interface NavItem {
  href: string;
  label: string;
  desc?: string;
  external?: boolean;
}

interface NavGroup {
  label: string;
  // Either a direct link (no dropdown) or a list of children.
  href?: string;
  children?: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Vaults",
    children: [
      { href: "/", label: "Overview", desc: "All four Alpha Vaults at a glance" },
      { href: "/vaults/zBTC", label: "zBTC Vault", desc: "Wrapped Bitcoin" },
      { href: "/vaults/zETH", label: "zETH Vault", desc: "Wrapped Ethereum" },
      { href: "/vaults/zSOL", label: "zSOL Vault", desc: "Wrapped Solana" },
      { href: "/vaults/zXRP", label: "zXRP Vault", desc: "Wrapped XRP" },
      { href: "/vaults/spot", label: "Spot Strategy Vault", desc: "BTC long ⇄ flat · oracle-valued · testnet research" },
      { href: "/dashboard", label: "Protocol Dashboard", desc: "Aggregate TVL, alpha, capital flow" },
      { href: "/faucet", label: "Testnet Faucet", desc: "Mint mock assets for testing" },
    ],
  },
  {
    label: "Research",
    children: [
      { href: "/signals", label: "Signal Arena", desc: "Live feed from on-chain SignalRegistry" },
      { href: "/leaderboard", label: "Leaderboard", desc: "Conviction-ranked quant contributors" },
      { href: "/research", label: "Research Feed", desc: "Published market-structure analysis" },
      { href: "/markets", label: "Supported Markets", desc: "Live + roadmap markets" },
    ],
  },
  {
    label: "Token",
    children: [
      { href: "/stake", label: "Stake ZENT", desc: "Lock for veZENT governance + vault access" },
      { href: "/subscribe", label: "Subscribe", desc: "3 tiers paid in ZENT — crypto / equity / multi-asset" },
      { href: "/govern", label: "Governance", desc: "Vote on protocol parameters" },
    ],
  },
  {
    label: "Contribute",
    children: [
      { href: "/contribute", label: "Become a Contributor", desc: "Stake ZENT, publish, earn payouts" },
      { href: "/contribute/dashboard", label: "Contributor Dashboard", desc: "Your performance + payouts" },
      { href: "/contribute/api-keys", label: "API Keys", desc: "Generate keys for programmatic submission" },
      { href: "/contribute/submissions", label: "My Submissions", desc: "History of your published research" },
    ],
  },
  {
    label: "Protocol",
    children: [
      { href: "/state-of-protocol", label: "State of Protocol", desc: "All 26 contracts + security posture" },
      { href: "/bug-bounty", label: "Bug Bounty", desc: "Security disclosure program" },
      { href: "https://zentorylabs.com/whitepaper", label: "Whitepaper", desc: "Architecture + tokenomics + roadmap", external: true },
      { href: "https://zentorylabs.com/tokenomics", label: "Tokenomics", desc: "ZENT supply, distribution, buyback", external: true },
    ],
  },
];

export default function Nav() {
  const pathname = usePathname();
  const { enabled: demoMode, toggle: toggleDemo } = useDemoMode();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Click-outside dismiss: if the dropdown is open and the user clicks
  // anywhere outside the nav header, close it. Belt-and-braces in case the
  // hover-leave never fires (e.g. cursor exits the viewport from the top).
  useEffect(() => {
    if (!openGroup) return;
    function onClickAway(e: MouseEvent) {
      if (!navRootRef.current) return;
      if (navRootRef.current.contains(e.target as Node)) return;
      setOpenGroup(null);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [openGroup]);

  // Escape closes the dropdown — keyboard accessibility.
  useEffect(() => {
    if (!openGroup) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openGroup]);

  // Close any open dropdown on route change so it doesn't stick after click.
  useEffect(() => {
    setOpenGroup(null);
    setIsMenuOpen(false);
    setOpenMobileGroup(null);
  }, [pathname]);

  function isGroupActive(group: NavGroup): boolean {
    if (group.href && pathname === group.href) return true;
    return Boolean(group.children?.some((c) => !c.external && pathname === c.href));
  }

  function handleEnter(label: string) {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenGroup(label);
  }
  function handleLeave() {
    // 400ms grace so users can move from trigger → menu (across a small
    // transparent invisible-hover-bridge) without losing the dropdown.
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenGroup(null), 400);
  }

  return (
    <header
      ref={navRootRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500
        backdrop-blur-2xl backdrop-saturate-150
        ${isScrolled
          ? "bg-[#0b0b0d]/70 border-b border-[#2a2f3a] shadow-lg shadow-black/40"
          : "bg-[#0b0b0d]/90 border-b border-[#2a2f3a]"}`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-start items-center h-20 gap-6 lg:gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0 z-10">
            <Image
              src="/zentory_logo_dark.png"
              alt=""
              aria-hidden
              width={40}
              height={40}
              sizes="40px"
              className="h-10 w-10 object-contain transition-all duration-300 group-hover:opacity-90 brightness-0 invert"
              priority
            />
            <span
              className="font-semibold tracking-tight transition-colors duration-300 text-white whitespace-nowrap"
              style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif" }}
            >
              Zentory Labs
            </span>
          </Link>

          {/* Desktop nav with dropdowns */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_GROUPS.map((group) => {
              const isOpen = openGroup === group.label;
              const isActive = isGroupActive(group);
              // Direct-link groups (no children) render as a plain link.
              if (group.href && !group.children) {
                return (
                  <Link
                    key={group.label}
                    href={group.href}
                    className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors font-montserrat text-[#bfc3c7] hover:text-[#eaeaea] relative"
                  >
                    {group.label}
                    {isActive && (
                      <span className="absolute bottom-1 left-3 right-3 h-px" style={{ background: "#8b1e2d" }} />
                    )}
                  </Link>
                );
              }
              return (
                <div
                  key={group.label}
                  // The wrapper grows to encompass the whole h-20 navbar slot
                  // so when the cursor moves down from the trigger toward the
                  // dropdown it never leaves a hoverable area. This was the
                  // root cause of the flaky open/close behavior.
                  className="relative h-20 flex items-center"
                  onMouseEnter={() => handleEnter(group.label)}
                  onMouseLeave={handleLeave}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors font-montserrat text-[#bfc3c7] hover:text-[#eaeaea] relative"
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onClick={() => setOpenGroup(isOpen ? null : group.label)}
                  >
                    {group.label}
                    <svg
                      className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                    {isActive && (
                      <span className="absolute bottom-1 left-3 right-3 h-px" style={{ background: "#8b1e2d" }} />
                    )}
                  </button>

                  {/* Dropdown — flush to the trigger's bottom edge (no pt-2
                      gap) so the cursor never crosses a non-hoverable zone.
                      The wrapper has its own hover handlers as a safety net
                      in case the cursor leaves the parent's bounding box. */}
                  {isOpen && group.children && (
                    <div
                      className="absolute left-0 top-full w-72"
                      onMouseEnter={() => handleEnter(group.label)}
                      onMouseLeave={handleLeave}
                    >
                      <div
                        className="rounded-xl overflow-hidden border shadow-2xl shadow-black/60 mt-1"
                        style={{
                          background: "rgba(11,11,13,0.96)",
                          borderColor: "#2a2f3a",
                          backdropFilter: "blur(24px) saturate(150%)",
                        }}
                      >
                        {group.children.map((item) => {
                          const itemActive = !item.external && pathname === item.href;
                          const LinkComp = item.external ? "a" : Link;
                          const extraProps = item.external
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {};
                          // The hover styling lives in className-only because
                          // inline style={} always wins over Tailwind hover:.
                          // Active state uses a different className branch so
                          // it persists on the current page without competing
                          // with hover transitions.
                          const itemClasses = itemActive
                            ? "group/item block px-4 py-3 transition-colors border-l-2 border-l-[#8b1e2d] bg-[rgba(139,30,45,0.10)]"
                            : "group/item block px-4 py-3 transition-colors border-l-2 border-l-transparent hover:bg-[rgba(176,141,87,0.10)] hover:border-l-[#c2353f]";
                          return (
                            <LinkComp
                              key={item.href}
                              href={item.href}
                              {...extraProps}
                              className={itemClasses}
                              onClick={() => setOpenGroup(null)}
                            >
                              <div
                                className={`text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                                  itemActive ? "text-[#eaeaea]" : "text-[#bfc3c7] group-hover/item:text-[#eaeaea]"
                                }`}
                                style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif" }}
                              >
                                {item.label}
                                {item.external && (
                                  <svg className="h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 3h7v7M21 3l-9 9M5 7v12h12" />
                                  </svg>
                                )}
                              </div>
                              {item.desc && (
                                <div
                                  className="text-xs mt-0.5 transition-colors text-[#6a6f75] group-hover/item:text-[#b08d57]"
                                  style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif" }}
                                >
                                  {item.desc}
                                </div>
                              )}
                            </LinkComp>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right side — waitlist + demo + wallet + hamburger */}
          <div className="flex items-center gap-3 ml-auto">
            <WhitelistPopup />
            <button
              onClick={() => window.dispatchEvent(new Event("open-waitlist-modal"))}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(139,30,45,0.12)",
                borderColor: "rgba(139,30,45,0.35)",
                color: "#c2353f",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Join Waitlist
            </button>
            <button
              type="button"
              onClick={toggleDemo}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border"
              style={{
                background: demoMode ? "rgba(176,141,87,0.18)" : "rgba(176,141,87,0.05)",
                borderColor: demoMode ? "rgba(176,141,87,0.6)" : "rgba(176,141,87,0.25)",
                color: demoMode ? "#e6d3a0" : "#b08d57",
                fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              }}
              title={demoMode ? "Demo mode is ON — sample data shown on empty pages. Click to switch back to live data." : "Turn on demo mode to see what the protocol looks like with active signals, leaderboard, and indexed history."}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${demoMode ? "animate-pulse" : ""}`} style={{ background: demoMode ? "#e6d3a0" : "#b08d57" }} />
              {demoMode ? "Demo: On" : "Demo"}
            </button>
            <WalletButton />

            <button
              className="lg:hidden p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu — accordion sections */}
        {isMenuOpen && (
          <div className="lg:hidden py-2 border-t border-white/[0.08] bg-black/60 backdrop-blur-xl max-h-[calc(100vh-5rem)] overflow-y-auto">
            {NAV_GROUPS.map((group) => {
              const isOpen = openMobileGroup === group.label;
              const isActive = isGroupActive(group);
              if (group.href && !group.children) {
                return (
                  <Link
                    key={group.label}
                    href={group.href}
                    className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 font-medium uppercase tracking-wider text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {group.label}
                  </Link>
                );
              }
              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => setOpenMobileGroup(isOpen ? null : group.label)}
                    className="w-full flex items-center justify-between px-4 py-3 text-white/90 hover:bg-white/5 font-medium uppercase tracking-wider text-sm"
                    style={{
                      color: isActive ? "#eaeaea" : undefined,
                      background: isActive ? "rgba(139,30,45,0.08)" : undefined,
                    }}
                  >
                    <span>{group.label}</span>
                    <svg className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {isOpen && group.children && (
                    <div className="bg-black/40">
                      {group.children.map((item) => {
                        const LinkComp = item.external ? "a" : Link;
                        const extraProps = item.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {};
                        const itemActive = !item.external && pathname === item.href;
                        return (
                          <LinkComp
                            key={item.href}
                            href={item.href}
                            {...extraProps}
                            className="block pl-8 pr-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 text-xs"
                            style={{
                              color: itemActive ? "#eaeaea" : undefined,
                              background: itemActive ? "rgba(139,30,45,0.08)" : undefined,
                            }}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <div className="flex items-center gap-1.5 font-semibold">
                              {item.label}
                              {item.external && (
                                <svg className="h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 3h7v7M21 3l-9 9M5 7v12h12" />
                                </svg>
                              )}
                            </div>
                            {item.desc && <div className="text-[11px] opacity-60 mt-0.5">{item.desc}</div>}
                          </LinkComp>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Mobile demo toggle */}
            <div className="px-4 py-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={toggleDemo}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border"
                style={{
                  background: demoMode ? "rgba(176,141,87,0.18)" : "rgba(176,141,87,0.05)",
                  borderColor: demoMode ? "rgba(176,141,87,0.6)" : "rgba(176,141,87,0.25)",
                  color: demoMode ? "#e6d3a0" : "#b08d57",
                }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${demoMode ? "animate-pulse" : ""}`} style={{ background: demoMode ? "#e6d3a0" : "#b08d57" }} />
                {demoMode ? "Demo Mode: ON" : "Enable Demo Mode"}
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
