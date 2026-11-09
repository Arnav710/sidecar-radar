// Next.js calls register() once per server process, before any route runs.
// Telemetry is Node-only (the Edge runtime doesn't run the OTel SDK).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTelemetry } = await import("@sidecar/shared/otel");
    startTelemetry(process.env.OTEL_SERVICE_NAME ?? "sidecar-web");
  }
}
