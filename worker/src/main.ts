// Entry point: start telemetry BEFORE loading the server, so the http module is
// patched when the server first requires it (incoming requests then continue
// the trace started in the web app, via the traceparent header).
import { startTelemetry } from "@sidecar/shared/otel";

startTelemetry(process.env.OTEL_SERVICE_NAME ?? "sidecar-worker");

void import("./index");
