import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { strategyExecutorABI, HYPEREVM_TESTNET } from "@/lib/contracts";
import { addresses } from "@/lib/contracts";
import { geoBlockCheck } from "@/lib/geo-blocking";

const RPC_URL = process.env.NEXT_PUBLIC_HYPEREVM_RPC ?? "https://rpc.hyperliquid-testnet.xyz/evm";
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY ?? "";
const API_KEY = process.env.KEEPER_API_KEY ?? "";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const _rate = new Map<string, { windowStart: number; count: number }>();
const EXECUTOR_ABI = parseAbi(strategyExecutorABI as any);

/** Convert an error to a plain JSON-safe object. */
function errorToDetail(e: unknown) {
  const any = e as any;
  return {
    name: any?.name,
    message: any?.message,
    shortMessage: any?.shortMessage ?? any?.cause?.shortMessage,
    details: any?.details,
    cause: any?.cause?.message,
    metaMessages: any?.metaMessages,
  };
}

/** JSON-safe converter: BigInt → string, arrays/objects recursively. */
function toSafeJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toSafeJson);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toSafeJson(v);
    }
    return out;
  }
  return value;
}

/** Wrap a NextResponse.json call so BigInt values never cause serialization failures. */
function safeJson<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(toSafeJson(data) as T, init);
}

function checkAuth(req: NextRequest): NextResponse | null {
  // If API key isn't configured, leave endpoint open in dev (but still require keeper key).
  if (!API_KEY) return null;
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== API_KEY) {
    return safeJson({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function checkRateLimit(req: NextRequest): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  const now = Date.now();
  const entry = _rate.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    _rate.set(ip, { windowStart: now, count: 1 });
    return null;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return safeJson(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "retry-after": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) } }
    );
  }
  return null;
}

function normalizePrivateKey(pk: string): `0x${string}` | null {
  const trimmed = pk.trim();
  if (!trimmed) return null;
  const with0x = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  // 32 bytes hex => 66 chars with 0x
  if (!/^0x[0-9a-fA-F]{64}$/.test(with0x)) return null;
  return with0x as `0x${string}`;
}

// Asset symbol → vault address (HyperEVM testnet)
const VAULT_MAP: Record<string, string> = {
  BTC: addresses.zBTC,
  ETH: addresses.zETH,
  XRP: addresses.zXRP,
  SOL: addresses.zSOL,
};

export async function POST(req: NextRequest) {
  try {
    const auth = checkAuth(req);
    if (auth) return auth;
    const limited = checkRateLimit(req);
    if (limited) return limited;

    const block = geoBlockCheck(req);
    if (block) return block;
    if (limited) return limited;

    const body = await req.json();
    const { researchId, asset, direction, size, price } = body as {
      researchId: string;
      asset: string;
      direction: string;
      size: number;
      price: number;
    };

    if (!researchId || !asset || !direction || typeof size !== "number" || typeof price !== "number") {
      return safeJson({ error: "Invalid payload" }, { status: 400 });
    }

    // Gate: keeper private key must be configured server-side
    if (!KEEPER_PRIVATE_KEY) {
      console.error("[research/execute] KEEPER_PRIVATE_KEY not configured");
      return safeJson({ error: "Keeper private key not configured" }, { status: 500 });
    }

    const keeperPk = normalizePrivateKey(KEEPER_PRIVATE_KEY);
    if (!keeperPk) {
      console.error("[research/execute] Invalid KEEPER_PRIVATE_KEY format");
      return safeJson(
        { error: "Invalid KEEPER_PRIVATE_KEY format (expected 32-byte hex, with or without 0x prefix)" },
        { status: 500 }
      );
    }

    // Resolve asset symbol → vault address
    const vaultAddress = VAULT_MAP[asset.toUpperCase()] ?? asset;
    const isBuy = direction === "LONG";

    const account = privateKeyToAccount(keeperPk);
    const publicClient = createPublicClient({ transport: http(RPC_URL), chain: HYPEREVM_TESTNET });
    const walletClient = createWalletClient({ account, transport: http(RPC_URL), chain: HYPEREVM_TESTNET });

    // Preflight: check keeper permissions + balance for gas
    try {
      // Ensure executor is deployed on the RPC chain
      const chainId = await publicClient.getChainId();
      const bytecode = await publicClient.getBytecode({ address: addresses.StrategyExecutor });
      if (!bytecode || bytecode === "0x") {
        return safeJson(
          {
            error: "StrategyExecutor not deployed on configured RPC",
            keeper: account.address,
            executor: addresses.StrategyExecutor,
            rpc: RPC_URL,
            chainId,
            expectedChainId: HYPEREVM_TESTNET.id,
          },
          { status: 500 }
        );
      }

      const keeperRole = await publicClient.readContract({
        address: addresses.StrategyExecutor,
        abi: EXECUTOR_ABI,
        functionName: "KEEPER_ROLE",
      } as any);

      const hasKeeperRole = await publicClient.readContract({
        address: addresses.StrategyExecutor,
        abi: EXECUTOR_ABI,
        functionName: "hasRole",
        args: [keeperRole, account.address],
      } as any);

      if (!hasKeeperRole) {
        return safeJson(
          { error: "Keeper wallet is not authorized (missing KEEPER_ROLE)", keeper: account.address },
          { status: 403 }
        );
      }

      const balance = await publicClient.getBalance({ address: account.address });
      if (balance === 0n) {
        return safeJson(
          { error: "Keeper wallet has no balance for gas", keeper: account.address },
          { status: 402 }
        );
      }
    } catch (e) {
      console.error("[research/execute] preflight failed", e);
      const detail =
        (e as any)?.shortMessage ??
        (e as any)?.cause?.shortMessage ??
        (e as any)?.message ??
        "Unknown error";
      return safeJson(
        {
          error: "Preflight check failed",
          detail,
          keeper: account.address,
          executor: addresses.StrategyExecutor,
          rpc: RPC_URL,
        },
        { status: 502 }
      );
    }

    let hash: `0x${string}`;
    try {
      hash = await walletClient.writeContract({
        address: addresses.StrategyExecutor,
        abi: EXECUTOR_ABI,
        functionName: "recordTradeManual",
        args: [vaultAddress as `0x${string}`, isBuy, BigInt(size), BigInt(Math.round(price * 1_000_000))],
      });
    } catch (e) {
      console.error("[research/execute] writeContract failed", e);
      const detail =
        (e as any)?.shortMessage ??
        (e as any)?.cause?.shortMessage ??
        (e as any)?.message ??
        "Unknown error";
      return safeJson(
        {
          error: "On-chain execution failed",
          detail,
          keeper: account.address,
          executor: addresses.StrategyExecutor,
          vault: vaultAddress,
          rpc: RPC_URL,
        },
        { status: 502 }
      );
    }

    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      console.error("[research/execute] waitForTransactionReceipt failed", e);
      return safeJson({ error: "Transaction not confirmed" }, { status: 502 });
    }

    let supabase;
    try {
      supabase = await createClient();
    } catch {
      return safeJson({ error: "Supabase not configured" }, { status: 503 });
    }

    const warnings: Record<string, unknown> = {};

    try {
      const { error: updateErr } = await supabase
        .from("signals")
        .update({
          status: "executed",
          tx_hash: hash,
          executed_by: account.address,
          executor_address: addresses.StrategyExecutor,
        })
        .eq("id", researchId);
      if (updateErr) warnings.signals_update = { message: updateErr.message, code: (updateErr as any).code };
    } catch (e) {
      warnings.signals_update = errorToDetail(e);
    }

    try {
      const { error: insertErr } = await supabase.from("keeper_audit").insert({
        signal_id: researchId,
        tx_hash: hash,
        gas_used: Number(receipt.gasUsed),
        executor_address: addresses.StrategyExecutor,
        block_number: Number(receipt.blockNumber),
      });
      if (insertErr) warnings.keeper_audit_insert = { message: insertErr.message, code: (insertErr as any).code };
    } catch (e) {
      warnings.keeper_audit_insert = errorToDetail(e);
    }

    return safeJson({
      success: true,
      txHash: hash,
      blockNumber: receipt.blockNumber,
      ...(Object.keys(warnings).length ? { warnings } : {}),
    }, { status: 200 });
  } catch (err) {
    console.error("[research/execute]", err);
    return safeJson({ error: "Execution failed", detail: errorToDetail(err) }, { status: 500 });
  }
}
