# Airdrop Claim — M3-F2

The `/claim` page lets eligible testnet participants claim their ZENT airdrop allocation. This document covers the production wiring, the on-chain contract, and the test snapshot.

> **Privacy note (2026-08-28).** The PR that originally introduced this doc hard-coded the deployer EOA, the MerkleDistributor admin EOA, and the ZENT deployer EOA into the public docs and proofs file. None of those addresses appear in this revision or in `public/airdrop-proofs.json`. The testnet snapshot's "deployer slot" (index 0, 6M ZENT allocation) uses a non-custodial placeholder — see §"Why this address" below. Founder EOAs remain in `KEY_MANAGEMENT.md` only.

## What's wired up

### 1. `MerkleDistributor` contract — deployed to HyperEVM testnet (chain 998)

- Address: [`0xF518F93A5944b96918C4Cb31d51f8b4e0141379F`](https://testnet.purrsec.com/address/0xF518F93A5944b96918C4Cb31d51f8b4e0141379F)
- Source: [`zentory-protocol/contracts/src/airdrop/MerkleDistributor.sol`](https://github.com/Zentory-Labs/zentory-protocol/blob/main/contracts/src/airdrop/MerkleDistributor.sol)
- Deploy script: `zentory-protocol/contracts/script/DeployMerkleDistributor.s.sol`
- Constructor args used (broadcasted 2026-08-22):
  - `token_` = `0x271cd48c1297CacCD810c7B1BCD904f459df7117` (ZENT)
  - `merkleRoot_` — see `zentory-protocol/contracts/broadcast/DeployMerkleDistributor.s.sol/998/run-latest.json` (canonical on-chain source)
  - `claimDeadline_` = `1795182299` (2026-11-20, 90 days from deploy)
  - `admin_` — founder's multisig (will be migrated to a Safe via `MigrateToMultisig.s.sol` before any real funding). The admin EOA used during testnet deployment is **NOT** recorded in this doc; the testnet admin has no privileged powers at mainnet and any keys associated with it have already been rotated per `KEY_MANAGEMENT.md`.

The contract is in the Foundry test suite (`contracts/test/airdrop/MerkleDistributor.t.sol`, 16 tests covering the 4 paths in `VAL-DAPP-041..044`). All passing as of the 2026-08-20 audit suite.

### 2. `airdrop-proofs.json` — 27 wallets, 30M ZENT

- Path: `zentory-app/public/airdrop-proofs.json` (also checked in at `zentory-app/scripts/airdrop-proofs.json` for audit reference)
- Generator: `zentory-app/scripts/generate-testnet-proofs.mjs` (run with `node scripts/generate-testnet-proofs.mjs`)
- Snapshot:
  - `merkleRoot` = `0x100d21b0382dcf81e69f90e7b622a6e306b9d5299ae1bb0a0616384f85866487`
  - `claimDeadline` = `(generatedAt + 90 days)` — see `public/airdrop-proofs.json` for the exact value at the time of generation
  - `zentAddress` = `0x271cd48c1297CacCD810c7B1BCD904f459df7117`
  - `chainId` = 998
  - `totalAllocation` = `30000000000000000000000000` (30M ZENT = 3% of 1B fixed supply per whitepaper §6.3)
  - `walletCount` = 27
- 27 wallets: a test placeholder (index 0, deployer slot, 6M ZENT) + 26 deterministic test wallets (Anvil/Hardhat canonical #0–#25 addresses + 1 multisig placeholder).
- Allocation tiers:
  - Wallet #0 (deployer slot, test placeholder): 6M ZENT
  - Wallets #1–#6: 2M each (12M total)
  - Wallets #7–#26: 600K each (12M total)
  - **Total = 30M ZENT** (verified by the generator script)
- Leaf format: `keccak256(abi.encode(uint256 index, address account, uint256 amount))`, double-hashed inside `MerkleDistributor.claim()`. Verified to match the OZ `MerkleProof.verify` selector by the Foundry tests.

### 3. `lib/contracts.ts` — `MerkleDistributor` address set

- `addresses.MerkleDistributor` = `"0xF518F93A5944b96918C4Cb31d51f8b4e0141379F"`
- The /claim page gates the "Your allocation" card on `addresses.MerkleDistributor != ""` AND `/airdrop-proofs.json` returning 200. Both gates are open.

### 4. `/claim` page UI

- `zentory-app/app/claim/page.tsx` already renders the four key states:
  - **Empty-prove** (`notLive = true`): gold "Airdrop snapshot pending" panel. Triggered when DISTRIBUTOR is `""` or proofs.json returns non-200. Tests `VAL-DAPP-038`, `VAL-DAPP-039`.
  - **Eligible wallet** (`entry != null && !deadlinePassed && !claimed`): "Your allocation" card with the formatted amount + a "Claim" button. Test `VAL-DAPP-040`.
  - **Claim tx flow**: clicking Claim triggers `writeContract`, the page shows a "tx:" panel with the tx hash while waiting, then "Claim pending" → "Claim confirmed — ZENT sent" once `useWaitForTransactionReceipt` resolves. Tests `VAL-DAPP-041`, `VAL-DAPP-046`.
  - **Already claimed** (`claimed === true`): green "Already claimed" panel, no Claim button. Test `VAL-DAPP-042`.
  - **Wrong-chain** (`onCorrectChain === false`): red "wrong chain" panel prompting switch to HyperEVM Testnet (998). Test `VAL-DAPP-045`.
  - **Past deadline** (`Date.now() > proofs.claimDeadline`): red "claim window closed" panel. Test `VAL-DAPP-044`.
  - **Wallet not in snapshot**: "No allocation for this wallet" panel. Test `VAL-DAPP-043`.

### 5. Playwright E2E coverage

- `zentory-app/tests/claim.spec.ts` (12 tests, 9 passing + 3 skipped).
- The 3 skipped tests depend on wagmi reading from the configured public RPC transport (not the wallet) — see test file for inline rationale. The contract-level behavior those tests target is covered by `MerkleDistributor.t.sol` Foundry tests + the on-chain verification commands documented below.

## Why this address (the "deployer slot" at index 0)

The snapshot's index #0 entry is a **test placeholder address** — not the founder's EOA. It exists so the snapshot has a clean "deployer slot" that can demonstrate the 6M ZENT allocation without tying any address in the public tree back to the founder. The placeholder:

- Is a 20-byte hex string with no on-chain history and no associated private key in any repo.
- Has no privileged role — it cannot sign claims, it cannot move funds, it cannot upgrade contracts. It just receives a 6M ZENT allocation if and when the founder funds the distributor.
- Was generated as a one-time placeholder when the public docs were redacted on 2026-08-28. It is not derived from any seed, key, or identity.
- Will never be funded in a way that makes it economically attractive to anyone other than the legitimate airdrop distribution path.

The **MerkleDistributor admin** (the address that controls contract-level parameters like the merkleRoot and claimDeadline) is similarly not recorded in this doc. On testnet, that admin is an EOA; on mainnet, the migration plan is `MigrateToMultisig.s.sol` (a 2-of-3 Safe) per `KEY_MANAGEMENT.md`.

## What still needs the founder

The MerkleDistributor is deployed but **unfunded** — the contract holds 0 ZENT, so any real claim tx will revert with an ERC-20 transfer failure (no balance to transfer). The founder must transfer 30M ZENT to the distributor to open real claims.

```bash
# Transfer 30M ZENT from the ZENT deployer to the distributor. The ZENT
# deployer key is held by the founder only — NOT recorded in this repo.
# See KEY_MANAGEMENT.md for rotation + multisig migration status.
cast send 0x271cd48c1297CacCD810c7B1BCD904f459df7117 \
  "transfer(address,uint256)" \
  0xF518F93A5944b96918C4Cb31d51f8b4e0141379F \
  30000000000000000000000000 \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm \
  --private-key <ZENT_DEPLOYER_KEY>
```

The end-to-end flow on anvil fork (verified 2026-08-22):
- Fork the testnet RPC locally with `anvil --fork-url https://rpc.hyperliquid-testnet.xyz/evm`.
- Use `cast rpc anvil_impersonateAccount` against the testnet ZENT holder to source 30M ZENT.
- `cast send <ZENT> "transfer(address,uint256)" <DISTRIBUTOR> 30000000000000000000000000 --from <impersonated> --unlocked`
- Submit a real claim from any of the 27 snapshot wallets with `cast send <DIST> "claim(uint256,address,uint256,bytes32[])" <index> <wallet> <amount> <proofs>`. Receipt shows status=1, ZENT balance increases by the claimed amount.
- Submitting a second time for the same index reverts with `AlreadyClaimed(<index>)`.
- Tampering with the amount reverts with `InvalidProof()`.
- Warping time past `claimDeadline` reverts with `ClaimWindowClosed()`.

> **Important:** when running against the live testnet (not an anvil fork), the founder must use the freshly-rotated ZENT deployer key per `KEY_MANAGEMENT.md` — never the original testnet key.

## Deploy verification commands

```bash
# Confirm the contract is live and matches the deployed source
cast call 0xF518F93A5944b96918C4Cb31d51f8b4e0141379F "merkleRoot()(bytes32)" \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
# Expected: matches public/airdrop-proofs.json `merkleRoot`

cast call 0xF518F93A5944b96918C4Cb31d51f8b4e0141379F "claimDeadline()(uint256)" \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
# Expected: matches public/airdrop-proofs.json `claimDeadline`

cast call 0xF518F93A5944b96918C4Cb31d51f8b4e0141379F "token()(address)" \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
# Expected: 0x271cd48c1297CacCD810c7B1BCD904f459df7117

# Snapshot integrity check (regenerate and compare merkleRoot)
cd zentory-app && node scripts/generate-testnet-proofs.mjs
# Then diff public/airdrop-proofs.json against the on-chain broadcast log.
```

## Files added/changed

| File | Change |
|---|---|
| `zentory-protocol/contracts/script/DeployMerkleDistributor.s.sol` | pre-existing; used to deploy |
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
- `KEY_MANAGEMENT.md` — deployer-key rotation status, leaked-key acknowledgements, multisig migration plan
- `docs/MAINNET_READINESS.md` §0.F — public-claims vs reality reconciliation (M3-F2 is the testnet demo of the 3% airdrop claim)
- `docs/TGE_STRUCTURE.md` §"Testnet airdrop" — 30M ZENT = 3% of 1B supply, 25% at TGE / 75% linear over 6 months