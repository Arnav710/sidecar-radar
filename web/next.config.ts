import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Standalone output = a small self-contained server for the Docker image.
  output: "standalone",
  // The repo is an npm workspace, so trace files from the repo root.
  outputFileTracingRoot: path.join(__dirname, ".."),
  // @sidecar/shared ships TypeScript source.
  transpilePackages: ["@sidecar/shared"],
  // Load the OpenTelemetry SDK from node_modules at runtime instead of bundling
  // it (it relies on runtime module patching).
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/instrumentation-http",
    "@opentelemetry/instrumentation-undici",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@opentelemetry/exporter-metrics-otlp-proto",
    "@opentelemetry/exporter-logs-otlp-proto",
  ],
  poweredByHeader: false,
  // Kubernetes probes hit /healthz and /readyz (see deploy/deployment.yaml).
  async rewrites() {
    return [
      { source: "/healthz", destination: "/api/healthz" },
      { source: "/readyz", destination: "/api/readyz" },
    ];
  },
};

export default config;
