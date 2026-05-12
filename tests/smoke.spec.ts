import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home loads and renders hero + swap", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /multi-asset alpha vault/i })).toBeVisible();
    await expect(page.getByText("Earn systematic yield")).toBeVisible();
  });

  test("stake page loads", async ({ page }) => {
    await page.goto("/stake");
    await expect(page.getByRole("heading", { name: /zent staking/i })).toBeVisible();
    await expect(page.getByText("Stake ZENT")).toBeVisible();
  });

  test("research page loads", async ({ page }) => {
    await page.goto("/research");
    await expect(page.getByRole("heading", { name: /research dashboard/i })).toBeVisible();
  });

  test("govern page loads", async ({ page }) => {
    await page.goto("/govern");
    await expect(page.getByRole("link", { name: "Zentory Labs" }).first()).toBeVisible();
  });
});

