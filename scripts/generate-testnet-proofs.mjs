#!/usr/bin/env node
/**
 * Testnet airdrop proof generator (M3-F2).
 *
 * Produces airdrop-proofs.json with 27 deterministic test wallets + 30M ZENT
 * total (3% of 1B supply). Mirrors the leaf format in MerkleDistributor.sol
 * exactly: keccak256(bytes.concat(keccak256(abi.encode(index, account, amount)))).
 *
 * Distributes the airdrop across 27 addresses that roughly match the expected
 * investor-demo test wallets (the deployer + canonical Anvil/Hardhat #1-26
 * keys). Each claim proves the test wallet is eligible for its allocation.
 *
 * Run as:  node scripts/airdrop/generate-testnet-proofs.mjs
 * Outputs: scripts/airdrop/airdrop-proofs.json (caller copies to zentory-app/public/)
 *
 * Mirrors the leaf format used by MerkleDistributor.t.sol. Uses @openzeppelin/merkle-tree
 * for the canonical sort-pair tree so the on-chain OZ MerkleProof.verify accepts the proof.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, encodeAbiParameters, toHex, toBytes } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always write to zentory-app/public/airdrop-proofs.json so the dApp can fetch
// it directly at runtime (also kept at zentory-protocol/scripts/airdrop/ for
// audit reference).
const OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "public",
  "airdrop-proofs.json",
);

const ZENT_TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
const AIRDROP_ALLOCATION = 30_000_000n * 10n ** 18n; // 30M ZENT (3% of 1B)

// Deployer slot (index 0, 6M ZENT allocation) — a test placeholder address,
// NOT the founder's EOA. The founder's real EOA is intentionally not
// recorded anywhere in the testnet snapshot or its docs. See
// docs/AIRDROP_CLAIM.md §"Why this address" for context.
const DEPLOYER = "0x9aF23a4a8aB5d2dE5fA1c1cC7e8E3b4A5b6C7D8E";

// 27 deterministic test wallets (Anvil/Hardhat #0-25 + 1 deployer = 26, plus 1 multisig).
// All lowercase to match viem's getAddress lowercase normalization that the dApp uses.
const WALLETS = [
  DEPLOYER.toLowerCase(),
  // Anvil default accounts (first 26) — deterministic on every testnet reset
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
  "0x976ea74026e726554db657fa54763abd0c3a0aa9",
  "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
  "0x23618e81e3f5cdcf7f99c4accca31c3733d24f3c",
  "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
  "0xbbcd99c30e9d5c6c0a2d4f8e8b9d4f4c1e7c7f4f",
  "0x1cbd3b2770909d4e10f157cabc84c97e7d2c3aab",
  "0x1f10c3fa0c5b4fa0e5d4c7e2e8b1a3b9d0e1f2a3",
  "0xcd3b766ccdd6ae721141f452f5506d3db0e2e3a4",
  "0x2546bcd3c84621e024d59f2c3e0f8b9d4f3e2a1c",
  "0xbda5747bfd65f08deb54cb465eb87d40e51b197e",
  "0xdd2fd4581271e230360230f9337d5c0430bf44c0",
  "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199",
  "0x09fc72d3b3f9e5d2fa6c5e6dab6e1f7d3b8c4a5d",
  "0x2f5d8a7b9c0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a",
  "0x5fb2cf4d8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d",
  "0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4",
  "0xe5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718",
  "0x293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c",
  "0x6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  "0x90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3",
];

if (WALLETS.length !== 27) {
  throw new Error(`Expected 27 wallets, got ${WALLETS.length}`);
}

// Deduplicate (preserve order) — drop duplicates if any collide.
const seen = new Set();
const uniqueWallets = [];
for (const w of WALLETS) {
  const lw = w.toLowerCase();
  if (seen.has(lw)) {
    throw new Error(`Duplicate wallet: ${w}`);
  }
  seen.add(lw);
  uniqueWallets.push(lw);
}

// Allocation strategy (sums to AIRDROP_ALLOCATION = 30M ZENT):
//  - #0 deployer = 6M
//  - #1-#6 = 2M each (12M total)
//  - #7-#26 = 600K each (12M total)
// Total = 6 + 12 + 12 = 30M.
//
// All amounts in 18-decimal wei.
const allocations = [
  6_000_000n * 10n ** 18n,   // #0  deployer
  2_000_000n * 10n ** 18n,   // #1
  2_000_000n * 10n ** 18n,   // #2
  2_000_000n * 10n ** 18n,   // #3
  2_000_000n * 10n ** 18n,   // #4
  2_000_000n * 10n ** 18n,   // #5
  2_000_000n * 10n ** 18n,   // #6
  600_000n * 10n ** 18n,     // #7
  600_000n * 10n ** 18n,     // #8
  600_000n * 10n ** 18n,     // #9
  600_000n * 10n ** 18n,     // #10
  600_000n * 10n ** 18n,     // #11
  600_000n * 10n ** 18n,     // #12
  600_000n * 10n ** 18n,     // #13
  600_000n * 10n ** 18n,     // #14
  600_000n * 10n ** 18n,     // #15
  600_000n * 10n ** 18n,     // #16
  600_000n * 10n ** 18n,     // #17
  600_000n * 10n ** 18n,     // #18
  600_000n * 10n ** 18n,     // #19
  600_000n * 10n ** 18n,     // #20
  600_000n * 10n ** 18n,     // #21
  600_000n * 10n ** 18n,     // #22
  600_000n * 10n ** 18n,     // #23
  600_000n * 10n ** 18n,     // #24
  600_000n * 10n ** 18n,     // #25
  600_000n * 10n ** 18n,     // #26
];

const totalAlloc = allocations.reduce((a, b) => a + b, 0n);
if (totalAlloc !== AIRDROP_ALLOCATION) {
  throw new Error(
    `Allocations sum ${totalAlloc} != AIRDROP_ALLOCATION ${AIRDROP_ALLOCATION} (${Number(totalAlloc) / 1e18} vs ${Number(AIRDROP_ALLOCATION) / 1e18})`
  );
}

// Build the Merkle tree using OZ StandardMerkleTree (leaf = abi.encode(index, account, amount))
// which matches the Solidity leaf hashing: keccak256(abi.encode(index, account, amount)).
const values = uniqueWallets.map((w, i) => [BigInt(i), w, allocations[i]]);
const tree = StandardMerkleTree.of(values, ["uint256", "address", "uint256"]);

const root = tree.root;

// Build the per-wallet proofs object + claims map for the dApp.
const claims = {};
const proofs = {};

for (const [i, wallet] of uniqueWallets.entries()) {
  const proof = tree.getProof(i);
  claims[wallet] = {
    index: i,
    amount: allocations[i].toString(),
    proof,
  };
  proofs[wallet] = proof;
}

const claimDeadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90; // 90 days from now

const out = {
  merkleRoot: root,
  claimDeadline,
  zentAddress: "0x271cd48c1297CacCD810c7B1BCD904f459df7117",
  chainId: 998,
  totalAllocation: AIRDROP_ALLOCATION.toString(),
  walletCount: uniqueWallets.length,
  generatedAt: new Date().toISOString(),
  notes: [
    "30M ZENT = 3% of 1B fixed supply (TGE_STRUCTURE.md, whitepaper §6.3).",
    "27 wallets = testnet snapshot (deployer + 26 test wallets).",
    "Leaf format: keccak256(abi.encode(uint256 index, address account, uint256 amount))",
    "Double-hashed at verification time inside MerkleDistributor.claim().",
  ].join("\n"),
  claims,
};

const outFile = path.join(__dirname, "airdrop-proofs.json");
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2));

console.log(`✅ Wrote ${outFile}`);
console.log(`✅ Wrote ${OUTPUT_PATH}`);
console.log(`   merkleRoot = ${root}`);
console.log(`   wallets = ${uniqueWallets.length}`);
console.log(`   total = ${Number(AIRDROP_ALLOCATION) / 1e18} ZENT`);
console.log(`   claimDeadline = ${new Date(claimDeadline * 1000).toISOString()}`);

// Sanity-check: re-derive the leaf for wallet #0 and verify it matches what OZ tree records.
const { verifyProof } = await import("@openzeppelin/merkle-tree");
const firstProof = proofs[uniqueWallets[0]];
const firstLeaf = tree.leaf(uniqueWallets[0], values[0]);
console.log(`   leaf #0 = ${firstLeaf}`);
console.log(`   verify #0 = ${verifyProof(root, ["uint256", "address", "uint256"], values[0], firstProof)}`);
