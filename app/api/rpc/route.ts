export const runtime = "nodejs";

const UPSTREAM_RPC_URL =
  process.env.HYPEREVM_RPC_URL ??
  process.env.NEXT_PUBLIC_HYPEREVM_RPC ??
  "https://rpc.hyperliquid-testnet.xyz/evm";

export async function POST(req: Request) {
  const body = await req.text();

  const upstream = await fetch(UPSTREAM_RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    // Avoid Next caching JSON-RPC responses.
    cache: "no-store",
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

