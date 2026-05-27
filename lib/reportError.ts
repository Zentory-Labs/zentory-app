import * as Sentry from "@sentry/nextjs";

/**
 * Audit M-13: centralized error reporting.
 *
 * The dApp has ~20 `catch {}` blocks that set local error UI state but never
 * forwarded the exception to Sentry, so hard-to-reproduce client bugs (failed
 * contract reads, RPC hiccups, wallet quirks) were invisible in production.
 *
 * Wrap those catch blocks with reportError(err, context) to both (a) surface
 * the error to Sentry with a structured context tag and (b) keep a console
 * line in dev. It returns a user-safe message string the caller can drop into
 * local error state, so the call site stays a one-liner:
 *
 *   } catch (err) {
 *     setError(reportError(err, { scope: "stake.submit", vault }));
 *   }
 *
 * Note: Sentry PII is disabled (sendDefaultPii: false, see Providers.tsx), so
 * the context object should avoid raw wallet addresses where possible — pass
 * scope + non-identifying metadata.
 */
export function reportError(
  err: unknown,
  context?: Record<string, unknown>,
): string {
  // Best-effort capture. Never throw from the error path.
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* swallow — reporting must never break the UI */
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[reportError]", context?.scope ?? "", err);
  }

  const anyErr = err as { shortMessage?: string; message?: string };
  return anyErr?.shortMessage ?? anyErr?.message ?? "Something went wrong. Please try again.";
}
