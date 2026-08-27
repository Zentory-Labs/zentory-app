export const runtime = "nodejs";

export async function GET(request: Request) {
  // Vercel provides these at build/deploy time (server-side only).
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "unknown";

  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";

  // Build/deploy timestamps — VERCEL_GIT_COMMIT_DATE is the commit's
  // authoring date (stable), the current "now" is the wall-clock at the
  // time of the request (changes per request). Both surfaces are useful
  // for "what commit is live" debugging and are non-sensitive.
  const deployedAt =
    process.env.VERCEL_GIT_COMMIT_DATE ?? new Date(0).toISOString();

  // Echo Vercel/Cloudflare's view of the requester's country. Useful for
  // verifying geo-blocking from a VPN without trusting client-supplied
  // headers (which Vercel overrides). Not sensitive — country only.
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    "XX";

  return Response.json(
    {
      // `commit` is the canonical key per VAL-DAPP-133 (was `sha`).
      // `sha` retained as an alias so existing probes / dashboards don't
      // break.
      commit,
      sha: commit,
      deployedAt,
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

