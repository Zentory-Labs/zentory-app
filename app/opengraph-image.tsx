import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "ZENTORY — Non-custodial crypto vaults that defend the drawdowns, on HyperEVM";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette
const BG = "#0b0b0d";
const RED = "#8b1e2d";
const RED_GLOW = "rgba(194, 53, 63, 0.35)";
const GOLD = "#b08d57";
const TEXT = "#eaeaea";
const TEXT_DIM = "rgba(234,234,234,0.6)";

export default async function OpenGraphImage() {
  // Use the LIGHT logo on the dark OG background — the dark logo file is
  // meant for light backgrounds and would render nearly invisible here.
  const logoData = await readFile(
    join(process.cwd(), "public", "zentory_logo_light.png")
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          display: "flex",
          flexDirection: "column",
          padding: "72px 88px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Ambient brand glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: 9999,
            background: RED_GLOW,
            filter: "blur(120px)",
            opacity: 0.65,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -160,
            left: -160,
            width: 500,
            height: 500,
            borderRadius: 9999,
            background: "rgba(176, 141, 87, 0.15)",
            filter: "blur(120px)",
            opacity: 0.5,
            display: "flex",
          }}
        />

        {/* Header: logo + chain tag */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="ZENTORY" width={86} height={86} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 20px",
              background: "rgba(176, 141, 87, 0.12)",
              border: "1px solid rgba(176, 141, 87, 0.3)",
              borderRadius: 9999,
              color: GOLD,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            HyperEVM · Testnet
          </div>
        </div>

        {/* Main copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            zIndex: 1,
          }}
        >
          <div
            style={{
              color: GOLD,
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            ZENTORY Protocol
          </div>
          <div
            style={{
              color: TEXT,
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              maxWidth: 980,
              display: "flex",
            }}
          >
            Grow your crypto.
          </div>
          <div
            style={{
              color: RED,
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              maxWidth: 980,
              marginTop: 6,
              display: "flex",
            }}
          >
            Defend the drawdowns.
          </div>
          <div
            style={{
              color: TEXT_DIM,
              fontSize: 28,
              fontWeight: 500,
              marginTop: 28,
              display: "flex",
            }}
          >
            Deposit BTC · ETH · SOL · XRP. Verifiable track record. Your keys, always.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 56,
            color: TEXT_DIM,
            fontSize: 22,
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex" }}>app.zentorylabs.com</div>
          <div style={{ display: "flex", gap: 14 }}>
            <span>ERC-4626</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span>EIP-712 signed signals</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span>BSL 1.1</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
