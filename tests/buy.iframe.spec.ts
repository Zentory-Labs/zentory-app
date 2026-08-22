import { test, expect } from "@playwright/test";

/**
 * /buy page — Onramper iframe (gated-open) tests, VAL-DAPP-058.
 *
 * These tests self-skip when NEXT_PUBLIC_ONRAMPER_API_KEY is unset. They
 * verify the iframe branch that activates once the founder sets the key
 * in Vercel env. Run them locally with:
 *
 *   NEXT_PUBLIC_ONRAMPER_API_KEY=pk_test_xyz npx playwright test tests/buy.iframe.spec.ts
 *
 * The placeholder-state tests in tests/buy.spec.ts cover the default
 * (founder-gated) state where the key is unset and the iframe is absent.
 *
 * Why a separate file: `process.env.NEXT_PUBLIC_*` is inlined at build/dev
 * time by Next.js, so the value is baked into the page module when the
 * dev server starts. Setting the env var inside a test (e.g. via
 * page.addInitScript) cannot flip the rendered branch. A separate spec
 * file that the user (or CI) runs with the env var pre-set is the simplest
 * reliable approach.
 */

const ONRAMPER_KEY = process.env.NEXT_PUBLIC_ONRAMPER_API_KEY;

test.describe("/buy — Onramper iframe (VAL-DAPP-058, gated-open)", () => {
  test.beforeAll(() => {
    test.skip(
      !ONRAMPER_KEY,
      "Requires NEXT_PUBLIC_ONRAMPER_API_KEY to be set in the env (founder-gated). " +
        "Run with `NEXT_PUBLIC_ONRAMPER_API_KEY=pk_test_xyz npx playwright test tests/buy.iframe.spec.ts`",
    );
  });

  test("renders the Onramper iframe with the canonical src when NEXT_PUBLIC_ONRAMPER_API_KEY is set", async ({ page }) => {
    await page.goto("/buy");
    const iframe = page.locator('iframe[title="Buy crypto with Onramper"]');
    await expect(iframe).toBeVisible({ timeout: 15_000 });

    const src = await iframe.getAttribute("src");
    expect(src).not.toBeNull();
    expect(src!).toContain("https://buy.onramper.com/");
    expect(src!).toContain("mode=buy");
    expect(src!).toContain("defaultCrypto=usdc");
    expect(src!).toContain("themeName=dark");
    expect(src!).toContain("apiKey=");
    // URLSearchParams URL-encodes "#" as %23 — match the contract spec.
    expect(src!).toContain("primaryColor=%23b08d57");
    // The configured key must appear in the src (not a placeholder).
    expect(src!).toContain(ONRAMPER_KEY!);
  });

  test("the iframe has the documented dimensions (630px tall)", async ({ page }) => {
    await page.goto("/buy");
    const iframe = page.locator('iframe[title="Buy crypto with Onramper"]');
    await expect(iframe).toBeVisible({ timeout: 15_000 });

    // Per the assertion spec, the iframe should accommodate a 630px height.
    const height = await iframe.getAttribute("height");
    expect(height).toBe("630");
  });

  test("the placeholder is NOT rendered when the iframe is shown", async ({ page }) => {
    await page.goto("/buy");
    await expect(page.locator('iframe[title="Buy crypto with Onramper"]')).toBeVisible({ timeout: 15_000 });

    // The placeholder pill must not appear in the gated-open branch.
    // (Both branches share the funnel narrative + intro copy — only the
    //  ramp widget itself toggles.)
    const placeholder = page.getByText(/^Coming soon$/i);
    await expect(placeholder).toHaveCount(0);
  });
});
