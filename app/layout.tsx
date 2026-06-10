import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Image from "next/image";
import Link from "next/link";
import Providers from "@/components/Providers";
import Nav from "@/components/Nav";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { DemoBanner } from "@/lib/demo/context";
import "./globals.css";

// Self-host Montserrat — removes the render-blocking fonts.googleapis.com
// request (Lighthouse: ~450ms saved + cleaner CWV scores).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.zentorylabs.com"),
  title: {
    default: "ZENTORY Protocol — Non-Custodial Crypto Vaults on HyperEVM",
    template: "%s · ZENTORY",
  },
  description:
    "Grow your crypto, defend the drawdowns. Non-custodial BTC, ETH, SOL & XRP vaults on HyperEVM — a transparent on-chain strategy with a public, verifiable track record. Your keys, always.",
  keywords: [
    "ZENTORY Protocol", "ZENT token", "HyperEVM", "Hyperliquid",
    "non-custodial vault", "ERC-4626 vault", "drawdown protection",
    "BTC yield", "on-chain track record", "trend following", "EIP-712",
  ],
  // Explicit robots directive — defaults to index/follow but better to be
  // unambiguous for crawlers + Lighthouse SEO score.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    // Canonical for the homepage. Per-route pages can override via their
    // own generateMetadata if they need a different canonical.
    canonical: "https://app.zentorylabs.com",
  },
  openGraph: {
    title: "ZENTORY Protocol — Non-Custodial Crypto Vaults on HyperEVM",
    description:
      "Grow your crypto, defend the drawdowns. Non-custodial BTC, ETH, SOL & XRP vaults on HyperEVM with a public, verifiable track record. Your keys, always.",
    url: "https://app.zentorylabs.com",
    siteName: "ZENTORY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@ZENTORYLabs",
    creator: "@ZENTORYLabs",
    title: "ZENTORY Protocol",
    description:
      "Non-custodial crypto vaults that defend the drawdowns — with a verifiable on-chain track record.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-screen text-white antialiased" suppressHydrationWarning>
        <Providers>
          <DemoBanner />
          <Nav />
          <main className="mx-auto max-w-7xl px-6 pt-24 pb-8">
            {children}
          </main>
          <footer className="text-[#bfc3c7]">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
              <div className="flex flex-col items-center text-center">

                {/* Logo */}
                <Link href="/" className="mb-6">
                  <Image
                    src="/zentory_logo_light.png"
                    alt="Zentory Labs"
                    width={160}
                    height={45}
                    className="h-10 w-auto object-contain"
                    style={{ opacity: 0.75 }}
                  />
                </Link>

                {/* Site map — every reachable page grouped by section.
                    Mirrors the top-nav dropdowns so investors can find any
                    surface even if they skipped the dropdown. */}
                <div className="w-full max-w-5xl mb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 text-left">
                  {[
                    {
                      label: "Vaults",
                      items: [
                        ["Overview", "/"],
                        ["zBTC", "/vaults/zBTC"],
                        ["zETH", "/vaults/zETH"],
                        ["zSOL", "/vaults/zSOL"],
                        ["zXRP", "/vaults/zXRP"],
                        ["Dashboard", "/dashboard"],
                        ["Faucet", "/faucet"],
                      ],
                    },
                    {
                      label: "Research",
                      items: [
                        ["Signal Arena", "/signals"],
                        ["Leaderboard", "/leaderboard"],
                        ["Research Feed", "/research"],
                        ["Markets", "/markets"],
                      ],
                    },
                    {
                      label: "Token",
                      items: [
                        ["Stake ZENT", "/stake"],
                        ["Subscribe", "/subscribe"],
                        ["Governance", "/govern"],
                      ],
                    },
                    {
                      label: "Contribute",
                      items: [
                        ["Become a Contributor", "/contribute"],
                        ["Dashboard", "/contribute/dashboard"],
                        ["API Keys", "/contribute/api-keys"],
                        ["My Submissions", "/contribute/submissions"],
                      ],
                    },
                    {
                      label: "Protocol",
                      items: [
                        ["State of Protocol", "/state-of-protocol"],
                        ["Bug Bounty", "/bug-bounty"],
                        ["Whitepaper", "https://zentorylabs.com/whitepaper"],
                        ["Tokenomics", "https://zentorylabs.com/tokenomics"],
                      ],
                    },
                  ].map((col) => (
                    <div key={col.label}>
                      <div
                        className="text-[10px] uppercase tracking-widest font-bold mb-3"
                        style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
                      >
                        {col.label}
                      </div>
                      <ul className="space-y-0.5">
                        {col.items.map(([label, href]) => {
                          const external = href.startsWith("http");
                          // py-2 + text-sm ≈ 36px tap target on mobile.
                          const linkClass = "block py-2 text-sm transition-colors hover:!text-[#eaeaea]";
                          const linkStyle = { color: "rgba(191,195,199,0.6)", fontFamily: "'Montserrat', sans-serif" } as const;
                          if (external) {
                            return (
                              <li key={href}>
                                <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass} style={linkStyle}>
                                  {label} ↗
                                </a>
                              </li>
                            );
                          }
                          return (
                            <li key={href}>
                              <Link href={href} className={linkClass} style={linkStyle}>
                                {label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Legal & risk disclosure section — lifted container */}
                <div
                  className="w-full max-w-2xl rounded-2xl p-5 mb-6"
                  style={{ background: "#111114", border: "1px solid rgba(42,47,58,0.6)" }}
                >
                  <p className="text-[11px] uppercase tracking-wider font-semibold mb-3" style={{ color: "rgba(191,195,199,0.65)", fontFamily: "'Montserrat', sans-serif" }}>
                    Legal &amp; risk disclosure
                  </p>
                  <LegalDisclaimer variant="footer" className="mb-4" />
                </div>

                {/* Links — block padding so they're ≥36px tap targets on mobile */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-sm" style={{ color: "rgba(191,195,199,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
                  <span className="py-2">© {currentYear} Zentory Labs</span>
                  <a href="https://zentorylabs.com/terms-of-service" target="_blank" rel="noopener noreferrer" className="py-2 px-3 transition-colors hover:!text-[#b08d57]" style={{ color: "rgba(191,195,199,0.6)" }}>
                    Terms of Service
                  </a>
                  <a href="https://zentorylabs.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="py-2 px-3 transition-colors hover:!text-[#b08d57]" style={{ color: "rgba(191,195,199,0.6)" }}>
                    Privacy Policy
                  </a>
                </div>

              </div>
            </div>

            {/* Risk disclaimer strip */}
            <div
              className="py-5 px-6 border-t"
              style={{ background: "#0d0d10", borderColor: "rgba(42,47,58,0.5)" }}
            >
              <p className="text-center text-[13px]" style={{ color: "rgba(191,195,199,0.55)", fontFamily: "'Montserrat', sans-serif" }}>
                Not financial or legal advice. No offer or solicitation. High risk. Seek independent advice. See{' '}
                <a href="https://zentorylabs.com/terms-of-service" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#b08d57]" style={{ color: "rgba(191,195,199,0.55)" }}>
                  Terms
                </a>{' '}
                and risk disclosures.
              </p>
            </div>

          </footer>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
