"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/**
 * Global error boundary (VAL-DAPP-134/136). Runs when the root layout itself
 * fails to render — i.e. the error happens ABOVE the segment-level
 * `app/error.tsx` boundary, including during SSR of the root layout.
 *
 * Next.js requires that `app/global-error.tsx` render its own `<html>` and
 * `<body>` because the root layout is presumed broken at this point. We use
 * the bundled `next/error` `<NextError>` component for the actual error UI
 * (the same one older Next.js projects got for free), which renders the
 * stock "Application error: a client-side exception has occurred" page that
 * includes a stack trace — good for debugging, no PII because sendDefaultPii
 * is off + lib/sentry-scrub.ts strips request headers / cookies / IPs.
 *
 * For the segment-level boundary that catches thrown render errors inside a
 * route (where the root layout still works), see `app/error.tsx`.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error, { extra: { scope: "global-error" } });
  }, [error]);

  return (
    <html lang="en">
      <body data-test="global-error-boundary">
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
