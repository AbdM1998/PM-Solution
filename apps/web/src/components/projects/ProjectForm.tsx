"use client";

import { useState } from "react";
import { CreateProjectInput, UpdateProjectInput, PriorityEnum, ProjectStatusEnum } from "@projectflow/shared";
import type { Project } from "@projectflow/shared";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Input";
import { TagPicker } from "./TagPicker";
import { errorMessage } from "@/lib/utils";

const COLOR_SWATCHES = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ProjectForm({
  open,
  onClose,
  project,
  onSubmit,
  submitting,
  submitError,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  submitError?: unknown;
}) {
  const isEdit = !!project;
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(project?.startDate) || toDateInputValue(new Date().toISOString()));
  const [targetEndDate, setTargetEndDate] = useState(toDateInputValue(project?.targetEndDate));
  const [status, setStatus] = useState(project?.status ?? "NOT_STARTED");
  const [priority, setPriority] = useState(project?.priority ?? "MEDIUM");
  const [color, setColor] = useState(project?.color ?? COLOR_SWATCHES[0]);
  const [notes, setNotes] = useState(project?.notes ?? "");
  const [tagIds, setTagIds] = useState<string[]>(project?.tags?.map((t) => t.id) ?? []);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: Record<string, unknown> = {
      name,
      description: description || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      targetEndDate: targetEndDate ? new Date(targetEndDate).toISOString() : undefined,
      status,
      priority,
      color,
      notes: notes || undefined,
      tagIds,
    };

    const schema = isEdit ? UpdateProjectInput : CreateProjectInput;
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit project" : "New project"} widthClassName="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="pf-name">Name</Label>
          <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Website redesign" />
          <FieldError>{fieldErrors.name}</FieldError>
        </div>

        <div>
          <Label htmlFor="pf-description">Description</Label>
          <Textarea
            id="pf-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
          />
          <FieldError>{fieldErrors.description}</FieldError>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pf-start">Start date</Label>
            <Input id="pf-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <FieldError>{fieldErrors.startDate}</FieldError>
          </div>
          <div>
            <Label htmlFor="pf-end">Target end date</Label>
            <Input id="pf-end" type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
            <FieldError>{fieldErrors.targetEndDate}</FieldError>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pf-status">Status</Label>
            <Select id="pf-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {ProjectStatusEnum.options.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pf-priority">Priority</Label>
            <Select id="pf-priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              {PriorityEnum.options.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Color</Label>
          <div className="flex gap-1.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full ring-offset-2 transition-shadow"
                style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
              />
            ))}
          </div>
        </div>

        <div>
          <Label>Tags</Label>
          <TagPicker selectedIds={tagIds} onChange={setTagIds} />
        </div>

        <div>
          <Label htmlFor="pf-notes">Notes</Label>
          <Textarea id="pf-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          <FieldError>{fieldErrors.notes}</FieldError>
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
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
