import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Suppress dev-server `EPIPE` from `next/dist/server/dev/log-requests.js`
    // when stdout is closed (HMR reattaches, terminal resize, etc.). These
    // are noisy in Sentry because the dev server's `process.stdout.write`
    // throws when the underlying pipe is gone; the request still completed
    // successfully. Sentry alert JAVASCRIPT-NEXTJS-8.
    installStdoutEpipeGuard();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/// @dev One-time registration of a process-level stdout/stderr error listener
///      that swallows EPIPE so the dev server's request logger does not throw
///      on closed pipes. Production servers (Vercel functions) don't write to
///      stdout from request handlers, so this is a dev-only effect — but the
///      cost is one event listener per process.
function installStdoutEpipeGuard() {
  const proc: NodeJS.Process = process;
  const swallow = (err: NodeJS.ErrnoException | Error) => {
    if ((err as NodeJS.ErrnoException).code === "EPIPE") return;
    // Re-emit any other error so genuine crashes still surface.
    console.error("[stdout/stderr guard] unhandled stream error:", err);
  };
  if (proc.stdout && typeof proc.stdout.on === "function") {
    proc.stdout.on("error", swallow);
  }
  if (proc.stderr && typeof proc.stderr.on === "function") {
    proc.stderr.on("error", swallow);
  }
}

// Forward server-side request errors (App Router route handlers, Server
// Components, etc.) to Sentry. Without this export, the error boundary
// in `app/global-error.tsx` only catches client errors and server failures
// vanish into Vercel function logs.
export const onRequestError = Sentry.captureRequestError;
