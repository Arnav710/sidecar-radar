// OpenTelemetry for Sidecar's Node services (web server and worker), exported
// to Dash0 over OTLP/HTTP. Server-only: import it as "@sidecar/shared/otel",
// never from browser code.
//
// What we send:
// - traces: every incoming/outgoing HTTP call (http + undici instrumentation,
//   which covers Elasticsearch and OpenAI), Next.js route spans, plus our own
//   spans (sidecar.ask, gen_ai.chat, ...)
// - metrics: product health (caption lag, answer latency, questions, signals,
//   LLM tokens). These back the Dash0 SLOs.
// - logs: structured JSON, correlated with the active trace.
//
// Privacy (Gitar rule 8): attributes and logs carry ids, counts and timings,
// never question, transcript or profile text.

import { diag, DiagConsoleLogger, DiagLogLevel, logs, metrics, SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

let sdk: NodeSDK | undefined;

/** Start exporting to Dash0. No-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset. */
export function startTelemetry(serviceName: string): void {
  if (sdk) return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "");
  if (!endpoint) {
    console.log(JSON.stringify({ msg: "telemetry.disabled", reason: "OTEL_EXPORTER_OTLP_ENDPOINT not set" }));
    return;
  }
  const headers: Record<string, string> = {};
  if (process.env.DASH0_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.DASH0_AUTH_TOKEN}`;
  if (process.env.DASH0_DATASET) headers["Dash0-Dataset"] = process.env.DASH0_DATASET;
  const url = (signal: string) => `${endpoint}/v1/${signal}`;
  // Surface export failures (bad token, wrong endpoint) instead of dropping them silently.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  sdk = new NodeSDK({
    serviceName,
    // Merged with OTEL_RESOURCE_ATTRIBUTES (k8s pod/namespace from deploy/) and host/process detectors.
    resource: resourceFromAttributes({
      "service.name": serviceName,
      "service.namespace": "sidecar",
      "service.version": process.env.APP_VERSION ?? "dev",
      "deployment.environment.name": process.env.DEPLOYMENT_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
    }),
    traceExporter: new OTLPTraceExporter({ url: url("traces"), headers }),
    metricReaders: [
      new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({ url: url("metrics"), headers }), exportIntervalMillis: 15_000 }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: url("logs"), headers }) })],
    instrumentations: [
      new HttpInstrumentation({
        // Probes and static assets are noise.
        ignoreIncomingRequestHook: (req) => /^\/(healthz|readyz|api\/healthz|api\/readyz|_next\/static|favicon|icon\.svg)/.test(req.url ?? ""),
      }),
      new UndiciInstrumentation(),
    ],
  });
  sdk.start();
  console.log(JSON.stringify({ msg: "telemetry.started", service: serviceName, endpoint }));

  const stop = () => {
    sdk?.shutdown().catch(() => {}).finally(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
}

// ---- Traces ----

export const tracer = () => trace.getTracer("sidecar");

/** Run `fn` inside a span; errors are recorded and re-thrown. */
export async function withSpan<T>(name: string, attributes: Attributes, fn: (setAttrs: (a: Attributes) => void) => Promise<T>): Promise<T> {
  return tracer().startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn((a) => span.setAttributes(a));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

// ---- Metrics (created lazily, after the SDK registered the meter provider) ----

type Instruments = ReturnType<typeof createInstruments>;
let instruments: Instruments | undefined;

function createInstruments() {
  const meter = metrics.getMeter("sidecar");
  return {
    /** Speech finalized on the room laptop → line searchable in ES. SLO: p95 < 3s. */
    captionLag: meter.createHistogram("sidecar.caption.lag", { unit: "ms", description: "Time from speech to searchable caption" }),
    /** Ask request → answer returned. SLO: p95 < 4s. */
    answerLatency: meter.createHistogram("sidecar.ask.latency", { unit: "ms", description: "Time to answer a private question" }),
    questions: meter.createCounter("sidecar.questions", { description: "Private questions asked" }),
    signals: meter.createCounter("sidecar.signals", { description: "One-tap signals (lost, got_it, star)" }),
    captions: meter.createCounter("sidecar.captions", { description: "Caption lines received from room laptops" }),
    llmTokens: meter.createCounter("gen_ai.client.token.usage", { unit: "{token}", description: "LLM tokens used" }),
    llmDuration: meter.createHistogram("gen_ai.client.operation.duration", { unit: "s", description: "LLM call duration" }),
  };
}

export function m(): Instruments {
  instruments ??= createInstruments();
  return instruments;
}

// ---- Logs ----

type Level = "debug" | "info" | "warn" | "error";
const SEVERITY: Record<Level, number> = { debug: 5, info: 9, warn: 13, error: 17 };

/**
 * Structured log to stdout (for kubectl/Radar) and to Dash0 (correlated with
 * the active trace). Attributes must be ids/counts, never user text.
 */
export function log(level: Level, msg: string, attributes: Attributes = {}): void {
  const line = { level, msg, ...attributes };
  (level === "error" ? console.error : console.log)(JSON.stringify(line));
  logs.getLogger("sidecar").emit({ severityNumber: SEVERITY[level], severityText: level.toUpperCase(), body: msg, attributes });
}
