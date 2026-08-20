import { defineChain, parseAbi } from "viem";

// Deployed contract addresses on HyperEVM testnet (chain 998).
// Canonical source of truth: zentory-protocol/DEPLOYMENTS.md and the Foundry
// broadcast logs under zentory-protocol/contracts/broadcast/*/998/run-latest.json.
//
// HyperCoreAdapter + StrategyExecutor were re-deployed in Phase 5 (2026-04-27)
// to apply hardening fixes from docs/reports/pentest-2026-04-26.md. Older
// addresses from ResumeDeployment.s.sol are deprecated.
export const addresses = {
  // Core
  ZENT: "0x271cd48c1297CacCD810c7B1BCD904f459df7117",
  Vesting: "0xf7c45f45768d790F388215A44d6E01f6f2568774",

  // Vaults
  zETH: "0xbe8a9d22560A1b126554b70Aaca2D763B2E70C4e",
  zBTC: "0x93669daC07321FF397cf5734Ae8364EA24addF45",
  zXRP: "0x8B15204D88a9Bb155bE6798522983A3B5F7d7cB0",
  zSOL: "0xb62BA9d0a14aC9f9601891179B3Da52bE71Ce052",

  // Mock assets (testnet only — replace with real tokens on mainnet)
  WETH: "0x80F727AF3f7932718fEb25FC28818Ad103040BD2",
  WBTC: "0x08890A5B7D6D157Da65C04C19150fF7d124eaE40",
  WXRP: "0xe1Fe75622Bd5D962c72c1D0A621e5fa6656a4371",
  WSOL: "0x2b9d5bBD8C5FEfc71E985d993C13db2770469972",

  // Staking & Fees
  // ZENTStaking REDEPLOYED 2026-06-04 (prior 0x4E2e7Fd3 reverted getProviderStake
  // for unstaked providers, bricking EpochScoring.settleEpoch — see Research Network note).
  ZENTStaking: "0x93A14D1c60e054038980965CF3CAa50CEB848de9",
  ModelBonding: "0x15f6c4bf4000747E0fDd85B33998A36F5BdF5007",
  FeeDistributor: {
    zETH: "0x8Fb48F84AA69E89e0360e6d2D26C447AA57DcF73",
    zBTC: "0x403e8C79653B1cb7a5c0EaA313Ec0C7d0cAc7e2c",
    zXRP: "0xC69f8a8014b4d17ee2E7457109fF1DB33C0c7d7F",
    zSOL: "0xE990BFBc5c1e5779Cb54cB95150eDbBB2C2800d0",
  },

  // Governance
  Timelock: "0x1504cA3C050C88CcCa67696d642F634fc381fD03",
  Zentroller: "0x24f9401284CE16CFe61e40C1F9e3fb37d15B878E",
  ZentGovernor: "0x21ba1F7C028B1ADc78e75Ac187B08b1BDd567118",

  // Strategy execution (Phase 5 hardened — see top-of-file note)
  HyperCoreAdapter: "0xdad9175f6d2Da1709bA3F73711E69022538d21a7",
  StrategyExecutor: "0xaCD862eF134D772b0CA53a97f53CCDd00aBC05CF",

  // ─── Research Network — REDEPLOYED 2026-06-04 via RedeploySignalStack.s.sol ──────
  // Fresh SignalRegistry + EpochScoring (and a fresh ZENTStaking, below) from current
  // protocol main. Fixes the epoch off-by-one (registry now inits currentEpochId=1,
  // aligned with EpochScoring) AND the stale-staking blocker: the prior ZENTStaking
  // (0x4E2e7Fd3, 2026-04-27) had getProviderStake REVERTING for unstaked providers,
  // so settleEpoch bricked on the first non-empty epoch. New staking returns 0. All
  // roles re-wired (EpochScoring holds SCORING_ORACLE on the registry + GOVERNOR_ROLE
  // on the staking; BTC feed re-registered). Supersedes the 2026-06-01 set
  // (0x9685/0x31b7) and the 2026-05-27 set (0xFA50/0x78d38).
  // Verified on-chain: registry.currentEpochId() == scoring.currentEpochId() == 1.
  SignalRegistry:    "0xA71cfdA74fc0BB7bE3f95aB806197286549e82e7",
  EpochScoring:      "0x659569A6f195698745779E59fef88e3B5Fe0484A",
  SubscriptionVault: "0xb053b9a1A82D57B2BEa7cC4a472924Fb6926933E",

  // Airdrop claim (M9). Empty until DeployMerkleDistributor.s.sol runs; the /claim
  // page treats "" as "airdrop not yet live". Set to the deployed address + publish
  // public/airdrop-proofs.json (from scripts/airdrop/snapshot.ts) to open claims.
  MerkleDistributor: "",

  // ─── Shadow stack — SpotVault research vault (TESTNET ONLY, deployed 2026-06-02) ──
  // Oracle-valued ERC-4626 vault that rebalances BTC long ⇄ flat on signed signals.
  // Self-contained testnet swap venue (no real Hyperliquid spot integration) so the
  // deposit → rebalance → NAV → redeem loop runs end-to-end. NONE of these ship to
  // mainnet. Recorded here for tooling/scripts; a dedicated dApp vault page that reads
  // the oracle-valued NAV is a follow-on (the existing /vaults pages drive BaseVaults).
  SpotVault:         "0x504E998B32D165cfd6470a8a0000235550C33cBc",
  ShadowSpotAdapter: "0x385Ba1f9A9d74A28974C8F6c03762D03B0e4a00c",
  ShadowPriceOracle: "0x46a7c01424229CB5B2C9FF069e6b0eab07490Fd4",
  ShadowUSDC:        "0x2DF6A937da1430B4B593fE3EB2C9AB986cC3AF9e",
} as const;

// ─── Demo signal providers (TESTNET ONLY) ───────────────────────────────────
// Clearly-labeled demo accounts seeded by zentory-engine/demo_seed_signals.py to
// demonstrate the Signal Arena's scoring/leaderboard mechanics while real external
// quants are recruited. Keyed by lowercase address. The UI shows a "Demo" badge so
// these are never mistaken for real contributor performance. Addresses are
// deterministic (derived from the public seed "zentory-testnet-demo-v1").
export const DEMO_PROVIDERS: Record<string, string> = {
  "0xc34a3d1d32e88079a66595a681cee1ed8fd98edc": "TrendFollower",
  "0x331af524893044c39417870b429f6d0afa464b0d": "MeanReverter",
  "0xd3255b14c9f26648723e75ed2bf1448ffa6b01b9": "MomentumQuant",
};

export function demoProviderLabel(address: string | undefined | null): string | null {
  if (!address) return null;
  return DEMO_PROVIDERS[address.toLowerCase()] ?? null;
}

// ─── ABIs ───────────────────────────────────────────────────────────────────

// All ABIs below are pre-parsed via viem's `parseAbi` so they're directly
// usable by wagmi's useReadContract / useWriteContract without each consumer
// having to parse them locally. Passing a raw human-readable string array
// causes wagmi to throw "Cannot use 'in' operator to search for 'name'" or
// silently return undefined.

export const ZENT_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
]);

export const VAULT_ABI = parseAbi([
  // ERC-20 share-token methods (vault shares are ERC-20-compatible)
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
  // ERC-4626
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function previewRedeem(uint256) view returns (uint256)",
  "function deposit(uint256,address) returns (uint256)",
  "function mint(uint256,address) returns (uint256)",
  "function withdraw(uint256,address,address) returns (uint256)",
  "function redeem(uint256,address,address) returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function maxMint(address) view returns (uint256)",
  // Zentory extensions
  "function highWaterMark() view returns (uint256)",
  "function getNavPerShare() view returns (uint256)",
  "function currentDirection() view returns (int8)",
  "function currentPositionSize() view returns (uint256)",
  "function performanceFeeAccrued() view returns (uint256)",
  "function performanceFee() view returns (uint256)",
  "function isCircuitBreakerActive() view returns (bool)",
  "function hasRole(bytes32,address) view returns (bool)",
  // Events
  "event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
]);

// SpotVault (shadow research vault) — oracle-valued ERC-4626 that holds the
// underlying (LONG) or cash (FLAT) and rebalances on signed signals. Shares use
// a decimals offset (asset decimals + 6), so always read decimals() rather than
// assuming. NAV is valued via the price oracle, so deposits/redeems revert if the
// feed is stale.
export const SPOT_VAULT_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function asset() view returns (address)",
  "function cashAsset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function previewRedeem(uint256) view returns (uint256)",
  "function deposit(uint256,address) returns (uint256)",
  "function redeem(uint256,address,address) returns (uint256)",
  "function getNavPerShare() view returns (uint256)",
  "function grossValue() view returns (uint256)",
  "function highWaterMark() view returns (uint256)",
  "function performanceFee() view returns (uint256)",
  "function targetWeightBps() view returns (uint16)",
  "function rebalanceThresholdBps() view returns (uint16)",
  "function maxSlippageBps() view returns (uint16)",
  "function maxOracleStaleness() view returns (uint256)",
  "function isCircuitBreakerActive() view returns (bool)",
]);

// Chainlink-compatible price feed (ShadowPriceOracle on testnet). Reading
// latestRoundData returns [roundId, answer, startedAt, updatedAt, answeredInRound].
export const PRICE_ORACLE_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
]);

export const STAKING_ABI = parseAbi([
  "function stake(uint256,uint64) returns (uint64)",
  "function increaseAmount(uint256)",
  "function extendLock(uint64) returns (uint64)",
  "function withdraw()",
  "function veBalance(address) view returns (uint256)",
  "function hasAccess(address) view returns (bool)",
  "function stakedBalance(address) view returns (uint256)",
  "function lockEndOf(address) view returns (uint64)",
  "function totalStaked() view returns (uint256)",
  "function minStake() view returns (uint256)",
  "event Staked(address indexed user, uint256 amount, uint64 lockEnd)",
  "event Withdrawn(address indexed user, uint256 amount)",
]);

export const GOVERNOR_ABI = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function quorum(uint256) view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function votingDelay() view returns (uint256)",
  "function votingPeriod() view returns (uint256)",
  "function propose(address[],uint256[],bytes[],string) returns (uint256)",
  "function castVote(uint256,uint8) returns (uint256)",
  "function castVoteWithReason(uint256,uint8,string) returns (uint256)",
  "function state(uint256) view returns (uint8)",
  "function proposalDeadline(uint256) view returns (uint256)",
  "function proposalSnapshot(uint256) view returns (uint256)",
]);

export const EXECUTOR_ABI = parseAbi([
  "function paused() view returns (bool)",
  "function maxPositionSize(address) view returns (uint256)",
  "function maxLeverageBPS(address) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function recordTradeManual(address,bool,uint64,uint64)",
  "function setPaused(bool)",
  "function setMaxPositionSize(address,uint256)",
  "function setMaxLeverageBPS(address,uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function KEEPER_ROLE() view returns (bytes32)",
  "function GOVERNOR_ROLE() view returns (bytes32)",
  "function GUARDIAN_ROLE() view returns (bytes32)",
  "event ManualTradeRecorded(address indexed vault, bool indexed isBuy, uint64 size, uint64 price, address indexed keeper)",
  "event PausedSet(bool paused)",
]);

export const HYPERCORE_ADAPTER_ABI = parseAbi([
  "function sendLimitOrder(uint8,bool,uint64,uint64,bool,uint8,uint128)",
  "function vaultRegistry(address) view returns (uint8)",
  "function lastTradePrice(uint8) view returns (uint256)",
]);

// ─── Signal Network ABIs ──────────────────────────────────────────────────────
// NOTE: these two ABIs use complex tuple types that viem's parseAbi doesn't
// fully support (named fields inside `tuple(...)[]` arrays). Kept as raw
// human-readable strings; consumers must call parseAbi locally if needed.

export const SIGNAL_REGISTRY_ABI = ([
  // Core submit
  "function submitSignal(address provider, uint8 assetClass, bytes32 assetId, int256 direction, uint256 confidence, uint256 expiresAt, bytes calldata signature) returns (bytes32 signalId)",
  "function submitSignalBatch(tuple(bytes32 signalId, address provider, uint8 assetClass, bytes32 assetId, int256 direction, uint256 confidence, uint256 submittedAt, uint256 expiresAt, bytes signature, uint8 status)[] calldata batch) returns (bytes32[] ids)",
  // Views
  "function getSignal(bytes32 signalId) view returns (tuple(bytes32 signalId, address provider, uint8 assetClass, bytes32 assetId, int256 direction, uint256 confidence, uint256 submittedAt, uint256 expiresAt, bytes signature, uint8 status))",
  "function getSignalCount() view returns (uint256)",
  "function signalIds(uint256) view returns (bytes32)",
  "function providerNonce(address) view returns (uint256)",
  "function signalExists(bytes32) view returns (bool)",
  "function currentEpochId() view returns (uint256)",
  "function epochDuration() view returns (uint256)",
  "function stakingContract() view returns (address)",
  // Scoring
  "function resolveSignals(bytes32[] calldata signalIds, uint256[] calldata accuraciesBps)",
  // Access
  "function hasAccess(address subscriber, uint8 assetClass) view returns (bool)",
  // EIP-712
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  // Events
  "event SignalSubmitted(bytes32 indexed signalId, address indexed provider, uint8 assetClass, bytes32 assetId, int256 direction, uint256 confidence, uint256 expiresAt)",
  "event SignalScored(bytes32 indexed signalId, address indexed provider, uint256 accuracyBps, int256 payout)",
] as const);

export const EPOCH_SCORING_ABI = parseAbi([
  "function checkUpkeep(bytes calldata) view returns (bool upkeepNeeded, bytes memory performData)",
  "function performUpkeep(bytes calldata performData)",
  "function settleEpoch()",
  "function setAccuracy(bytes32 signalId, uint256 accuracyBps)",
  "function setAccuracyBatch(bytes32[] calldata signalIds, uint256[] calldata accuraciesBps)",
  "function applyPayout(bytes32 signalId) returns (int256 payout)",
  "function currentEpochId() view returns (uint256)",
  "function lastEpochStart() view returns (uint256)",
  "function epochDuration() view returns (uint256)",
  "function priceFeeds(bytes32) view returns (address)",
  "function setPriceFeed(bytes32 assetId, address feed)",
  "function accuracyCache(bytes32) view returns (uint256)",
  "function epochStates(uint256) view returns (uint256 totalSignals, uint256 settledSignals, bool settled)",
  "function getPrice(bytes32 assetId) view returns (int256 price, uint8 decimals)",
  "event EpochStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime)",
  "event EpochSettled(uint256 indexed epochId, uint256 totalSignals, uint256 settledSignals)",
  "event PayoutApplied(bytes32 indexed signalId, address indexed provider, int256 payout)",
  "event KeeperCallExecuted(uint256 upkeepId, bytes performData)",
]);

export const SUBSCRIPTION_VAULT_ABI = parseAbi([
  // Subscribe
  "function subscribe(uint256 tierId, uint32 months) returns (uint256 tokenId)",
  "function renewSubscription(uint256 tokenId, uint32 months) returns (uint32 newExpiration)",
  "function cancelSubscription(uint256 tokenId) returns (uint256 refundZENT)",
  // Access check
  "function hasAccess(address subscriber, uint8 assetClass) view returns (bool hasAccess)",
  "function getActiveSubscriptions(address subscriber) view returns (uint256[] tokenIds)",
  // Views
  "function subscriptionInfo(uint256) view returns (address subscriber, bytes assetClass, uint32 duration, uint32 expiration, uint96 pricePaid)",
  "function tiers(uint256) view returns (uint256 monthlyPriceZENT, bytes assetClassBitmap, uint32 minDuration)",
  "function nextTokenId() view returns (uint256)",
  "function subscriberTokens(address) view returns (uint256[])",
  "function zentToken() view returns (address)",
  "function treasury() view returns (address)",
  // ERC-721 stubs
  "function name() pure returns (string)",
  "function symbol() pure returns (string)",
  "function tokenURI(uint256) pure returns (string)",
  // Events
  "event Subscribed(address indexed subscriber, uint256 indexed tokenId, uint256 tierId, uint32 duration, uint256 zentPaid)",
  "event RenewalPaid(uint256 indexed tokenId, uint256 zentPaid, uint32 newExpiration)",
  "event Cancelled(uint256 indexed tokenId, uint256 refundZENT, uint32 refundSeconds)",
]);

// ─── Subscription Tiers ───────────────────────────────────────────────────────

export const SUBSCRIPTION_TIERS = [
  {
    id: 0,
    name: "BASIC",
    monthlyPriceZENT: 100,
    assetClasses: ["CRYPTO_SPOT", "CRYPTO_PERP"],
    description: "Access quant research for Bitcoin, Ethereum, and major altcoins.",
  },
  {
    id: 1,
    name: "PRO",
    monthlyPriceZENT: 500,
    assetClasses: ["CRYPTO_SPOT", "CRYPTO_PERP", "EQUITY"],
    description: "Crypto + equity research including AAPL, TSLA, NVDA, and S&P 500.",
    popular: true,
  },
  {
    id: 2,
    name: "ELITE",
    monthlyPriceZENT: 2000,
    assetClasses: ["CRYPTO_SPOT", "CRYPTO_PERP", "EQUITY", "FOREX", "COMMODITY"],
    description: "Full multi-asset access: crypto, equities, forex, and commodities.",
  },
] as const;

// ─── Chain config ────────────────────────────────────────────────────────────

// Single source of truth for the public HyperEVM testnet RPC fallback.
// Env vars (NEXT_PUBLIC_HYPEREVM_RPC, HYPEREVM_RPC_URL, RPC_FALLBACK_URLS) still
// override at every call site — this is only the LAST-RESORT default when nothing
// else is configured. Imported wherever a hardcoded "https://rpc.hyperliquid-testnet.xyz/evm"
// would otherwise live (wagmi transport, /api/rpc upstream list, /api/research/execute,
// Research-execute keeper, etc.) so we don't end up with N copies that drift.
export const HYPEREVM_TESTNET_FALLBACK_RPC = "https://rpc.hyperliquid-testnet.xyz/evm";

export const HYPEREVM_TESTNET = defineChain({
  id: 998,
  name: "Hyperliquid Testnet",
  nativeCurrency: { name: "Hyperliquid", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: [HYPEREVM_TESTNET_FALLBACK_RPC] },
    public: { http: [HYPEREVM_TESTNET_FALLBACK_RPC] },
  },
  blockExplorers: {
    default: {
      name: "Hyperliquid Explorer",
      url: "https://app.hyperliquid-testnet.xyz/explorer",
      apiUrl: "https://app.hyperliquid-testnet.xyz/explorer",
    },
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const vaultMeta: Record<string, { name: string; symbol: string; color: string; asset: string }> = {
  [addresses.zETH]: { name: "zETH Vault", symbol: "zETH", color: "#627EEA", asset: "ETH" },
  [addresses.zBTC]: { name: "zBTC Vault", symbol: "zBTC", color: "#F7931A", asset: "BTC" },
  [addresses.zXRP]: { name: "zXRP Vault", symbol: "zXRP", color: "#23292F", asset: "XRP" },
  [addresses.zSOL]: { name: "zSOL Vault", symbol: "zSOL", color: "#9945FF", asset: "SOL" },
};

// Alias for backward compatibility
export const strategyExecutorABI = EXECUTOR_ABI;
