export const runtime = "nodejs";

export async function GET(request: Request) {
  // Vercel provides these at build/deploy time (server-side only).
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "unknown";

  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";

  // Echo Vercel/Cloudflare's view of the requester's country. Useful for
  // verifying geo-blocking from a VPN without trusting client-supplied
  // headers (which Vercel overrides). Not sensitive — country only.
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    "XX";

  return Response.json(
    {
      sha,
      env,
      country,
      now: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

