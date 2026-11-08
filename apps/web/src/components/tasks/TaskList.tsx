"use client";

import { useMemo, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CheckCheck, Plus } from "lucide-react";
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
import { SortableTaskRow } from "./SortableTaskRow";
import { TaskForm } from "./TaskForm";

export function TaskList({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useTasks(projectId);
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

  const tasks = useMemo(() => (data?.items ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex), [data]);

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
    updateTask.mutate(
      { id: task.id, data: { status: task.status === "DONE" ? "TODO" : "DONE" } },
      { onSettled: () => setTogglingId(undefined) }
    );
  }

  function handleDelete(task: Task) {
    setDeletingId(task.id);
    deleteTask.mutate(task.id, { onSettled: () => setDeletingId(undefined) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    reorderTasks.mutate(reordered.map((t, idx) => ({ taskId: t.id, newIndex: idx })));
  }

  if (isLoading) return <PageSpinner label="Loading tasks…" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Tasks {tasks.length > 0 && <span className="text-zinc-400">({tasks.length})</span>}
        </h3>
        {selected.size > 0 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={bulkComplete.isPending}
            onClick={() =>
              bulkComplete.mutate(Array.from(selected), {
                onSuccess: () => setSelected(new Set()),
              })
            }
          >
            <CheckCheck size={14} /> Complete {selected.size} selected
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add your first task below."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus size={14} /> New task
            </Button>
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
          <div className="border-t border-zinc-100 px-3 py-1 dark:border-zinc-800">
            <InlineAdd
              placeholder="Add a task…"
              pending={createTask.isPending}
              onAdd={(title) => createTask.mutate({ title })}
            />
          </div>
        </Card>
      )}

      <TaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        submitting={createTask.isPending}
        submitError={createTask.error}
        onSubmit={(payload) => createTask.mutate(payload, { onSuccess: () => setFormOpen(false) })}
      />

      {editingTask && (
        <TaskForm
          open
          task={editingTask}
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
