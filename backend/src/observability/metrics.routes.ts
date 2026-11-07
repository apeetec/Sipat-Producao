import { Router } from "express";
import { requireAdmin, requireAuth } from "../middlewares/auth.js";
import { metricsSnapshot } from "./metrics.js";

export const metricsRouter = Router();
metricsRouter.use(requireAuth, requireAdmin);
metricsRouter.get("/", (_req, res) => res.json(metricsSnapshot()));
