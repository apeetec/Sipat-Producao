import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middlewares/auth.js";
import {
  adminBatchLimiter,
  sensitiveLimiter,
} from "../../middlewares/security.js";
import { asyncHandler, validate } from "../../shared/http.js";
import { pageQuery, uuidParam } from "../../shared/schemas.js";
import { adminController as c } from "./admin.controller.js";
import {
  clientAuditEvent,
  eventCreate,
  eventUpdate,
  questionCreate,
  questionUpdate,
  regulationSave,
  settingsUpdate,
  unitCreate,
  unitUpdate,
  userCreate,
  userUpdate,
  selectedUsers,
  resetUserParticipations,
} from "./admin.schemas.js";
import { auditRepository } from "../audit/audit.repository.js";

const protectedRouter = Router();
protectedRouter.use(requireAuth, requireAdmin);

const usersQuery = pageQuery.extend({
  unitId: z.string().uuid().optional(),
  role: z.enum(["admin", "collaborator"]).optional(),
  active: z.enum(["true", "false"]).optional(),
});
protectedRouter.get(
  "/users",
  validate({ query: usersQuery }),
  asyncHandler(c.listUsers),
);
protectedRouter.post(
  "/users",
  sensitiveLimiter,
  validate({ body: userCreate }),
  asyncHandler(c.createUser),
);
protectedRouter.post(
  "/users/reset-participations",
  adminBatchLimiter,
  validate({ body: resetUserParticipations }),
  asyncHandler(c.resetUserParticipations),
);
protectedRouter.post(
  "/users/bulk-delete",
  adminBatchLimiter,
  validate({ body: selectedUsers }),
  asyncHandler(c.deleteUsers),
);
protectedRouter.get(
  "/users/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.getUser),
);
protectedRouter.patch(
  "/users/:id",
  validate({ params: uuidParam, body: userUpdate }),
  asyncHandler(c.updateUser),
);
protectedRouter.delete(
  "/users/:id",
  sensitiveLimiter,
  validate({ params: uuidParam }),
  asyncHandler(c.deleteUser),
);

protectedRouter.get("/units", asyncHandler(c.listUnits));
protectedRouter.post(
  "/units",
  validate({ body: unitCreate }),
  asyncHandler(c.createUnit),
);
protectedRouter.get(
  "/units/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.getUnit),
);
protectedRouter.patch(
  "/units/:id",
  validate({ params: uuidParam, body: unitUpdate }),
  asyncHandler(c.updateUnit),
);
protectedRouter.delete(
  "/units/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.deleteUnit),
);

protectedRouter.get("/events", asyncHandler(c.listEvents));
protectedRouter.post(
  "/events",
  validate({ body: eventCreate }),
  asyncHandler(c.createEvent),
);
protectedRouter.get(
  "/events/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.getEvent),
);
protectedRouter.patch(
  "/events/:id",
  validate({ params: uuidParam, body: eventUpdate }),
  asyncHandler(c.updateEvent),
);
protectedRouter.delete(
  "/events/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.deleteEvent),
);

protectedRouter.get(
  "/questions",
  validate({ query: z.object({ eventDayId: z.string().uuid().optional() }) }),
  asyncHandler(c.listQuestions),
);
protectedRouter.post(
  "/questions",
  validate({ body: questionCreate }),
  asyncHandler(c.createQuestion),
);
protectedRouter.get(
  "/questions/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.getQuestion),
);
protectedRouter.patch(
  "/questions/:id",
  validate({ params: uuidParam, body: questionUpdate }),
  asyncHandler(c.updateQuestion),
);
protectedRouter.delete(
  "/questions/:id",
  validate({ params: uuidParam }),
  asyncHandler(c.deleteQuestion),
);

protectedRouter.get("/settings", asyncHandler(c.getSettings));
protectedRouter.put(
  "/settings",
  validate({ body: settingsUpdate }),
  asyncHandler(c.updateSettings),
);
protectedRouter.get(
  "/regulations",
  validate({ query: z.object({ version: z.string().max(40).optional() }) }),
  asyncHandler(c.getRegulation),
);
protectedRouter.put(
  "/regulations",
  validate({ body: regulationSave }),
  asyncHandler(c.saveRegulation),
);
protectedRouter.get(
  "/audit",
  validate({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }),
  }),
  asyncHandler(c.audit),
);
protectedRouter.get(
  "/audit/access-logs",
  validate({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }),
  }),
  asyncHandler(c.accessLogs),
);
protectedRouter.post(
  "/audit/client-events",
  sensitiveLimiter,
  validate({ body: clientAuditEvent }),
  asyncHandler(async (req, res) => {
    const created = await auditRepository.write(
      req.auth!,
      req.body.action,
      "users",
      req.body.entityId,
      undefined,
      req.body.afterData,
      req.ip,
    );
    res.status(201).json({
      ...created,
      actorUserId: req.auth!.id,
      actorName: req.auth!.displayName,
      action: req.body.action,
      entity: "users",
      entityId: req.body.entityId,
      afterData: req.body.afterData,
    });
  }),
);

export const adminRouter = protectedRouter;
