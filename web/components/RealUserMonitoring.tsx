"use client";

import { useEffect } from "react";

// Dash0 website monitoring: page views, web vitals, fetch timing and JS errors
// from real attendees' phones. Same-origin API calls carry trace headers, so a
// tap on "Ask" links to the server trace in Dash0.
//
// The token is PUBLIC (it ships to every browser), so it must be a separate
// Dash0 token with only "Ingesting" permission. It is injected at runtime from
// DASH0_RUM_TOKEN, never baked into the public image.
export function RealUserMonitoring({ endpoint, token, version, environment }: { endpoint: string; token: string; version: string; environment: string }) {
  useEffect(() => {
    let cancelled = false;
    import("@dash0/sdk-web").then(({ init }) => {
      if (cancelled) return;
      init({
        serviceName: "sidecar-browser",
        serviceVersion: version,
        environment,
        endpoint: { url: endpoint, authToken: token },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint, token, version, environment]);
  return null;
}
