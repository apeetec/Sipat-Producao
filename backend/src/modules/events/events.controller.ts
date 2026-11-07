import type { Request, Response } from "express";
import { eventsService } from "./events.service.js";
const idOf = (req: Request) => String(req.params.id);
export const eventsController = {
  list: async (req: Request, res: Response) =>
    res.json(await eventsService.list(req.auth!)),
  bySlug: async (req: Request, res: Response) =>
    res.json(await eventsService.bySlug(req.auth!, String(req.params.slug))),
  participant: async (req: Request, res: Response) =>
    res.json(await eventsService.participant(req.auth!, idOf(req))),
  attendance: async (req: Request, res: Response) =>
    res.json(
      await eventsService.attendance(
        req.auth!,
        idOf(req),
        req.body.attendanceCode,
        req.ip,
      ),
    ),
  progress: async (req: Request, res: Response) =>
    res.json(await eventsService.progress(req.auth!, idOf(req), req.body)),
  submit: async (req: Request, res: Response) => {
    const result = await eventsService.submit(
      req.auth!,
      idOf(req),
      req.body,
      req.get("idempotency-key"),
      req.ip,
    );
    if (result.replayed) res.setHeader("Idempotency-Replayed", "true");
    return res.status(result.status).json(result.body);
  },
  participations: async (req: Request, res: Response) =>
    res.json(
      await eventsService.listParticipations(
        req.auth!,
        req.query as { userId?: string; eventDayId?: string },
      ),
    ),
  myParticipations: async (req: Request, res: Response) =>
    res.json(
      await eventsService.listParticipations(req.auth!, {
        userId: req.auth!.id,
      }),
    ),
};
