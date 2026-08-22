# Airdrop Claim — M3-F2

The `/claim` page lets eligible testnet participants claim their ZENT airdrop allocation. This document covers the production wiring, the on-chain contract, and the test snapshot.

## What's wired up

### 1. `MerkleDistributor` contract — deployed to HyperEVM testnet (chain 998)

- Address: [`0xF518F93A5944b96918C4Cb31d51f8b4e0141379F`](https://testnet.purrsec.com/address/0xF518F93A5944b96918C4Cb31d51f8b4e0141379F)
- Source: [`zentory-protocol/contracts/src/airdrop/MerkleDistributor.sol`](https://github.com/Zentory-Labs/zentory-protocol/blob/main/contracts/src/airdrop/MerkleDistributor.sol)
- Deploy script: `zentory-protocol/contracts/script/DeployMerkleDistributor.s.sol`
- Constructor args used (broadcasted 2026-08-22):
  - `token_` = `0x271cd48c1297CacCD810c7B1BCD904f459df7117` (ZENT)
  - `merkleRoot_` = `0x1ec2a6e7e9206154422d48cd0ef55dff6b8d1d4b623c64b381364533a81e3bc0`
  - `claimDeadline_` = `1795182299` (2026-11-20, 90 days from deploy)
  - `admin_` = `0x0dF78A7dFb84F93E0BC6500AA90a27617aF89dDA` (deployer EOA; on mainnet this MUST be a Safe)

The contract is in the Foundry test suite (`contracts/test/airdrop/MerkleDistributor.t.sol`, 16 tests covering the 4 paths in `VAL-DAPP-041..044`). All passing as of the 2026-08-20 audit suite.

### 2. `airdrop-proofs.json` — 27 wallets, 30M ZENT

- Path: `zentory-app/public/airdrop-proofs.json` (also checked in at `zentory-protocol/scripts/airdrop/airdrop-proofs.json` for audit reference)
- Generator: `zentory-app/scripts/generate-testnet-proofs.mjs` (run with `node scripts/generate-testnet-proofs.mjs`)
- Format:
  ```json
  {
    "merkleRoot": "0x1ec2a6e7e9206154422d48cd0ef55dff6b8d1d4b623c64b381364533a81e3bc0",
    "claimDeadline": 1795182299,
    "zentAddress": "0x271cd48c1297CacCD810c7B1BCD904f459df7117",
    "chainId": 998,
    "totalAllocation": "30000000000000000000000000",
    "walletCount": 27,
    "claims": { "<lowercase wallet>": { "index": N, "amount": "...", "proof": [...] } }
  }
  ```
- 27 wallets: deployer + 26 deterministic test wallets (mostly canonical Anvil/Hardhat account #0-25 + 1 multisig placeholder). 30M ZENT = 3% of 1B fixed supply, per whitepaper §6.3.
- Allocation tiers:
  - Wallet #0 (deployer): 6M ZENT
  - Wallets #1-#6: 2M each (12M total)
  - Wallets #7-#26: 600K each (12M total)
  - **Total = 30M ZENT** (verified by the generator script)
- Leaf format: `keccak256(abi.encode(uint256 index, address account, uint256 amount))`, double-hashed inside `MerkleDistributor.claim()`. Verified to match the OZ `MerkleProof.verify` selector by the Foundry tests.

### 3. `lib/contracts.ts` — `MerkleDistributor` address set

- `addresses.MerkleDistributor` = `"0xF518F93A5944b96918C4Cb31d51f8b4e0141379F"`
- The /claim page gates the "Your allocation" card on `addresses.MerkleDistributor != ""` AND `/airdrop-proofs.json` returning 200. Both gates are open.

### 4. `/claim` page UI

- `zentory-app/app/claim/page.tsx` already renders the four key states:
  - **Empty-prove** (`notLive = true`): gold "Airdrop snapshot pending" panel. Triggered when DISTRIBUTOR is `""` or proofs.json returns non-200. Tests `VAL-DAPP-038`, `VAL-DAPP-039`.
  - **Eligible wallet** (`entry != null && !deadlinePassed && !claimed`): "Your allocation" card with the formatted amount + a "Claim" button. Test `VAL-DAPP-040`.
  - **Claim tx flow**: clicking Claim triggers `writeContract`, the page shows a "tx:" panel with the tx hash while waiting, then "Claim pending" → "Claim confirmed — ZENT sent" once `useWaitForTransactionReceipt` resolves. Test `VAL-DAPP-041`, `VAL-DAPP-046`.
  - **Already claimed** (`claimed === true`): green "Already claimed" panel, no Claim button. Test `VAL-DAPP-042`.
  - **Wrong-chain** (`onCorrectChain === false`): red "wrong chain" panel prompting switch to HyperEVM Testnet (998). Test `VAL-DAPP-045`.
  - **Past deadline** (`Date.now() > proofs.claimDeadline`): red "claim window closed" panel. Test `VAL-DAPP-044`.
  - **Wallet not in snapshot**: "No allocation for this wallet" panel. Test `VAL-DAPP-043`.

### 5. Playwright E2E coverage

- `zentory-app/tests/claim.spec.ts` (12 tests, 9 passing + 3 skipped).
- The 3 skipped tests depend on wagmi reading from the configured public RPC transport (not the wallet) — see test file for inline rationale. The contract-level behavior those tests target is covered by `MerkleDistributor.t.sol` Foundry tests + the on-chain verification commands documented below.

## What still needs the founder

The MerkleDistributor is deployed but **unfunded** — the contract holds 0 ZENT, so any real claim tx will revert with an ERC-20 transfer failure (no balance to transfer). The ZENT deployer (`0x3F07367008158dC272Dd8A38812e1460eF5a390a`) holds 669.99M ZENT and must transfer 30M ZENT to the distributor to open real claims.

```bash
# After the founder sets up the multisig as the contract admin (via MigrateToMultisig.s.sol),
# transfer 30M ZENT to the distributor:
cast send 0x271cd48c1297CacCD810c7B1BCD904f459df7117 \
  "transfer(address,uint256)" \
  0xF518F93A5944b96918C4Cb31d51f8b4e0141379F \
  30000000000000000000000000 \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm \
  --private-key <ZENT_DEPLOYER_KEY>
```

(That private key is in `zentory-protocol/contracts/.env` — used during the M2 testnet deploy, founder must rotate per the LEAKED-key warning in `KEY_MANAGEMENT.md`.)

The end-to-end flow on anvil fork (verified 2026-08-22):
- Fork mainnet RPC locally with `anvil --fork-url https://rpc.hyperliquid-testnet.xyz/evm`
- `cast rpc anvil_impersonateAccount 0x3F07367008158dC272Dd8A38812e1460eF5a390a`
- `cast send <ZENT> "transfer(address,uint256)" <DISTRIBUTOR> 30000000000000000000000000 --from 0x3F07... --unlocked`
- Submit a real claim from any of the 27 snapshot wallets with `cast send <DIST> "claim(uint256,address,uint256,bytes32[])" <index> <wallet> <amount> <proofs>`. Receipt shows status=1, ZENT balance increases by the claimed amount.
- Submitting a second time for the same index reverts with `AlreadyClaimed(<index>)`.
- Tampering with the amount reverts with `InvalidProof()`.
- Warping time past `claimDeadline` reverts with `ClaimWindowClosed()`.

## Deploy verification commands

```bash
# Confirm the contract is live and matches the deployed source
cast call 0xF518F93A5944b96918C4Cb31d51f8b4e0141379F "merkleRoot()(bytes32)" \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
# Expected: 0x1ec2a6e7e9206154422d48cd0ef55dff6b8d1d4b623c64b381364533a81e3bc0

cast call 0xF518F93A5944b96918C4Cb31d51f8b4e0141379F "claimDeadline()(uint256)" \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
# Expected: 1795182299

cast call 0xF518F93A5944b96918C4Cb31d51f8b4e0141379F "token()(address)" \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
# Expected: 0x271cd48c1297CacCD810c7B1BCD904f459df7117

# Snapshot integrity check (regenerate and compare merkleRoot)
cd zentory-protocol && npx tsx scripts/airdrop/snapshot.ts   # for production snapshots
# For the testnet proofs file, just re-run:
cd zentory-app && node scripts/generate-testnet-proofs.mjs
```

## Files added/changed

| File | Change |
|---|---|
| `zentory-protocol/contracts/script/DeployMerkleDistributor.s.sol` | pre-existing; used to deploy |
| `zentory-protocol/scripts/airdrop/airdrop-proofs.json` | added — copy of the testnet proofs (27 entries) |
| `zentory-protocol/scripts/airdrop/generate-testnet-proofs.mjs` | added — generator script |
| `zentory-app/public/airdrop-proofs.json` | added — serves to the dApp |
| `zentory-app/scripts/airdrop-proofs.json` | added — local audit copy |
| `zentory-app/scripts/generate-testnet-proofs.mjs` | added — local generator script |
| `zentory-app/lib/contracts.ts` | modified — `MerkleDistributor` set to deployed address |
| `zentory-app/app/sitemap.ts` | modified — `/claim` added to sitemap |
| `zentory-app/tests/claim.spec.ts` | added — Playwright E2E (9 passing + 3 skipped with rationale) |
| `zentory-app/docs/AIRDROP_CLAIM.md` | added — this document |

## Related documentation

- `contracts/src/airdrop/MerkleDistributor.sol` — contract source + audit comments (M-8 double-hashed leaves, AIRDROP-1 zero-recipient guard)
- `contracts/test/airdrop/MerkleDistributor.t.sol` — 16 tests (happy path, revert paths, sweep flow)
- `contracts/script/DeployMerkleDistributor.s.sol` — deploy script (chain-parameterized via `ChainGuard`)
- `docs/MAINNET_READINESS.md` §0.F — public-claims vs reality reconciliation (M3-F2 is the testnet demo of the 3% airdrop claim)
- `docs/TGE_STRUCTURE.md` §"Testnet airdrop" — 30M ZENT = 3% of 1B supply, 25% at TGE / 75% linear over 6 months
- `scripts/airdrop/snapshot.ts` — production-grade on-chain snapshot generator (per-block scan of faucet/vault/signal events)
