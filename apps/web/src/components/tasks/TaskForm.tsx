"use client";

import { useState } from "react";
import { CreateTaskInput, UpdateTaskInput, PriorityEnum, TaskStatusEnum } from "@projectflow/shared";
import type { Task } from "@projectflow/shared";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Input";
import { errorMessage } from "@/lib/utils";

function toDateTimeInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskForm({
  open,
  onClose,
  task,
  onSubmit,
  submitting,
  submitError,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  submitError?: unknown;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(task?.status ?? "TODO");
  const [startDate, setStartDate] = useState(toDateTimeInputValue(task?.startDate));
  const [dueDate, setDueDate] = useState(toDateTimeInputValue(task?.dueDate));
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      title,
      description: description || undefined,
      priority,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      notes: notes || undefined,
    };
    if (isEdit) payload.status = status;

    const schema = isEdit ? UpdateTaskInput : CreateTaskInput;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0]) errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onSubmit(parsed.data);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit task" : "New task"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="tf-title">Title</Label>
          <Input id="tf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <FieldError>{fieldErrors.title}</FieldError>
        </div>
        <div>
          <Label htmlFor="tf-description">Description</Label>
          <Textarea id="tf-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="tf-start">Start</Label>
            <Input id="tf-start" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tf-due">Due</Label>
            <Input id="tf-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="tf-priority">Priority</Label>
            <Select id="tf-priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              {PriorityEnum.options.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          {isEdit && (
            <div>
              <Label htmlFor="tf-status">Status</Label>
              <Select id="tf-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {TaskStatusEnum.options.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="tf-notes">Notes</Label>
          <Textarea id="tf-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {submitError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {errorMessage(submitError)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
