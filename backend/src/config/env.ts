import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .string()
  .default("true")
  .transform((value) => value === "true");

const falseByDefault = z
  .string()
  .default("false")
  .transform((value) => value === "true");

const schema = z
  .object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.ipv4().default("127.0.0.1"),
  API_PREFIX: z
    .string()
    .regex(/^\/[a-z0-9/_-]*$/i)
    .default("/api"),
  PUBLIC_BASE_URL: z.string().url().optional(),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DATABASE_NAME: z.string().regex(/^[a-zA-Z0-9_]+$/),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().optional(),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
  DEFAULT_ORGANIZATION_SLUG: z.string().min(1).default("honda"),
  DEFAULT_CAMPAIGN_SLUG: z.string().min(1).default("sipat-2026"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_NAME: z.string().min(1).default("sipat_refresh_token"),
  CORS_ORIGINS: z.string().min(1),
  TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(1),
  IP_HASH_SECRET: z.string().min(16),
  PASSWORD_BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(3).default(8),
  HONEYPOT_BLOCK_MS: z.coerce.number().int().min(60000).default(3600000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SWAGGER_ENABLED: booleanFromString,
  UPLOAD_DIR: z.string().min(1).default("storage/uploads"),
  MAX_UPLOAD_IMAGE_MB: z.coerce.number().int().min(1).max(25).default(10),
  MAX_UPLOAD_VIDEO_MB: z.coerce.number().int().min(1).max(1024).default(500),
  EMAIL_MODE: z.enum(["outbox", "smtp"]).default("outbox"),
  EMAIL_OUTBOX_DIR: z.string().min(1).default("storage/outbox"),
  EMAIL_FROM: z.string().email().default("noreply@localhost.test"),
  EMAIL_FROM_NAME: z.string().min(1).max(120).default("Portal SIPAT"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: falseByDefault,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.DATABASE_PASSWORD) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_PASSWORD"],
        message: "é obrigatória e não pode ser vazia em produção",
      });
    }
    if (value.EMAIL_MODE === "smtp" && !value.SMTP_HOST) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "é obrigatório quando EMAIL_MODE=smtp",
      });
    }
    if (
      value.EMAIL_MODE === "smtp" &&
      ((value.SMTP_USER && !value.SMTP_PASSWORD) ||
        (!value.SMTP_USER && value.SMTP_PASSWORD))
    ) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_USER"],
        message: "SMTP_USER e SMTP_PASSWORD devem ser informados juntos",
      });
    }
  });

const result = schema.safeParse(process.env);
if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Configuração de ambiente inválida: ${details}`);
}

export const env = {
  ...result.data,
  // XAMPP local costuma usar root sem senha. Produção é bloqueada acima.
  DATABASE_PASSWORD: result.data.DATABASE_PASSWORD ?? "",
  publicBaseUrl: result.data.PUBLIC_BASE_URL?.replace(/\/$/, ""),
  isProduction: result.data.NODE_ENV === "production",
  corsOrigins: result.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
