"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronRight, Lock, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import type { ProjectStage } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import {
  useAdvanceStage,
  useApplyStagePreset,
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/hooks/useStages";
import { cn, errorMessage, formatDate } from "@/lib/utils";

const PRESETS: { id: string; label: string; stages: string }[] = [
  { id: "standard", label: "Standard (PMI)", stages: "Initiation → Planning → Execution → Monitoring & Control → Closure" },
  { id: "software", label: "Software", stages: "Requirements → Design → Development → Testing → Deployment → Support" },
  { id: "construction", label: "Construction", stages: "Feasibility → Design & Permits → Procurement → Construction → Handover" },
];

function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
      {errorMessage(error)}
    </p>
  );
}

/** Compact horizontal stage bar shown at the top of the project page. */
export function LifecycleStepper({ projectId, onManage }: { projectId: string; onManage: () => void }) {
  const { data: stages, isLoading } = useStages(projectId);
  const advance = useAdvanceStage(projectId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return null;
  if (!stages || stages.length === 0) {
    return (
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <Workflow size={16} className="text-accent-600" />
          This project has no lifecycle yet. Define its stages so it can only move forward once each stage&apos;s tasks are done.
        </div>
        <Button size="sm" onClick={onManage}>
          <Plus size={14} /> Set up lifecycle
        </Button>
      </Card>
    );
  }

  const active = stages.find((s) => s.state === "ACTIVE");
  const allDone = !active;
  const openInActive = active ? active.taskCount - active.closedTaskCount : 0;
  const isLast = active ? stages[stages.length - 1].id === active.id : false;

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <Workflow size={16} className="text-accent-600" /> Lifecycle
          {allDone ? (
            <Badge tone="green">All stages completed</Badge>
          ) : (
            <Badge tone="blue">
              Stage {stages.findIndex((s) => s.id === active!.id) + 1} of {stages.length}: {active!.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onManage}>
            Manage stages
          </Button>
          {active && (
            <Button
              size="sm"
              disabled={advance.isPending || openInActive > 0}
              title={openInActive > 0 ? `${openInActive} task(s) in this stage are still open` : undefined}
              onClick={() => setConfirmOpen(true)}
            >
              {isLast ? "Complete project" : "Move to next stage"} <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </div>

      <ol className="flex gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => (
          <li key={s.id} className="min-w-[8.5rem] flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full",
                s.state === "COMPLETED" && "bg-emerald-500",
                s.state === "ACTIVE" && "bg-accent-500",
                s.state === "LOCKED" && "bg-zinc-200 dark:bg-zinc-700"
              )}
            />
            <div className="mt-2 flex items-start gap-1.5">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  s.state === "COMPLETED" && "bg-emerald-500 text-white",
                  s.state === "ACTIVE" && "bg-accent-600 text-white",
                  s.state === "LOCKED" && "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                )}
              >
                {s.state === "COMPLETED" ? <Check size={10} strokeWidth={3} /> : s.state === "LOCKED" ? <Lock size={9} /> : i + 1}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-xs font-medium",
                    s.state === "LOCKED" ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-100"
                  )}
                  title={s.name}
                >
                  {s.name}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {s.state === "COMPLETED" && s.completedAt
                    ? `Done ${formatDate(s.completedAt)}`
                    : `${s.closedTaskCount}/${s.taskCount} tasks done`}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {active && openInActive > 0 && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Finish the {openInActive} open task{openInActive === 1 ? "" : "s"} in &quot;{active.name}&quot; to unlock the next stage.
        </p>
      )}
      <ErrorNote error={advance.error} />

      <ConfirmDialog
        open={confirmOpen}
        title={isLast ? "Complete the project?" : `Complete "${active?.name}"?`}
        description={
          isLast
            ? "This completes the last stage and marks the whole project as Completed."
            : `"${active?.name}" will be locked as completed and the project moves to "${
                stages[stages.findIndex((s) => s.id === active?.id) + 1]?.name
              }". Completed stages can't be reopened.`
        }
        confirmLabel={isLast ? "Complete project" : "Move on"}
        pending={advance.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => advance.mutate(undefined, { onSettled: () => setConfirmOpen(false) })}
      />
    </Card>
  );
}

function StageFormModal({
  open,
  stage,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  open: boolean;
  stage?: ProjectStage;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => void;
  pending: boolean;
  error: unknown;
}) {
  const [name, setName] = useState(stage?.name ?? "");
  const [description, setDescription] = useState(stage?.description ?? "");
  return (
    <Modal open={open} onClose={onClose} title={stage ? "Edit stage" : "New stage"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSubmit({ name: name.trim(), description: description.trim() || undefined });
        }}
      >
        <div>
          <Label htmlFor="stage-name">Name</Label>
          <Input id="stage-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Planning" autoFocus />
        </div>
        <div>
          <Label htmlFor="stage-desc">Description</Label>
          <Textarea id="stage-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : stage ? "Save" : "Add stage"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Full stage management (the "Lifecycle" tab). */
export function LifecycleManager({ projectId }: { projectId: string }) {
  const { data: stages, isLoading } = useStages(projectId);
  const createStage = useCreateStage(projectId);
  const updateStage = useUpdateStage(projectId);
  const deleteStage = useDeleteStage(projectId);
  const reorder = useReorderStages(projectId);
  const applyPreset = useApplyStagePreset(projectId);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProjectStage | null>(null);
  const [deleting, setDeleting] = useState<ProjectStage | null>(null);

  if (isLoading) return <Spinner className="m-4" />;
  const list = stages ?? [];

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((s, i) => ({ stageId: s.id, newIndex: i })));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Each project has its own lifecycle. Assign tasks to a stage; the project can only move to the next stage
          when every task in the current one is done (or cancelled), and a task can only be closed once its checklist is
          complete.
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> Add stage
        </Button>
      </div>

      {list.length === 0 ? (
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">Start from a template</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={applyPreset.isPending}
                onClick={() => applyPreset.mutate(p.id)}
                className="rounded-lg border border-zinc-200 p-3 text-left hover:border-accent-400 hover:bg-accent-50/40 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-accent-900/20"
              >
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{p.label}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{p.stages}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">…or add your own stages one by one with “Add stage”.</p>
          <ErrorNote error={applyPreset.error} />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {list.map((s, i) => {
              const locked = s.state === "COMPLETED";
              const prevCompleted = i > 0 && list[i - 1].state === "COMPLETED";
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      s.state === "COMPLETED" && "bg-emerald-500 text-white",
                      s.state === "ACTIVE" && "bg-accent-600 text-white",
                      s.state === "LOCKED" && "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {s.state === "COMPLETED" ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{s.name}</p>
                      <Badge tone={s.state === "COMPLETED" ? "green" : s.state === "ACTIVE" ? "blue" : "neutral"}>
                        {s.state === "COMPLETED" ? "Completed" : s.state === "ACTIVE" ? "Active" : "Upcoming"}
                      </Badge>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {s.closedTaskCount}/{s.taskCount} tasks done
                      </span>
                    </div>
                    {s.description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{s.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Move up"
                      disabled={locked || i === 0 || prevCompleted || reorder.isPending}
                      onClick={() => move(i, -1)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={locked || i === list.length - 1 || reorder.isPending}
                      onClick={() => move(i, 1)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => setEditing(s)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-accent-600 dark:hover:bg-zinc-800"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title={locked ? "Completed stages can't be deleted" : "Delete stage"}
                      disabled={locked}
                      onClick={() => setDeleting(s)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <ErrorNote error={reorder.error ?? deleteStage.error} />

      {adding && (
        <StageFormModal
          open
          onClose={() => setAdding(false)}
          pending={createStage.isPending}
          error={createStage.error}
          onSubmit={(data) => createStage.mutate(data, { onSuccess: () => setAdding(false) })}
        />
      )}
      {editing && (
        <StageFormModal
          open
          stage={editing}
          onClose={() => setEditing(null)}
          pending={updateStage.isPending}
          error={updateStage.error}
          onSubmit={(data) => updateStage.mutate({ id: editing.id, data }, { onSuccess: () => setEditing(null) })}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete stage "${deleting?.name}"?`}
        description="Its tasks stay in the project but are no longer tied to a stage."
        confirmLabel="Delete stage"
        danger
        pending={deleteStage.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteStage.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
      />
    </div>
  );
}
