"use client";

import { useState } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";
import type { ReminderEntityType } from "@projectflow/shared";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useReminders, useCreateReminder, useDeleteReminder } from "@/hooks/useReminders";
import { ReminderForm } from "./ReminderForm";
import { formatDateTime } from "@/lib/utils";

export function ReminderPanel({ entityType, entityId }: { entityType: ReminderEntityType; entityId: string }) {
  const { data: reminders, isLoading, isError, error, refetch } = useReminders(entityType, entityId);
  const createReminder = useCreateReminder(entityType, entityId);
  const deleteReminder = useDeleteReminder(entityType, entityId);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          <Bell size={14} /> Reminders
        </h4>
        {!formOpen && (
          <Button size="sm" variant="ghost" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Add reminder
          </Button>
        )}
      </div>

      {isLoading && <PageSpinner label="Loading reminders…" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {reminders && reminders.length === 0 && !formOpen && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No reminders set.</p>
      )}

      {reminders && reminders.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {reminders.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
            >
              <div className="min-w-0">
                <p className="text-sm text-zinc-700 dark:text-zinc-200">
                  {r.type.replace("_", " ").toLowerCase()}
                  {r.scheduledAt && <> · {formatDateTime(r.scheduledAt)}</>}
                  {r.offsetBeforeDueMinutes && <> · {r.offsetBeforeDueMinutes}m before due</>}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.channels.map((c) => (
                    <Badge key={c}>{c.replace("_", " ").toLowerCase()}</Badge>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteReminder.mutate(r.id)}
                disabled={deleteReminder.isPending}
                aria-label="Delete reminder"
                className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <ReminderForm
          entityType={entityType}
          entityId={entityId}
          submitting={createReminder.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={(data) =>
            createReminder.mutate(data, {
              onSuccess: () => setFormOpen(false),
            })
          }
        />
      )}
      {createReminder.isError && <ErrorState error={createReminder.error} title="Couldn't save reminder" />}
    </div>
  );
}
