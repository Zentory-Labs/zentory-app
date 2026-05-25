// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Diagnostic: confirm this module actually runs on the client. If you see
// this log in the browser console, Sentry init has executed. Remove after
// verifying.
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[ZENTORY] Sentry client init starting");
}

Sentry.init({
  dsn: "https://c5dc033ef25cc26169acdef479e436fd@o4511450247069696.ingest.de.sentry.io/4511450294517840",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
