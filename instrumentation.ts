import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward server-side request errors (App Router route handlers, Server
// Components, etc.) to Sentry. Without this export, the error boundary
// in `app/global-error.tsx` only catches client errors and server failures
// vanish into Vercel function logs.
export const onRequestError = Sentry.captureRequestError;
