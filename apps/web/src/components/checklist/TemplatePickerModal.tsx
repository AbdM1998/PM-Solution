"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import {
  useChecklistTemplates,
  useCreateChecklistTemplate,
  useApplyChecklistTemplate,
} from "@/hooks/useChecklist";

export function TemplatePickerModal({
  open,
  onClose,
  taskId,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
}) {
  const { data: templates, isLoading, isError, error, refetch } = useChecklistTemplates();
  const apply = useApplyChecklistTemplate(taskId);
  const createTemplate = useCreateChecklistTemplate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [itemsText, setItemsText] = useState("");

  function submitNewTemplate(e: React.FormEvent) {
    e.preventDefault();
    const titles = itemsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!name.trim() || titles.length === 0) return;
    createTemplate.mutate(
      {
        name: name.trim(),
        items: titles.map((title, i) => ({ title, orderIndex: i })),
      },
      {
        onSuccess: () => {
          setName("");
          setItemsText("");
          setCreating(false);
        },
      }
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Apply a checklist template">
      {isLoading && <PageSpinner label="Loading templates…" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {templates && templates.length === 0 && !creating && (
        <EmptyState title="No templates yet" description="Create one below to reuse it across tasks." />
      )}

      {templates && templates.length > 0 && (
        <ul className="mb-4 max-h-64 space-y-1.5 overflow-y-auto">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{t.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.items.length} item(s)</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={apply.isPending}
                onClick={() => apply.mutate(t.id, { onSuccess: onClose })}
              >
                Apply
              </Button>
            </li>
          ))}
        </ul>
      )}

      {apply.isError && <ErrorState error={apply.error} title="Couldn't apply template" />}

      {!creating ? (
        <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
          + Create a new template
        </Button>
      ) : (
        <form onSubmit={submitNewTemplate} className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div>
            <Label htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client onboarding" />
          </div>
          <div>
            <Label htmlFor="tpl-items">Items (one per line)</Label>
            <Textarea
              id="tpl-items"
              rows={4}
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder={"Send welcome email\nSchedule kickoff call\nShare project brief"}
            />
          </div>
          {createTemplate.isError && <ErrorState error={createTemplate.error} title="Couldn't save template" />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createTemplate.isPending}>
              {createTemplate.isPending ? "Saving…" : "Save template"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
