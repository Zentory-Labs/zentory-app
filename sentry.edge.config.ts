// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: "https://c5dc033ef25cc26169acdef479e436fd@o4511450247069696.ingest.de.sentry.io/4511450294517840",

  // Audit finding #43 — see sentry.server.config.ts for the reasoning. The
  // edge runtime fronts proxy.ts, so it sees every request's cookies.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Audit finding #43: was `true`. PII off, matching lib/reportError.ts and
  // components/Providers.tsx.
  sendDefaultPii: false,

  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
});
