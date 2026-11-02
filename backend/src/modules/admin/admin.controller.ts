import type { Request, Response } from "express";
import { auditRepository } from "../audit/audit.repository.js";
import { adminRepository } from "./admin.repository.js";

const idOf = (req: Request) => String(req.params.id);
async function audited(
  req: Request,
  action: string,
  entity: string,
  id: string,
  data?: unknown,
) {
  await auditRepository.write(
    req.auth!,
    action,
    entity,
    id,
    undefined,
    data,
    req.ip,
  );
}
export const adminController = {
  listUsers: async (req: Request, res: Response) =>
    res.json(
      await adminRepository.listUsers(req.auth!.organizationId, {
        ...req.query,
        campaignId: req.auth!.campaignId,
      }),
    ),
  getUser: async (req: Request, res: Response) =>
    res.json(await adminRepository.getUser(idOf(req), req.auth!.campaignId)),
  createUser: async (req: Request, res: Response) => {
    const item = await adminRepository.createUser(
      req.auth!.organizationId,
      req.auth!.campaignId,
      req.body,
    );
    await audited(req, "CREATE_USER", "users", item.id, item);
    res.status(201).json(item);
  },
  updateUser: async (req: Request, res: Response) => {
    const item = await adminRepository.updateUser(
      idOf(req),
      req.auth!.campaignId,
      req.body,
    );
    await audited(req, "UPDATE_USER", "users", item.id, item);
    res.json(item);
  },
  deleteUser: async (req: Request, res: Response) => {
    const id = idOf(req);
    await adminRepository.deactivateUser(id, req.auth!.organizationId);
    await audited(req, "DEACTIVATE_USER", "users", id);
    res.status(204).send();
  },
  deleteUsers: async (req: Request, res: Response) => {
    const result = await adminRepository.deactivateUsers(
      req.body.userIds,
      req.auth!.organizationId,
      req.auth!.id,
    );
    await audited(req, "BULK_DELETE_USERS", "users", "batch", {
      userIds: req.body.userIds,
      ...result,
    });
    res.json(result);
  },
  resetUserParticipations: async (req: Request, res: Response) => {
    const result = await adminRepository.resetUserParticipations(
      req.body.userIds,
      req.auth!.organizationId,
      req.auth!.campaignId,
      req.body.eventDayId,
    );
    await audited(req, "RESET_USER_PARTICIPATIONS", "participations", "batch", {
      userIds: req.body.userIds,
      eventDayId: req.body.eventDayId,
      ...result,
    });
    res.json(result);
  },
  listUnits: async (req: Request, res: Response) =>
    res.json(await adminRepository.listUnits(req.auth!.organizationId)),
  getUnit: async (req: Request, res: Response) =>
    res.json(
      await adminRepository.getUnit(idOf(req), req.auth!.organizationId),
    ),
  createUnit: async (req: Request, res: Response) => {
    const item = await adminRepository.createUnit(
      req.auth!.organizationId,
      req.body,
    );
    await audited(req, "CREATE_UNIT", "units", item.id, item);
    res.status(201).json(item);
  },
  updateUnit: async (req: Request, res: Response) => {
    const item = await adminRepository.updateUnit(
      idOf(req),
      req.auth!.organizationId,
      req.body,
    );
    await audited(req, "UPDATE_UNIT", "units", item.id, item);
    res.json(item);
  },
  deleteUnit: async (req: Request, res: Response) => {
    const id = idOf(req);
    await adminRepository.deleteUnit(id, req.auth!.organizationId);
    await audited(req, "DELETE_UNIT", "units", id);
    res.status(204).send();
  },
  listEventDates: async (req: Request, res: Response) =>
    res.json(await adminRepository.listEventDates(req.auth!.campaignId)),
  getEventDate: async (req: Request, res: Response) =>
    res.json(await adminRepository.getEventDate(idOf(req), req.auth!.campaignId)),
  createEventDate: async (req: Request, res: Response) => {
    const item = await adminRepository.saveEventDate(
      req.auth!.campaignId,
      undefined,
      req.body,
    );
    await audited(req, "CREATE_EVENT_DATE", "event_dates", item.id, item);
    res.status(201).json(item);
  },
  updateEventDate: async (req: Request, res: Response) => {
    const item = await adminRepository.saveEventDate(
      req.auth!.campaignId,
      idOf(req),
      req.body,
    );
    await audited(req, "UPDATE_EVENT_DATE", "event_dates", item.id, item);
    res.json(item);
  },
  deleteEventDate: async (req: Request, res: Response) => {
    const id = idOf(req);
    await adminRepository.deleteEventDate(id, req.auth!.campaignId);
    await audited(req, "DELETE_EVENT_DATE", "event_dates", id);
    res.status(204).send();
  },
  listEvents: async (req: Request, res: Response) =>
    res.json(await adminRepository.listEvents(req.auth!.campaignId)),
  getEvent: async (req: Request, res: Response) =>
    res.json(await adminRepository.getEvent(idOf(req), req.auth!.campaignId)),
  createEvent: async (req: Request, res: Response) => {
    const id = await adminRepository.saveEvent(
      req.auth!.campaignId,
      req.auth!.organizationId,
      undefined,
      req.body,
    );
    const item = await adminRepository.getEvent(id, req.auth!.campaignId);
    await audited(req, "CREATE_EVENT", "event_days", id, item);
    res.status(201).json(item);
  },
  updateEvent: async (req: Request, res: Response) => {
    const id = idOf(req);
    await adminRepository.saveEvent(
      req.auth!.campaignId,
      req.auth!.organizationId,
      id,
      req.body,
    );
    const item = await adminRepository.getEvent(id, req.auth!.campaignId);
    await audited(req, "UPDATE_EVENT", "event_days", id, item);
    res.json(item);
  },
  deleteEvent: async (req: Request, res: Response) => {
    const id = idOf(req);
    await adminRepository.deleteEvent(id, req.auth!.campaignId);
    await audited(req, "DELETE_EVENT", "event_days", id);
    res.status(204).send();
  },
  deleteEvents: async (req: Request, res: Response) => {
    const eventIds = [...new Set(req.body.eventIds as string[])];
    const result = await adminRepository.deleteEvents(
      eventIds,
      req.auth!.campaignId,
    );
    await audited(req, "BULK_DELETE_EVENTS", "event_days", "batch", {
      eventIds,
      ...result,
    });
    res.json(result);
  },
  listQuestions: async (req: Request, res: Response) =>
    res.json(
      await adminRepository.listQuestions(
        typeof req.query.eventDayId === "string"
          ? req.query.eventDayId
          : undefined,
        true,
      ),
    ),
  getQuestion: async (req: Request, res: Response) =>
    res.json(await adminRepository.getQuestion(idOf(req))),
  createQuestion: async (req: Request, res: Response) => {
    const id = await adminRepository.saveQuestion(undefined, req.body);
    const item = await adminRepository.getQuestion(id);
    await audited(req, "CREATE_QUESTION", "questions", id, item);
    res.status(201).json(item);
  },
  updateQuestion: async (req: Request, res: Response) => {
    const id = await adminRepository.saveQuestion(idOf(req), req.body);
    const item = await adminRepository.getQuestion(id);
    await audited(req, "UPDATE_QUESTION", "questions", id, item);
    res.json(item);
  },
  deleteQuestion: async (req: Request, res: Response) => {
    const id = idOf(req);
    await adminRepository.deleteQuestion(id);
    await audited(req, "DELETE_QUESTION", "questions", id);
    res.status(204).send();
  },
  getSettings: async (req: Request, res: Response) =>
    res.json(await adminRepository.getSettings(req.auth!.campaignId)),
  updateSettings: async (req: Request, res: Response) => {
    const item = await adminRepository.updateSettings(
      req.auth!.campaignId,
      req.body,
    );
    await audited(
      req,
      "UPDATE_SETTINGS",
      "campaign_settings",
      req.auth!.campaignId,
      req.body,
    );
    res.json(item);
  },
  getRegulation: async (req: Request, res: Response) =>
    res.json(
      await adminRepository.getRegulation(
        req.auth!.campaignId,
        typeof req.query.version === "string" ? req.query.version : undefined,
      ),
    ),
  saveRegulation: async (req: Request, res: Response) => {
    const item = await adminRepository.saveRegulation(
      req.auth!.campaignId,
      req.auth!.id,
      req.body,
    );
    await audited(
      req,
      "SAVE_REGULATION",
      "regulations",
      req.body.version,
      item,
    );
    res.json(item);
  },
  audit: async (req: Request, res: Response) =>
    res.json(
      await auditRepository.listAudit(
        req.auth!.organizationId,
        Number(req.query.limit ?? 100),
      ),
    ),
  accessLogs: async (req: Request, res: Response) =>
    res.json(
      await auditRepository.listAccess(
        req.auth!.organizationId,
        Number(req.query.limit ?? 100),
      ),
    ),
};
