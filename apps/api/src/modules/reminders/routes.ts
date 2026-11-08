import { Router } from "express";
import { z } from "zod";
import {
  CreateReminderInput,
  SnoozeOccurrenceInput,
  ReminderEntityTypeEnum,
  ReminderTypeEnum,
  ReminderChannelEnum,
} from "@projectflow/shared";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody, validateQuery } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import * as remindersService from "./service";

export const remindersRouter = Router();
remindersRouter.use(requireAuth);

const ListRemindersQuery = z.object({ entityType: ReminderEntityTypeEnum, entityId: z.string() });

remindersRouter.get(
  "/",
  validateQuery(ListRemindersQuery),
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.query as unknown as z.infer<typeof ListRemindersQuery>;
    const reminders = await remindersService.listReminders(req.user!.id, entityType, entityId);
    res.json(reminders);
  })
);

remindersRouter.post(
  "/",
  validateBody(CreateReminderInput),
  asyncHandler(async (req, res) => {
    const reminder = await remindersService.createReminder(req.user!.id, req.body);
    res.status(201).json(reminder);
  })
);

// Not CreateReminderInput.partial() — that schema is a ZodEffects (post-.refine()),
// which has no .partial(). Rebuilt by hand with the same optional fields instead.
const UpdateReminderInput = z.object({
  type: ReminderTypeEnum.optional(),
  scheduledAt: z.string().datetime().optional(),
  recurrenceRule: z.string().optional(),
  offsetBeforeDueMinutes: z.number().int().positive().optional(),
  channels: z.array(ReminderChannelEnum).min(1).optional(),
  isActive: z.boolean().optional(),
});
remindersRouter.patch(
  "/:id",
  validateBody(UpdateReminderInput),
  asyncHandler(async (req, res) => {
    const reminder = await remindersService.updateReminder(req.user!.id, req.params.id, req.body);
    res.json(reminder);
  })
);

remindersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await remindersService.deleteReminder(req.user!.id, req.params.id);
    res.status(204).send();
  })
);

const OccurrencesQuery = z.object({ status: z.string().optional(), from: z.string().optional(), to: z.string().optional() });
remindersRouter.get(
  "/occurrences",
  validateQuery(OccurrencesQuery),
  asyncHandler(async (req, res) => {
    const occurrences = await remindersService.listOccurrences(
      req.user!.id,
      req.query as unknown as z.infer<typeof OccurrencesQuery>
    );
    res.json(occurrences);
  })
);

// Mounted at /api/occurrences
export const occurrencesRouter = Router();
occurrencesRouter.use(requireAuth);

occurrencesRouter.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    const occurrence = await remindersService.completeOccurrence(req.user!.id, req.params.id);
    res.json(occurrence);
  })
);

occurrencesRouter.post(
  "/:id/snooze",
  validateBody(SnoozeOccurrenceInput),
  asyncHandler(async (req, res) => {
    const occurrence = await remindersService.snoozeOccurrence(req.user!.id, req.params.id, req.body);
    res.json(occurrence);
  })
);
