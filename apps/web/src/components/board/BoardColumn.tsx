"use client";

import { useDroppable } from "@dnd-kit/core";
import type { BoardTask, TaskStatus } from "@projectflow/shared";
import { cn } from "@/lib/utils";
import { BoardCard } from "./BoardCard";

export function BoardColumn({
  status,
  label,
  tasks,
}: {
  status: TaskStatus;
  label: string;
  tasks: BoardTask[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</h3>
        <span className="text-xs text-zinc-400">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-2 rounded-xl border-2 border-dashed border-transparent bg-zinc-50/60 p-2 dark:bg-zinc-900/40",
          isOver && "border-accent-400 bg-accent-50/50 dark:bg-accent-900/10"
        )}
      >
        {tasks.map((task) => (
          <BoardCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-zinc-400">No tasks</p>
        )}
      </div>
    </div>
  );
}
