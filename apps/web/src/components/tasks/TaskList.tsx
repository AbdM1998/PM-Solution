"use client";

import { useMemo, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CheckCheck, Plus, X } from "lucide-react";
import type { Task } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InlineAdd } from "@/components/ui/InlineAdd";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useBulkCompleteTasks,
  useReorderTasks,
} from "@/hooks/useTasks";
import { useStages } from "@/hooks/useStages";
import { cn, errorMessage } from "@/lib/utils";
import { SortableTaskRow } from "./SortableTaskRow";
import { TaskForm } from "./TaskForm";

const ALL = "__all";
const NONE = "__none";

export function TaskList({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useTasks(projectId);
  const { data: stages = [] } = useStages(projectId);
  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const bulkComplete = useBulkCompleteTasks(projectId);
  const reorderTasks = useReorderTasks(projectId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [actionError, setActionError] = useState<unknown>(null);

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const activeStage = stages.find((s) => s.state === "ACTIVE");

  const allTasks = useMemo(() => (data?.items ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex), [data]);
  const tasks = useMemo(() => {
    if (stageFilter === ALL) return allTasks;
    if (stageFilter === NONE) return allTasks.filter((t) => !t.stageId);
    return allTasks.filter((t) => t.stageId === stageFilter);
  }, [allTasks, stageFilter]);

  // New tasks land in the stage being viewed (if it's still open), else the active one.
  const filteredStage = stageById.get(stageFilter);
  const newTaskStageId =
    filteredStage && filteredStage.state !== "COMPLETED" ? filteredStage.id : stageFilter === NONE ? undefined : activeStage?.id;

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleToggleComplete(task: Task) {
    setTogglingId(task.id);
    setActionError(null);
    updateTask.mutate(
      { id: task.id, data: { status: task.status === "DONE" ? "TODO" : "DONE" } },
      { onSettled: () => setTogglingId(undefined), onError: setActionError }
    );
  }

  function handleDelete(task: Task) {
    setDeletingId(task.id);
    deleteTask.mutate(task.id, { onSettled: () => setDeletingId(undefined), onError: setActionError });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = allTasks.findIndex((t) => t.id === active.id);
    const newIndex = allTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(allTasks, oldIndex, newIndex);
    reorderTasks.mutate(reordered.map((t, idx) => ({ taskId: t.id, newIndex: idx })));
  }

  if (isLoading) return <PageSpinner label="Loading tasks…" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const chip = (id: string, label: string, count: number, tone?: "done" | "active") => (
    <button
      key={id}
      type="button"
      onClick={() => setStageFilter(id)}
      className={cn(
        "whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        stageFilter === id
          ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
        tone === "done" && stageFilter !== id && "text-emerald-700 dark:text-emerald-400"
      )}
    >
      {label} <span className="text-zinc-400">{count}</span>
      {tone === "active" && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-500 align-middle" />}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Tasks {allTasks.length > 0 && <span className="text-zinc-400">({allTasks.length})</span>}
        </h3>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={bulkComplete.isPending}
              onClick={() => {
                setActionError(null);
                bulkComplete.mutate(Array.from(selected), {
                  onSuccess: () => setSelected(new Set()),
                  onError: setActionError,
                });
              }}
            >
              <CheckCheck size={14} /> Complete {selected.size} selected
            </Button>
          )}
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> New task
          </Button>
        </div>
      </div>

      {stages.length > 0 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {chip(ALL, "All", allTasks.length)}
          {stages.map((s) =>
            chip(
              s.id,
              s.name,
              allTasks.filter((t) => t.stageId === s.id).length,
              s.state === "COMPLETED" ? "done" : s.state === "ACTIVE" ? "active" : undefined
            )
          )}
          {allTasks.some((t) => !t.stageId) && chip(NONE, "No stage", allTasks.filter((t) => !t.stageId).length)}
        </div>
      )}

      {actionError ? (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <span>{errorMessage(actionError)}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setActionError(null)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState
          title={stageFilter === ALL ? "No tasks yet" : "No tasks in this stage"}
          description={
            filteredStage?.state === "COMPLETED"
              ? "This stage is completed."
              : "Add a task below or with “New task”."
          }
          action={
            filteredStage?.state === "COMPLETED" ? undefined : (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus size={14} /> New task
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    stageName={stageFilter === ALL && task.stageId ? stageById.get(task.stageId)?.name : undefined}
                    selected={selected.has(task.id)}
                    onSelectChange={(checked) => toggleSelect(task.id, checked)}
                    onToggleComplete={() => handleToggleComplete(task)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => handleDelete(task)}
                    toggling={togglingId === task.id}
                    deleting={deletingId === task.id}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {filteredStage?.state !== "COMPLETED" && (
            <div className="border-t border-zinc-100 px-3 py-1 dark:border-zinc-800">
              <InlineAdd
                placeholder={
                  newTaskStageId ? `Add a task to “${stageById.get(newTaskStageId)?.name}”…` : "Add a task…"
                }
                pending={createTask.isPending}
                onAdd={(title) => {
                  setActionError(null);
                  createTask.mutate({ title, stageId: newTaskStageId }, { onError: setActionError });
                }}
              />
            </div>
          )}
        </Card>
      )}

      {formOpen && (
        <TaskForm
          open
          stages={stages}
          defaultStageId={newTaskStageId}
          onClose={() => setFormOpen(false)}
          submitting={createTask.isPending}
          submitError={createTask.error}
          onSubmit={(payload) => createTask.mutate(payload, { onSuccess: () => setFormOpen(false) })}
        />
      )}

      {editingTask && (
        <TaskForm
          open
          task={editingTask}
          stages={stages}
          onClose={() => setEditingTask(null)}
          submitting={updateTask.isPending}
          submitError={updateTask.error}
          onSubmit={(payload) =>
            updateTask.mutate(
              { id: editingTask.id, data: payload },
              { onSuccess: () => setEditingTask(null) }
            )
          }
        />
      )}
    </div>
  );
}
