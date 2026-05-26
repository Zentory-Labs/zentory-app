// Sentry client config. NOTE: under Turbopack (Next.js 16 default) the
// top-level Sentry.init() here does NOT execute even though the file is
// bundled — Turbopack treats instrumentation-client.ts differently than
// Webpack does. The actual client init is in components/Providers.tsx.
//
// We keep this file for two reasons:
//   1. The onRouterTransitionStart export is still wired by Next.js for
//      route-transition tracing (works via a different code path that
//      Turbopack handles correctly).
//   2. If Sentry/Next.js fix the Turbopack regression, removing the
//      Providers.tsx workaround restores this file as the canonical
//      init site without a rename.
//
// See task #107 for the upstream tracking issue.

import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
