import { z } from "zod";

export const ProjectStatusEnum = z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]);
export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const TaskStatusEnum = z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
export const ChecklistStatusEnum = z.enum(["PENDING", "COMPLETED"]);
export const ReminderEntityTypeEnum = z.enum(["PROJECT", "TASK", "CHECKLIST_ITEM"]);
export const ReminderTypeEnum = z.enum(["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]);
export const ReminderChannelEnum = z.enum(["IN_APP", "EMAIL", "WHATSAPP", "PUSH", "BROWSER_PUSH"]);
export const SnoozeOptionEnum = z.enum(["5m", "10m", "30m", "1h", "later_today", "tomorrow", "next_week", "custom"]);

export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime(),
  targetEndDate: z.string().datetime().optional(),
  status: ProjectStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  color: z.string().max(20).optional(),
  notes: z.string().max(5000).optional(),
  tagIds: z.array(z.string()).optional(),
});
export const UpdateProjectInput = CreateProjectInput.partial().extend({
  actualEndDate: z.string().datetime().nullable().optional(),
});

export const CreateTaskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: PriorityEnum.optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  assignedUserId: z.string().optional(),
  notes: z.string().max(5000).optional(),
  // Lifecycle stage this task belongs to (null = not tied to any stage).
  stageId: z.string().nullable().optional(),
});
export const UpdateTaskInput = CreateTaskInput.partial().extend({
  status: TaskStatusEnum.optional(),
});

// ---------- Project lifecycle (stages) ----------
export const CreateStageInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});
export const UpdateStageInput = CreateStageInput.partial();
export const ReorderStagesInput = z.array(z.object({ stageId: z.string(), newIndex: z.number().int().min(0) }));
export const StagePresetEnum = z.enum(["standard", "software", "construction"]);
export const ApplyStagePresetInput = z.object({ preset: StagePresetEnum });

// ---------- Admin ----------
const WhatsappNumber = z
  .string()
  .regex(/^\+?[0-9]{8,15}$/, "Use international format, digits only (e.g. 9627XXXXXXXX)");

export const AdminCreateUserInput = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  isAdmin: z.boolean().optional(),
  whatsappNumber: WhatsappNumber.optional(),
});
export const AdminUpdateUserInput = z.object({
  name: z.string().min(1).max(120).optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  whatsappNumber: WhatsappNumber.nullable().optional(),
  password: z.string().min(8).optional(),
});
export const AdminTestNotificationInput = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  to: z.string().min(3).max(200),
});

export const CreateChecklistItemInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  parentId: z.string().optional(),
  priority: PriorityEnum.optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
});
export const UpdateChecklistItemInput = CreateChecklistItemInput.partial().extend({
  status: ChecklistStatusEnum.optional(),
  orderIndex: z.number().int().optional(),
});

export const CreateReminderInput = z.object({
  entityType: ReminderEntityTypeEnum,
  entityId: z.string(),
  type: ReminderTypeEnum,
  scheduledAt: z.string().datetime().optional(),
  recurrenceRule: z.string().optional(),
  offsetBeforeDueMinutes: z.number().int().positive().optional(),
  channels: z.array(ReminderChannelEnum).min(1),
  // Optional per-reminder override of where EMAIL/WHATSAPP delivery goes, instead of
  // always using the account's own email (WhatsApp has no account-level number to
  // fall back to at all). Left out / undefined means "use the account default".
  targetEmail: z.string().email().optional(),
  targetWhatsappNumber: z.string().min(5).max(20).optional(),
}).refine(
  (v) => (v.type === "ONE_TIME" ? !!v.scheduledAt || !!v.offsetBeforeDueMinutes : true),
  { message: "ONE_TIME reminders need scheduledAt or offsetBeforeDueMinutes" }
);

export const SnoozeOccurrenceInput = z.object({
  option: SnoozeOptionEnum,
  customAt: z.string().datetime().optional(),
}).refine((v) => (v.option === "custom" ? !!v.customAt : true), {
  message: "custom snooze needs customAt",
});

export const CreateChecklistTemplateInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  items: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    orderIndex: z.number().int(),
    defaultPriority: PriorityEnum.optional(),
  })).min(1),
});

export const CreateEmailThreadInput = z.object({
  subject: z.string().min(1).max(300),
  conversationId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

// Inferred TS types for every input schema above, added by the API team (apps/api)
// because this file previously exported only the runtime Zod schemas (needed for
// validation middleware) with no corresponding TS types (needed for service-layer
// function signatures). A `const X = z.object(...)` value and a `type X = z.infer<...>`
// type of the same name coexist in TS (value-space vs type-space), so this is purely
// additive — no existing export is renamed or removed.
export type RegisterInput = z.infer<typeof RegisterInput>;
export type LoginInput = z.infer<typeof LoginInput>;
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;
export type CreateChecklistItemInput = z.infer<typeof CreateChecklistItemInput>;
export type UpdateChecklistItemInput = z.infer<typeof UpdateChecklistItemInput>;
export type CreateReminderInput = z.infer<typeof CreateReminderInput>;
export type SnoozeOccurrenceInput = z.infer<typeof SnoozeOccurrenceInput>;
export type CreateChecklistTemplateInput = z.infer<typeof CreateChecklistTemplateInput>;
export type CreateEmailThreadInput = z.infer<typeof CreateEmailThreadInput>;
export type CreateStageInput = z.infer<typeof CreateStageInput>;
export type UpdateStageInput = z.infer<typeof UpdateStageInput>;
export type StagePreset = z.infer<typeof StagePresetEnum>;
export type AdminCreateUserInput = z.infer<typeof AdminCreateUserInput>;
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserInput>;
export type AdminTestNotificationInput = z.infer<typeof AdminTestNotificationInput>;
