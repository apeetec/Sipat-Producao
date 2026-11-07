import { monitorEventLoopDelay } from "node:perf_hooks";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

const MAX_SAMPLES = 5000;
const requestDurations: number[] = [];
const databaseDurations: number[] = [];
const databaseWaitDurations: number[] = [];
const endpointMetrics = new Map<
  string,
  { total: number; response429: number; response5xx: number; durations: number[] }
>();
let requestTotal = 0;
let response429Total = 0;
let response5xxTotal = 0;
let activeRequests = 0;
let databaseOperations = 0;
let databaseErrors = 0;
let waitingConnections = 0;
let previousCpu = process.cpuUsage();
let previousCpuTime = process.hrtime.bigint();

const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();

function pushSample(target: number[], value: number) {
  target.push(value);
  if (target.length > MAX_SAMPLES) target.shift();
}

function percentile(values: number[], requested: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const value = sorted[Math.ceil((requested / 100) * sorted.length) - 1] ?? 0;
  return Math.round(value * 100) / 100;
}

export const requestMetrics: RequestHandler = (_req, res, next) => {
  const started = performance.now();
  requestTotal += 1;
  activeRequests += 1;
  res.once("finish", () => {
    const pathname = _req.originalUrl.split("?", 1)[0] ?? _req.path;
    const normalizedPath = pathname
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
        ":id",
      )
      .replace(/(\/events\/)(?!by-id|participations)[^/]+(?=\/|$)/, "$1:param")
      .replace(/(\/admin\/(?:users|units|events|questions|event-dates|draws)\/)[^/]+(?=\/|$)/, "$1:id");
    const endpointKey = `${_req.method} ${normalizedPath}`;
    const duration = performance.now() - started;
    activeRequests = Math.max(0, activeRequests - 1);
    pushSample(requestDurations, duration);
    if (res.statusCode === 429) response429Total += 1;
    if (res.statusCode >= 500) response5xxTotal += 1;
    const endpoint = endpointMetrics.get(endpointKey) ?? {
      total: 0,
      response429: 0,
      response5xx: 0,
      durations: [],
    };
    endpoint.total += 1;
    if (res.statusCode === 429) endpoint.response429 += 1;
    if (res.statusCode >= 500) endpoint.response5xx += 1;
    pushSample(endpoint.durations, duration);
    if (endpointMetrics.has(endpointKey) || endpointMetrics.size < 100)
      endpointMetrics.set(endpointKey, endpoint);
  });
  next();
};

export function beginDatabaseOperation() {
  databaseOperations += 1;
  const started = performance.now();
  return (failed = false) => {
    databaseOperations = Math.max(0, databaseOperations - 1);
    if (failed) databaseErrors += 1;
    pushSample(databaseDurations, performance.now() - started);
  };
}

export function beginConnectionWait() {
  waitingConnections += 1;
  const started = performance.now();
  return () => {
    waitingConnections = Math.max(0, waitingConnections - 1);
    pushSample(databaseWaitDurations, performance.now() - started);
  };
}

export function metricsSnapshot() {
  const memory = process.memoryUsage();
  const now = process.hrtime.bigint();
  const cpu = process.cpuUsage(previousCpu);
  const elapsedMicros = Number(now - previousCpuTime) / 1000;
  const cpuPercentOfOneCore =
    elapsedMicros > 0
      ? Math.round((((cpu.user + cpu.system) / elapsedMicros) * 100) * 100) / 100
      : 0;
  previousCpu = process.cpuUsage();
  previousCpuTime = now;
  return {
    generatedAt: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      cpuPercentOfOneCore,
      eventLoopDelayMs: {
        p95: Math.round((eventLoop.percentile(95) / 1e6) * 100) / 100,
        p99: Math.round((eventLoop.percentile(99) / 1e6) * 100) / 100,
      },
    },
    http: {
      requestsTotal: requestTotal,
      activeRequests,
      responses429Total: response429Total,
      responses5xxTotal: response5xxTotal,
      recentSampleSize: requestDurations.length,
      latencyMs: {
        p50: percentile(requestDurations, 50),
        p95: percentile(requestDurations, 95),
        p99: percentile(requestDurations, 99),
      },
      hottestEndpoints: [...endpointMetrics.entries()]
        .map(([endpoint, value]) => ({
          endpoint,
          requests: value.total,
          responses429: value.response429,
          responses5xx: value.response5xx,
          latencyMs: {
            p95: percentile(value.durations, 95),
            p99: percentile(value.durations, 99),
          },
        }))
        .sort((left, right) => right.latencyMs.p95 - left.latencyMs.p95)
        .slice(0, 25),
    },
    database: {
      connectionLimit: env.DATABASE_CONNECTION_LIMIT,
      activeOperations: databaseOperations,
      waitingConnections,
      errorsTotal: databaseErrors,
      recentSampleSize: databaseDurations.length,
      operationLatencyMs: {
        p95: percentile(databaseDurations, 95),
        p99: percentile(databaseDurations, 99),
      },
      connectionWaitMs: {
        p95: percentile(databaseWaitDurations, 95),
        p99: percentile(databaseWaitDurations, 99),
      },
    },
  };
}
