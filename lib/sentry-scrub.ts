/**
 * Audit finding #43 — server/edge Sentry was shipping credential-bearing
 * request headers and user IPs to a third party at 100% sampling.
 *
 * Two things matter here and only one of them is `sendDefaultPii`:
 *
 *  1. `sendDefaultPii: false` gates the IP / user identity capture. Necessary,
 *     and it also matches what lib/reportError.ts and components/Providers.tsx
 *     already document as the policy.
 *
 *  2. It does NOT gate `event.request.headers`. In @sentry/nextjs v10 the
 *     requestData integration ships `DEFAULT_INCLUDE = { headers: true,
 *     cookies: true, data: true }` independently of `sendDefaultPii`, and it
 *     runs on transaction events too — so with a 100% trace sample rate the
 *     raw header dict left the server on ordinary 200s, no exception needed.
 *     On these routes those headers carry `authorization: Bearer
 *     <KEEPER_API_KEY>`, `x-api-key` (contributor keys) and Supabase session
 *     cookies. Sentry's own ingest-side scrubbing might catch "authorization"
 *     (it contains "auth") but will not match "x-api-key".
 *
 * So the scrub below is the actual fix, not defence in depth: it deletes the
 * sensitive headers before the event leaves the process, on both error and
 * transaction events. Denylist rather than allowlist so a new header does not
 * silently start leaking, plus a substring sweep for anything that looks like
 * a credential.
 */

const DENIED_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "apikey",
  "api-key",
  "x-supabase-auth",
  "x-vercel-signature",
  "x-cron-secret",
]);

/** Substrings that mark a header as credential-bearing whatever it is called. */
const DENIED_SUBSTRINGS = ["auth", "token", "secret", "key", "session", "cookie"];

/** Headers that identify the caller rather than authenticate them. */
const IP_HEADERS = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip"];

function scrubHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (DENIED_HEADERS.has(lower)) continue;
    if (DENIED_SUBSTRINGS.some((s) => lower.includes(s))) continue;
    if (IP_HEADERS.includes(lower)) continue;
    clean[name] = value;
  }
  return clean;
}

/**
 * Structural shape of the bits we touch. Declared locally rather than imported:
 * @sentry/nextjs does not re-export `ErrorEvent` / `TransactionEvent`, and a
 * loose structural constraint keeps this usable as BOTH `beforeSend` and
 * `beforeSendTransaction` across SDK minor versions.
 */
type ScrubbableEvent = {
  request?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    data?: unknown;
    query_string?: unknown;
  };
  user?: {
    ip_address?: string | null;
    email?: string;
    username?: string;
  };
  contexts?: Record<string, unknown>;
};

/**
 * Strip credentials, cookies, bodies and caller IPs from an outbound event.
 * Safe to use as both `beforeSend` and `beforeSendTransaction`.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const request = event.request;
  if (request) {
    if (request.headers && typeof request.headers === "object") {
      request.headers = scrubHeaders(
        request.headers as Record<string, unknown>,
      ) as Record<string, string>;
    }
    // Cookies and request bodies are never worth the exposure on these routes.
    delete request.cookies;
    delete request.data;
    // Query strings on the API routes can carry provider identifiers.
    delete request.query_string;
  }

  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }

  // The SDK also parks the IP here when it cannot attach it to `user`.
  if (event.contexts?.client_ip) delete event.contexts.client_ip;

  return event;
}
