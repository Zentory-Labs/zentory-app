export const runtime = "nodejs";

export async function GET() {
  // Vercel provides these at build/deploy time (server-side only).
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "unknown";

  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";

  return Response.json(
    {
      sha,
      env,
      now: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

