import { z } from "zod";
import {
  cleanText,
  optionalText,
  optionalUrl,
  safeUrl,
} from "../../shared/schemas.js";

const boolean = z.boolean();
const slug = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9-]+$/);
const isoDate = z.string().datetime({ offset: true });

export const userCreate = z
  .object({
    employeeNumber: cleanText(64),
    email: z.string().email().max(254).toLowerCase(),
    firstName: cleanText(100),
    lastName: cleanText(100),
    displayName: cleanText(200),
    description: optionalText(5000),
    role: z.enum(["admin", "collaborator"]).default("collaborator"),
    unitId: z.string().uuid().optional().nullable(),
    company: optionalText(180),
    adminComment: optionalText(5000),
    mustChangePassword: boolean.default(true),
    active: boolean.default(true),
    temporaryPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Za-zÀ-ÿ]/)
      .regex(/\d/),
  })
  .strict();
export const userUpdate = userCreate
  .omit({ temporaryPassword: true })
  .partial()
  .strict()
  .extend({
    temporaryPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Za-zÀ-ÿ]/)
      .regex(/\d/)
      .optional(),
  });

export const unitCreate = z
  .object({
    name: cleanText(150),
    slug,
    active: boolean.default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export const unitUpdate = unitCreate.partial().strict();

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Data inválida.");

export const eventDateCreate = z
  .object({
    name: cleanText(150),
    eventDate: calendarDate,
    dateLabel: cleanText(150),
    description: optionalText(500),
    active: boolean.default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export const eventDateUpdate = eventDateCreate.partial().strict();

const speaker = z
  .object({
    id: z.string().uuid().optional(),
    name: cleanText(180),
    imageUrl: optionalUrl,
    role: optionalText(255),
  })
  .strict();
const eventBase = z
  .object({
    eventDateId: z.string().uuid(),
    name: cleanText(150),
    slug,
    dateLabel: cleanText(150).optional(),
    parentId: z.string().uuid().optional().nullable(),
    attraction: optionalText(255),
    theme: optionalText(255),
    opensAt: isoDate,
    closesAt: isoDate,
    videoUrl: optionalUrl,
    videoStoragePath: optionalText(1024),
    videoEmbedUrl: optionalUrl,
    videoType: z.enum(["url", "attachment"]).optional().nullable(),
    videoAttachmentName: optionalText(255),
    cardCoverImageUrl: optionalUrl,
    bannerImageUrl: optionalUrl,
    attendanceCode: z.string().trim().min(4).max(64).optional(),
    speakers: z.array(speaker).max(20).default([]),
    unitVideoOverrides: z.record(z.string().uuid(), safeUrl).default({}),
    active: boolean.default(true),
    countsForFullWeek: boolean.default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();

export const eventCreate = eventBase
  .refine((data) => new Date(data.closesAt) > new Date(data.opensAt), {
    path: ["closesAt"],
    message: "Encerramento deve ser posterior à abertura.",
  });
export const eventUpdate = eventBase
  .partial()
  .strict()
  .refine(
    (data) =>
      !data.opensAt ||
      !data.closesAt ||
      new Date(data.closesAt) > new Date(data.opensAt),
    { path: ["closesAt"], message: "Janela inválida." },
  );

export const selectedUsers = z
  .object({
    userIds: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict();

export const selectedEvents = z
  .object({
    eventIds: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict();

export const resetUserParticipations = selectedUsers.extend({
  eventDayId: z.string().uuid().optional(),
});

const alternative = z
  .object({
    id: z.string().uuid().optional(),
    text: cleanText(5000),
    isCorrect: boolean.optional(),
    ratingValue: z.number().int().min(1).max(10).optional().nullable(),
  })
  .strict();
const questionBase = z
  .object({
    eventDayId: z.string().uuid(),
    title: cleanText(5000),
    type: z.enum(["single_choice", "free_text", "rating"]),
    required: boolean.default(true),
    scored: boolean.default(true),
    suggestionPrompt: optionalText(500),
    sortOrder: z.number().int().min(0).default(0),
    active: boolean.default(true),
    alternatives: z.array(alternative).max(20).default([]),
  })
  .strict();

function validateScoredQuestion(
  value: {
    type?: "single_choice" | "free_text" | "rating";
    scored?: boolean;
    alternatives?: Array<{ isCorrect?: boolean }>;
  },
  ctx: z.RefinementCtx,
) {
    if (value.scored && value.type !== "single_choice")
      ctx.addIssue({
        code: "custom",
        path: ["scored"],
        message: "Somente escolha única pode ser pontuada.",
      });
    if (
      value.scored &&
      (value.alternatives?.filter((a) => a.isCorrect).length ?? 0) !== 1
    )
      ctx.addIssue({
        code: "custom",
        path: ["alternatives"],
        message: "Pergunta pontuada exige exatamente uma resposta correta.",
      });
}

export const questionCreate = questionBase.superRefine(validateScoredQuestion);
export const questionUpdate = questionBase
  .partial()
  .strict()
  .superRefine((value, ctx) => {
    if (value.scored === true && value.type)
      validateScoredQuestion(value, ctx);
    else if (
      value.scored === true &&
      value.alternatives &&
      value.alternatives.filter((alternative) => alternative.isCorrect)
        .length !== 1
    )
      ctx.addIssue({
        code: "custom",
        path: ["alternatives"],
        message: "Pergunta pontuada exige exatamente uma resposta correta.",
      });
  });

export const settingsUpdate = z
  .object({
    eventName: cleanText(180).optional(),
    eventYear: z.number().int().min(2000).max(2200).optional(),
    primaryLogoUrl: optionalUrl,
    desktopBannerUrl: optionalUrl,
    mobileBannerUrl: optionalUrl,
    customLinks: z
      .array(
        z.object({
          label: cleanText(120),
          url: safeUrl,
          openInNewTab: boolean.optional(),
        }),
      )
      .max(20)
      .optional(),
    videoCompletionThresholdPercent: z.number().min(0).max(100).optional(),
    showCorrectAnswersAfterSubmit: boolean.optional(),
    maskEmployeeNumberInWinners: boolean.optional(),
    initialPasswordHelpText: optionalText(500),
    privacyPolicyUrl: optionalUrl,
    brandName: optionalText(180),
    brandSubtitle: optionalText(255),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    primaryDarkColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    actionColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    loginTitle: optionalText(180),
    loginSubtitle: optionalText(500),
    loginBadgeText: optionalText(120),
    homeHeadline: optionalText(180),
    homeDescription: optionalText(5000),
    regulationTitle: optionalText(180),
    supportContact: optionalText(255),
  })
  .strict();
export const regulationSave = z
  .object({
    version: cleanText(40),
    title: cleanText(255),
    contentHtml: z.string().min(1).max(500000),
    pdfUrl: optionalUrl,
    published: boolean,
    effectiveFrom: isoDate,
  })
  .strict();

export const idList = z
  .object({ ids: z.array(z.string().uuid()).min(1).max(1000) })
  .strict();

export const clientAuditEvent = z
  .object({
    action: z.enum(["BATCH_USER_IMPORT", "BULK_DEACTIVATE_USERS"]),
    entityId: z.string().trim().min(1).max(255),
    afterData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine(
    (value) => JSON.stringify(value.afterData ?? {}).length <= 20_000,
    { path: ["afterData"], message: "Dados de auditoria muito extensos." },
  );
