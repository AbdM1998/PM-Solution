"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import type { BoardTask } from "@projectflow/shared";
import { PriorityBadge } from "@/components/ui/Badge";
import { cn, formatDateTime, isPast } from "@/lib/utils";

export function BoardCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
  });

  const overdue = task.dueDate && task.status !== "DONE" && isPast(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab touch-none rounded-lg border border-zinc-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-900",
        isDragging && "z-10 opacity-60 shadow-md"
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: task.projectColor ?? "#a1a1aa" }}
        />
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{task.projectName}</span>
      </div>

      <Link
        href={`/projects/${task.projectId}`}
        className="block text-sm font-medium text-zinc-800 hover:underline dark:text-zinc-100"
        // Dragging shouldn't also navigate — only a real click (no pointer movement) does.
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        {task.title}
      </Link>

      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cn("text-xs", overdue ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400")}>
            {formatDateTime(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
