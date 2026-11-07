import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middlewares/auth.js";
import {
  attendanceLimiter,
  quizSubmissionLimiter,
  videoProgressLimiter,
} from "../../middlewares/security.js";
import { asyncHandler, validate } from "../../shared/http.js";
import { slugParam, uuidParam } from "../../shared/schemas.js";
import { eventsController as c } from "./events.controller.js";
import {
  attendanceSchema,
  progressSchema,
  quizSchema,
} from "./events.schemas.js";
export const eventsRouter = Router();
const validateOptionalIdempotencyKey = ((req, _res, next) => {
  const value = req.get("idempotency-key");
  if (value)
    z.string()
      .min(16)
      .max(150)
      .regex(/^[A-Za-z0-9._:-]+$/)
      .parse(value);
  next();
}) satisfies import("express").RequestHandler;
eventsRouter.use(requireAuth);
eventsRouter.get("/", asyncHandler(c.list));
eventsRouter.get("/participations/me", asyncHandler(c.myParticipations));
eventsRouter.get(
  "/by-id/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.participant),
);
eventsRouter.post(
  "/:id/attendance",
  attendanceLimiter,
  validate({ params: uuidParam, body: attendanceSchema }),
  asyncHandler(c.attendance),
);
eventsRouter.post(
  "/:id/video-progress",
  videoProgressLimiter,
  validate({ params: uuidParam, body: progressSchema }),
  asyncHandler(c.progress),
);
eventsRouter.post(
  "/:id/quiz",
  quizSubmissionLimiter,
  validateOptionalIdempotencyKey,
  validate({ params: uuidParam, body: quizSchema }),
  asyncHandler(c.submit),
);
eventsRouter.get(
  "/:slug",
  validate({ params: slugParam }),
  asyncHandler(c.bySlug),
);
export const participationsRouter = Router();
participationsRouter.use(requireAuth, requireAdmin);
participationsRouter.get(
  "/",
  validate({
    query: z.object({
      userId: z.string().uuid().optional(),
      eventDayId: z.string().uuid().optional(),
    }),
  }),
  asyncHandler(c.participations),
);
