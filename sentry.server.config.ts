// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: "https://c5dc033ef25cc26169acdef479e436fd@o4511450247069696.ingest.de.sentry.io/4511450294517840",

  // Audit finding #43. Was `1`, i.e. every request produced a transaction
  // event — and transaction events carry the raw request headers. Sample at
  // 10% in production; keep full traces locally where there are no secrets.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Audit finding #43. Was `true`, which attached client IPs and user identity
  // to every event — while lib/reportError.ts and components/Providers.tsx
  // both document the policy as PII-off, and the app geo-blocks EU/US users
  // on regulatory grounds. Now consistent with the stated posture.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  // sendDefaultPii does NOT gate `event.request.headers` in v10 — see
  // lib/sentry-scrub.ts. These routes carry `Authorization: Bearer
  // <KEEPER_API_KEY>`, `x-api-key` and Supabase session cookies, so scrub
  // them out of BOTH error and transaction events before they leave.
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
});
