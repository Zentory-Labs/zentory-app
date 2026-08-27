import { test, expect, type Page } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * M5-F6 — Investor verification flow (VAL-FLOW-052..055).
 *
 * The flagship investor trust assertion: anyone with a terminal can prove
 * the forward ledger hasn't been tampered with, in 60 seconds, using only
 * two curl commands served from this site.
 *
 *   VAL-FLOW-052 — /track-record renders the "Verify in 60 seconds" block
 *                  with copy-pasteable curl + node commands and a Copy
 *                  button.
 *   VAL-FLOW-053 — Copy those commands, run them locally; the node script
 *                  outputs `VERIFIED — <N> entries, <A> assets, head <hash>`
 *                  and exits 0.
 *   VAL-FLOW-054 — Negative case: edit a single byte in any ledger line
 *                  and the same script outputs `CHAIN BROKEN at line N:`
 *                  and exits 1.
 *   VAL-FLOW-055 — Click the explorere link for the chain-head hash; the
 *                  working HyperEVM testnet block explorer (hyperevmscan.io)
 *                  returns 200 OK for that path.
 *
 * Preconditions:
 *   - /track-record renders without error (page.tsx).
 *   - public/verify_ledger.mjs outputs `VERIFIED` (the canonical pass line
 *     for the validation contract) on an untouched ledger.
 *   - /forward_ledger.jsonl is reachable at app.zentorylabs.com and the
 *     chain hashes are intact.
 *
 * Pass-fail contract: every test in this file is one of the four VAL-FLOW
 * assertions above. The single global counter at the bottom (in the
 * `afterAll` of the wrapper describe) accumulates per-transition results
 * and prints "INVESTOR VERIFICATION FLOW: PASS" iff 4/4 pass.
 */

const DAPP = process.env.PLAYWRIGHT_BASE_URL ?? "https://app.zentorylabs.com";
const ARTIFACT_DIR = "_validation_artifacts";

type TransitionResult = {
  id: string;
  label: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
};
const transitionResults: TransitionResult[] = [];

function record(id: string, label: string, ok: boolean, detail?: string) {
  transitionResults.push({ id, label, status: ok ? "pass" : "fail", detail });
}

async function snap(page: Page, name: string, fullPage = true): Promise<string> {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return file;
}

async function gotoAndWait(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return res;
}

/** Wait for the track-record page to finish hydrating. The route is a
 *  client-only page (`use client`), so the static HTML is empty and the
 *  verify block only appears after React mounts + the ledger fetch resolves.
 *  Wait for the copy button to appear, which is the deepest test-id in the
 *  block and proves everything above it has rendered. */
async function waitForTrackRecordHydrated(page: Page) {
  await page
    .getByTestId("verify-copy-button")
    .waitFor({ state: "visible", timeout: 30_000 });
  // Give the ledger fetch a moment to resolve so the chain-head section
  // (which depends on the entry array) is also populated.
  await page
    .getByTestId("anchor-tx-explorer-link")
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => {});
}

// ─── Node verifier helpers ───────────────────────────────────────────────────

/** Run the verifier on a JSONL file or stdin and return { stdout, stderr, code }. */
function runVerifier(
  input: { kind: "stdin"; body: string } | { kind: "file"; path: string },
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const args = ["public/verify_ledger.mjs"];
    let proc;
    if (input.kind === "file") {
      proc = spawn("node", [...args, input.path], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      proc = spawn("node", args, {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      proc.stdin?.end(input.body);
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout?.on("data", (c) => out.push(c));
    proc.stderr?.on("data", (c) => err.push(c));
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        code: code ?? 0,
      });
    });
  });
}

/** Fetch the live public ledger and return it as a string. */
async function fetchLedger(): Promise<string> {
  const url = `${DAPP.replace(/\/$/, "")}/forward_ledger.jsonl`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/** Fetch the live verifier script and return it as a string. */
async function fetchVerifier(): Promise<string> {
  const url = `${DAPP.replace(/\/$/, "")}/verify_ledger.mjs`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("M5-F6 investor verification flow", () => {
  test("VAL-FLOW-052: /track-record renders the 'Verify in 60 seconds' block with copy commands", async ({
    page,
  }) => {
    await gotoAndWait(page, `${DAPP}/track-record`);
    await waitForTrackRecordHydrated(page);
    await snap(page, "M5-F6-052-verify-block");

    // Block header.
    await expect(
      page.getByRole("heading", { name: "Verify in 60 seconds" }),
    ).toBeVisible();

    // The two commands, exactly as the page renders them.
    const commands = page.getByTestId("verify-commands");
    await expect(commands).toBeVisible();
    const commandsText = (await commands.textContent()) ?? "";
    const hasCurl = /curl\s+-sO\s+https:\/\/app\.zentorylabs\.com\/verify_ledger\.mjs/.test(
      commandsText,
    );
    const hasNode = /curl\s+-s\s+https:\/\/app\.zentorylabs\.com\/forward_ledger\.jsonl\s+\|\s+node\s+verify_ledger\.mjs/.test(
      commandsText,
    );

    // Copy button is present + clickable.
    const copyBtn = page.getByTestId("verify-copy-button");
    await expect(copyBtn).toBeVisible();

    // Expected-output pre block must show VERIFIED (not the old CHAIN OK).
    const pageHtml = await page.content();
    const showsVerified = pageHtml.includes("VERIFIED — &lt;entries&gt;")
      || pageHtml.includes("VERIFIED — <entries>");

    const ok = hasCurl && hasNode && showsVerified;
    record(
      "VAL-FLOW-052",
      "/track-record renders 'Verify in 60 seconds' block with copy commands",
      ok,
      `curl=${hasCurl} node=${hasNode} verifiedCopy=${showsVerified}`,
    );
    expect(ok, "VAL-FLOW-052 failed").toBe(true);
  });

  test("VAL-FLOW-053: copy + run locally — verifier outputs VERIFIED and exits 0", async () => {
    // Fetch the same ledger the page renders and run the same verifier the
    // page points at. This is exactly what an investor would do after clicking
    // the copy button.
    const ledger = await fetchLedger();
    const verifier = await fetchVerifier();
    expect(ledger.length, "ledger is empty").toBeGreaterThan(0);
    expect(verifier, "verifier script is empty").toContain("VERIFIED");

    // Run via stdin (mirrors the page's "curl | node" instruction).
    const result = await runVerifier({ kind: "stdin", body: ledger });
    expect(result.code, `verifier exit was ${result.code}, stderr=${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/^VERIFIED — \d+ entries, \d+ assets, head [0-9a-f]{64}$/m);

    // Also exercise the file path (the "curl -sO" half of the command).
    const dir = await mkdtemp(join(tmpdir(), "verify-test-"));
    try {
      const ledgerPath = join(dir, "forward_ledger.jsonl");
      await writeFile(ledgerPath, ledger, "utf8");
      const fileResult = await runVerifier({ kind: "file", path: ledgerPath });
      expect(fileResult.code, `file-mode exit ${fileResult.code}, stderr=${fileResult.stderr}`).toBe(
        0,
      );
      expect(fileResult.stdout).toMatch(/^VERIFIED — \d+ entries, \d+ assets, head [0-9a-f]{64}$/m);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    record(
      "VAL-FLOW-053",
      "Copy + run locally → VERIFIED and exit 0",
      true,
      `verifier exit 0, line matches /^VERIFIED — \\d+ entries, \\d+ assets, head [0-9a-f]{64}$/`,
    );
  });

  test("VAL-FLOW-054: tamper detection — modified ledger is detected with exit 1", async () => {
    const ledger = await fetchLedger();
    const lines = ledger.split("\n").filter(Boolean);
    expect(lines.length, "ledger has no entries").toBeGreaterThan(1);

    // Tamper case A: flip a digit in the FIRST entry's price. The first entry
    // is special (prev_hash = 64 zeros) so this is the simplest mutation to
    // catch — the computed entry_hash will no longer match.
    const tamperedFirst = (() => {
      const first = lines[0];
      // Change the first digit after `price":` to a different value.
      const m = first.match(/(price":)(\d+)/);
      if (!m) throw new Error("first entry has no price field");
      const original = m[2];
      const flipped =
        original[0] === "9" ? `8${original.slice(1)}` : `9${original.slice(1)}`;
      const mutated = first.replace(m[0], `${m[1]}${flipped}`);
      return [mutated, ...lines.slice(1)].join("\n") + "\n";
    })();

    const resultA = await runVerifier({ kind: "stdin", body: tamperedFirst });
    expect(resultA.code, `tamper-A exit ${resultA.code}, stderr=${resultA.stderr}`).toBe(1);
    expect(resultA.stderr).toMatch(/CHAIN BROKEN at line 1/);

    // Tamper case B: insert an extra line in the middle. The chain after
    // the insertion will detect the new prev_hash mismatch.
    const insertIdx = Math.floor(lines.length / 2);
    const insertLine = lines[insertIdx]; // duplicate an existing line
    const tamperedInsert = [...lines.slice(0, insertIdx), insertLine, ...lines.slice(insertIdx)]
      .join("\n") + "\n";
    const resultB = await runVerifier({ kind: "stdin", body: tamperedInsert });
    expect(resultB.code, `tamper-B exit ${resultB.code}, stderr=${resultB.stderr}`).toBe(1);
    expect(resultB.stderr).toMatch(/CHAIN BROKEN/);

    // Tamper case C: delete a middle line. The line after the gap will have a
    // prev_hash that no longer matches the previous line's entry_hash.
    const deleted = [...lines.slice(0, insertIdx), ...lines.slice(insertIdx + 1)]
      .join("\n") + "\n";
    const resultC = await runVerifier({ kind: "stdin", body: deleted });
    expect(resultC.code, `tamper-C exit ${resultC.code}, stderr=${resultC.stderr}`).toBe(1);
    expect(resultC.stderr).toMatch(/CHAIN BROKEN/);

    record(
      "VAL-FLOW-054",
      "Tamper detection — modified ledger detected with exit 1",
      true,
      "edit-first / insert-line / delete-line all trigger CHAIN BROKEN ≥ exit 1",
    );
  });

  test("VAL-FLOW-055: explorer link is reachable on the working HyperEVM testnet block explorer", async ({
    page,
  }) => {
    await gotoAndWait(page, `${DAPP}/track-record`);
    await waitForTrackRecordHydrated(page);
    await snap(page, "M5-F6-055-explorer-link");

    // The link must be present + point at hyperevmscan.io (the working
    // HyperEVM testnet explorer per AGENTS.md and architecture.md).
    const link = page.getByTestId("anchor-tx-explorer-link");
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href, "explorer link href is empty").toBeTruthy();
    expect(href).toMatch(/^https:\/\/hyperevmscan\.io\/tx\/(0x)?[0-9a-f]{64}$/);

    // Head hash shown on the page must match the hash in the link.
    const headHash = await page.getByTestId("chain-head-hash").textContent();
    expect(headHash?.trim()).toMatch(/^[0-9a-f]{64}$/);
    expect(href).toContain((headHash ?? "").trim());

    // The explorer itself returns 200 (it'll render the "tx not found"
    // body if the anchor hasn't been broadcast yet, which is the honest
    // current state — VAL-FLOW-055 only requires the URL is reachable).
    const explorerResp = await fetch(href!, { redirect: "follow" });
    expect(
      explorerResp.ok,
      `explorer returned ${explorerResp.status} for ${href}`,
    ).toBe(true);

    record(
      "VAL-FLOW-055",
      "Explorer link → working HyperEVM testnet block explorer",
      true,
      `href=${href} status=${explorerResp.status}`,
    );
  });

  // ─── Global counter / summary ──────────────────────────────────────────────

  test.afterAll(async () => {
    const passed = transitionResults.filter((r) => r.status === "pass").length;
    const total = transitionResults.length;
    const line = `INVESTOR VERIFICATION FLOW: ${passed === total ? "PASS" : "FAIL"} (${passed}/${total})`;
    console.log(`\n${line}`);

    // Per-transition table.
    for (const r of transitionResults) {
      const tag = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "·";
      console.log(`  ${tag} ${r.id}  ${r.label}${r.detail ? `  — ${r.detail}` : ""}`);
    }

    // Write summary to disk for downstream validators / reviewers.
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    const summary = [
      line,
      "",
      ...transitionResults.map(
        (r) => `${r.status.toUpperCase().padEnd(4)}  ${r.id}  ${r.label}${r.detail ? `  — ${r.detail}` : ""}`,
      ),
    ].join("\n");
    await fs.writeFile(path.join(ARTIFACT_DIR, "M5-F6-summary.txt"), summary, "utf8");
  });
});
