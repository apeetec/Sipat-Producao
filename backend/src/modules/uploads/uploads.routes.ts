import { randomUUID } from "node:crypto";
import { access, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import { fileTypeFromFile } from "file-type";
import multer from "multer";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireAdmin, requireAuth } from "../../middlewares/auth.js";
import { sensitiveLimiter } from "../../middlewares/security.js";
import { AppError, notFound } from "../../shared/errors.js";
import { asyncHandler, validate } from "../../shared/http.js";
import { auditRepository } from "../audit/audit.repository.js";

const storageRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
const temporaryRoot = path.join(storageRoot, ".tmp");

const acceptedTypes = {
  image: new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ]),
  video: new Map([
    ["video/mp4", "mp4"],
    ["video/webm", "webm"],
    ["video/ogg", "ogv"],
    ["video/quicktime", "mov"],
  ]),
} as const;

const declaredMimeTypes = new Set(
  [...acceptedTypes.image.keys(), ...acceptedTypes.video.keys()],
);

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    void mkdir(temporaryRoot, { recursive: true })
      .then(() => callback(null, temporaryRoot))
      .catch((error: unknown) => callback(error as Error, temporaryRoot));
  },
  filename: (_req, _file, callback) =>
    callback(null, `${randomUUID()}.upload`),
});

const uploader = multer({
  storage: uploadStorage,
  limits: {
    files: 1,
    fields: 2,
    fileSize: env.MAX_UPLOAD_VIDEO_MB * 1024 * 1024,
    fieldNameSize: 40,
    fieldSize: 100,
    parts: 4,
  },
  fileFilter: (_req, file, callback) => {
    if (!declaredMimeTypes.has(file.mimetype)) {
      return callback(
        new AppError(
          422,
          "UNSUPPORTED_FILE_TYPE",
          "Tipo de arquivo não permitido.",
        ),
      );
    }
    callback(null, true);
  },
});

const receiveSingleFile: RequestHandler = (req, res, next) => {
  uploader.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      return next(
        new AppError(
          tooLarge ? 413 : 422,
          tooLarge ? "FILE_TOO_LARGE" : "INVALID_MULTIPART",
          tooLarge
            ? "O arquivo excede o limite configurado."
            : "Upload inválido.",
        ),
      );
    }
    next(error);
  });
};

const kindSchema = z.object({ kind: z.enum(["image", "video"]) }).strict();
const publicFileSchema = z
  .object({
    kind: z.enum(["image", "video"]),
    filename: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|mp4|webm|ogv|mov)$/i,
      ),
  })
  .strict();

async function removeTemporaryFile(filePath?: string) {
  if (!filePath) return;
  await unlink(filePath).catch(() => undefined);
}

export const uploadsAdminRouter = Router();
uploadsAdminRouter.use(requireAuth, requireAdmin);
uploadsAdminRouter.post(
  "/",
  sensitiveLimiter,
  receiveSingleFile,
  asyncHandler(async (req, res) => {
    const temporaryPath = req.file?.path;
    try {
      const { kind } = kindSchema.parse(req.body);
      if (!req.file || !temporaryPath)
        throw new AppError(422, "FILE_REQUIRED", "Selecione um arquivo.");

      const detected = await fileTypeFromFile(temporaryPath);
      const allowed = acceptedTypes[kind];
      const extension = detected ? allowed.get(detected.mime as never) : undefined;
      if (!detected || !extension)
        throw new AppError(
          422,
          "UNSUPPORTED_FILE_CONTENT",
          "O conteúdo do arquivo não corresponde a um formato permitido.",
        );

      const maximumBytes =
        (kind === "image"
          ? env.MAX_UPLOAD_IMAGE_MB
          : env.MAX_UPLOAD_VIDEO_MB) *
        1024 *
        1024;
      if (req.file.size > maximumBytes)
        throw new AppError(
          413,
          "FILE_TOO_LARGE",
          `O arquivo excede o limite de ${kind === "image" ? env.MAX_UPLOAD_IMAGE_MB : env.MAX_UPLOAD_VIDEO_MB} MB.`,
        );

      const destinationRoot = path.join(storageRoot, kind);
      await mkdir(destinationRoot, { recursive: true });
      const filename = `${randomUUID()}.${extension}`;
      const destination = path.join(destinationRoot, filename);
      await rename(temporaryPath, destination);

      await auditRepository.write(
        req.auth!,
        "UPLOAD_ASSET",
        "uploads",
        filename,
        undefined,
        {
          kind,
          mimeType: detected.mime,
          size: req.file.size,
          originalName: path.basename(req.file.originalname).slice(0, 255),
        },
        req.ip,
      );

      // Em hospedagens com proxy reverso, req.protocol pode ser "http" mesmo
      // para uma chamada HTTPS. A origem pública explícita evita Mixed Content.
      const baseUrl =
        env.mediaPublicBaseUrl ??
        env.publicBaseUrl ??
        `${env.isProduction ? "https" : req.protocol}://${req.get("host")}`;
      res.status(201).json({
        url: `${baseUrl}${env.API_PREFIX}/uploads/${kind}/${filename}`,
        mimeType: detected.mime,
        size: req.file.size,
        originalName: path.basename(req.file.originalname).slice(0, 255),
      });
    } catch (error) {
      await removeTemporaryFile(temporaryPath);
      throw error;
    }
  }),
);

export const uploadsPublicRouter = Router();
uploadsPublicRouter.get(
  "/:kind/:filename",
  validate({ params: publicFileSchema }),
  asyncHandler(async (req, res) => {
    const { kind, filename } = req.params as {
      kind: "image" | "video";
      filename: string;
    };
    const kindRoot = path.resolve(storageRoot, kind);
    const filePath = path.resolve(kindRoot, filename);
    if (!filePath.startsWith(`${kindRoot}${path.sep}`)) throw notFound("Arquivo");
    await access(filePath).catch(() => {
      throw notFound("Arquivo");
    });

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(filePath);
  }),
);
