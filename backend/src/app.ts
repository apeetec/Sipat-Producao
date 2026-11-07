import express, { Router } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { checkDatabase } from "./database/pool.js";
import { openapi } from "./docs/openapi.js";
import {
  globalLimiter,
  honeypot,
  requestContext,
  notFoundHandler,
  errorHandler,
} from "./middlewares/security.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import {
  eventsRouter,
  participationsRouter,
} from "./modules/events/events.routes.js";
import {
  drawsAdminRouter,
  winnersRouter,
} from "./modules/draws/draws.routes.js";
import { publicRouter } from "./modules/public/public.routes.js";
import {
  uploadsAdminRouter,
  uploadsPublicRouter,
} from "./modules/uploads/uploads.routes.js";
import { reportsAdminRouter } from "./modules/reports/reports.routes.js";
import { metricsRouter } from "./observability/metrics.routes.js";
import { requestMetrics } from "./observability/metrics.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(
    requestContext,
    requestMetrics,
    pinoHttp({ logger }),
    honeypot,
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
        },
      },
    }),
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin))
          return callback(null, true);
        callback(new Error("Origem não autorizada pelo CORS."));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Idempotency-Key",
        "X-Request-Id",
      ],
    }),
    compression(),
    express.json({ limit: "1mb", strict: true }),
    express.urlencoded({ extended: false, limit: "100kb" }),
    cookieParser(),
    globalLimiter,
  );
  const api = Router();
  api.get("/health/live", (_req, res) =>
    res.json({ status: "ok", timestamp: new Date().toISOString() }),
  );
  api.get("/health/ready", async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not_ready" });
    }
  });
  api.use(publicRouter);
  api.use("/auth", authRouter);
  api.use("/events", eventsRouter);
  api.use("/winners", winnersRouter);
  api.use("/uploads", uploadsPublicRouter);
  api.use("/admin/uploads", uploadsAdminRouter);
  api.use("/admin/reports", reportsAdminRouter);
  api.use("/admin/metrics", metricsRouter);
  api.use("/admin", adminRouter);
  api.use("/admin/participations", participationsRouter);
  api.use("/admin/draws", drawsAdminRouter);
  app.use(env.API_PREFIX, api);
  app.use(`${env.API_PREFIX}/v1`, api);
  if (env.SWAGGER_ENABLED) {
    app.use(
      `${env.API_PREFIX}/docs`,
      swaggerUi.serve,
      swaggerUi.setup(openapi, { customSiteTitle: "SIPAT API" }),
    );
    app.get(`${env.API_PREFIX}/openapi.json`, (_req, res) => res.json(openapi));
  }
  app.use(notFoundHandler, errorHandler);
  return app;
}
