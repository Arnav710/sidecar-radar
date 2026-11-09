import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Standalone output = a small self-contained server for the Docker image.
  output: "standalone",
  // The repo is an npm workspace, so trace files from the repo root.
  outputFileTracingRoot: path.join(__dirname, ".."),
  // @sidecar/shared ships TypeScript source.
  transpilePackages: ["@sidecar/shared"],
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
