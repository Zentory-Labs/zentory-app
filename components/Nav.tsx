"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletSelector";
import dynamic from "next/dynamic";

const WhitelistPopup = dynamic(() => import("./WhitelistPopup"), { ssr: false });

const NAV_LINKS = [
  { href: "/", label: "Vaults" },
  { href: "/research", label: "Research" },
  { href: "/markets", label: "Markets" },
  { href: "/subscribe", label: "Subscribe" },
  { href: "/contribute", label: "Contribute" },
];

export default function Nav() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navClass =
    "px-3 py-2 text-xs font-medium transition-all duration-200 uppercase tracking-[0.12em] relative group font-montserrat text-[#bfc3c7] hover:text-[#eaeaea]";
  const underlineClass =
    "absolute bottom-1 left-3 right-3 h-px transition-all duration-300 bg-transparent group-hover:bg-[rgba(194,53,63,0.5)]";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500
        backdrop-blur-2xl backdrop-saturate-150
        ${isScrolled
          ? "bg-[#0b0b0d]/70 border-b border-[#2a2f3a] shadow-lg shadow-black/40"
          : "bg-[#0b0b0d]/90 border-b border-[#2a2f3a]"}`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-start items-center h-20 gap-8 lg:gap-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0 z-10">
            <Image
              src="/zentory_logo_dark.png"
              alt="Zentory Labs"
              width={44}
              height={44}
              className="h-10 w-10 object-contain transition-all duration-300 group-hover:opacity-90 brightness-0 invert"
              priority
            />
            <span
              className="font-semibold tracking-tight transition-colors duration-300 text-white"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Zentory Labs
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link key={href} href={href} className={navClass}>
                  {label}
                  <span className={underlineClass} />
                  {isActive && (
                    <span className="absolute bottom-1 left-3 right-3 h-px" style={{ background: "#8b1e2d" }} />
                  )}
                </Link>
              );
            })}
            <a
              href="https://zentorylabs.com/whitepaper"
              target="_blank"
              rel="noopener noreferrer"
              className={`${navClass} text-[#6a6f75] hover:text-[#eaeaea]`}
            >
              Whitepaper
              <span className={underlineClass} />
            </a>
          </div>

      {/* Wallet — right side */}
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
        <WalletButton />

            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-white/[0.08] animate-in slide-in-from-top bg-black/50 backdrop-blur-xl">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 font-light uppercase tracking-wider text-sm transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <a
              href="https://zentorylabs.com/whitepaper"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 font-light uppercase tracking-wider text-sm transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Whitepaper
            </a>
          </div>
        )}
      </nav>
    </header>
  );
}
