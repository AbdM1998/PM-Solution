"use client";

import { useMemo } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { BoardTask, TaskStatus } from "@projectflow/shared";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { useBoardTasks, useUpdateTaskStatus } from "@/hooks/useBoard";
import { BoardColumn } from "./BoardColumn";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
  { status: "CANCELLED", label: "Cancelled" },
];

export function ProjectBoard() {
  const { data: tasks, isLoading, isError, error, refetch } = useBoardTasks();
  const updateStatus = useUpdateTaskStatus();

  // A small drag threshold so clicking a card's title link (BoardCard) still works
  // as a plain click instead of always starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, BoardTask[]> = { TODO: [], IN_PROGRESS: [], DONE: [], CANCELLED: [] };
    for (const t of tasks ?? []) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const fromStatus = active.data.current?.status as TaskStatus | undefined;
    if (!newStatus || newStatus === fromStatus) return;
    updateStatus.mutate({ id: active.id as string, status: newStatus });
  }

  if (isLoading) return <PageSpinner label="Loading board…" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if ((tasks ?? []).length === 0) {
    return <EmptyState title="No tasks yet" description="Tasks you create in any project will show up here." />;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <BoardColumn key={col.status} status={col.status} label={col.label} tasks={byStatus[col.status]} />
        ))}
      </div>
    </DndContext>
  );
}
