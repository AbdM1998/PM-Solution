"use client";

import { useState } from "react";
import { CreateReminderInput, ReminderChannelEnum, ReminderTypeEnum } from "@projectflow/shared";
import type { ReminderEntityType } from "@projectflow/shared";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { toDateTimeLocalValue } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  ONE_TIME: "One time",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
};

const CHANNEL_LABEL: Record<string, string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  PUSH: "Push",
  BROWSER_PUSH: "Browser push",
};

export function ReminderForm({
  entityType,
  entityId,
  onSubmit,
  onCancel,
  submitting,
}: {
  entityType: ReminderEntityType;
  entityId: string;
  onSubmit: (data: unknown) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [type, setType] = useState<string>("ONE_TIME");
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocalValue(new Date()));
  const [offsetMinutes, setOffsetMinutes] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [channels, setChannels] = useState<string[]>(["IN_APP"]);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {
      entityType,
      entityId,
      type,
      channels,
    };
    if (type === "ONE_TIME" && offsetMinutes) {
      payload.offsetBeforeDueMinutes = Number(offsetMinutes);
    } else if (scheduledAt) {
      payload.scheduledAt = new Date(scheduledAt).toISOString();
    }
    if (recurrenceRule) payload.recurrenceRule = recurrenceRule;

    const parsed = CreateReminderInput.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reminder.");
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div>
        <Label htmlFor="rem-type">Type</Label>
        <Select id="rem-type" value={type} onChange={(e) => setType(e.target.value)}>
          {ReminderTypeEnum.options.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      {type === "ONE_TIME" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rem-at">At specific time</Label>
            <Input
              id="rem-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={!!offsetMinutes}
            />
          </div>
          <div>
            <Label htmlFor="rem-offset">…or minutes before due</Label>
            <Input
              id="rem-offset"
              type="number"
              min={1}
              value={offsetMinutes}
              onChange={(e) => setOffsetMinutes(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rem-at">Starts at</Label>
            <Input id="rem-at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          {type === "CUSTOM" && (
            <div>
              <Label htmlFor="rem-rule">Recurrence rule</Label>
              <Input
                id="rem-rule"
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value)}
                placeholder="e.g. every weekday"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <Label>Channels</Label>
        <div className="flex flex-wrap gap-3">
          {ReminderChannelEnum.options.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChannel(c)} />
              {CHANNEL_LABEL[c]}
            </label>
          ))}
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : "Add reminder"}
        </Button>
      </div>
    </form>
  );
}
