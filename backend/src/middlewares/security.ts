import type { ErrorRequestHandler, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../shared/errors.js";

const rateResponse = {
  error: {
    code: "RATE_LIMITED",
    message: "Muitas requisições. Tente novamente mais tarde.",
  },
};
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateResponse,
});
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateResponse,
});
export const sensitiveLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateResponse,
});
export const adminBatchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateResponse,
});

const blocked = new Map<string, number>();
const traps = new Set([
  "/.env",
  "/wp-login.php",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/admin.php",
  "/.git/config",
]);
export const honeypot: RequestHandler = (req, res, next) => {
  const ip = req.ip ?? "unknown";
  const until = blocked.get(ip) ?? 0;
  if (until > Date.now()) return res.status(429).json(rateResponse);
  if (traps.has(req.path.toLowerCase())) {
    blocked.set(ip, Date.now() + env.HONEYPOT_BLOCK_MS);
    logger.warn(
      { ip, path: req.path, userAgent: req.get("user-agent") },
      "Honeypot acionado",
    );
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "Recurso não encontrado." },
    });
  }
  if (until) blocked.delete(ip);
  next();
};

export const requestContext: RequestHandler = (req, res, next) => {
  req.requestId = req.get("x-request-id")?.slice(0, 100) || randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};

export const notFoundHandler: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Rota não encontrada."));

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados da requisição inválidos.",
        details: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      requestId: req.requestId,
    });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      requestId: req.requestId,
    });
  }
  const mysql = error as { code?: string };
  if (mysql.code === "ER_DUP_ENTRY")
    return res.status(409).json({
      error: {
        code: "DUPLICATE",
        message: "Já existe um registro com estes dados.",
      },
      requestId: req.requestId,
    });
  logger.error({ err: error, requestId: req.requestId }, "Erro não tratado");
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Não foi possível concluir a operação.",
    },
    requestId: req.requestId,
  });
};
