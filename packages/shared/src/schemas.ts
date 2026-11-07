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
});
export const UpdateTaskInput = CreateTaskInput.partial().extend({
  status: TaskStatusEnum.optional(),
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
