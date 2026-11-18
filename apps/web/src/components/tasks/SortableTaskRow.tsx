"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, ChevronRight, GripVertical, Pencil, Trash2 } from "lucide-react";
import type { Task } from "@projectflow/shared";
import { Badge, PriorityBadge, TaskStatusBadge } from "@/components/ui/Badge";
import { ChecklistTree } from "@/components/checklist/ChecklistTree";
import { ReminderPanel } from "@/components/reminders/ReminderPanel";
import { cn, formatDateTime, isPast } from "@/lib/utils";

export function SortableTaskRow({
  task,
  selected,
  onSelectChange,
  onToggleComplete,
  onEdit,
  onDelete,
  toggling,
  deleting,
  stageName,
}: {
  stageName?: string;
  task: Task;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  toggling?: boolean;
  deleting?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const isDone = task.status === "DONE";
  const overdue = task.dueDate && !isDone && isPast(task.dueDate);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group", isDragging && "z-10 bg-white shadow-md dark:bg-zinc-800")}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="shrink-0 cursor-grab touch-none text-zinc-300 hover:text-zinc-500 dark:text-zinc-600"
        >
          <GripVertical size={15} />
        </button>

        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelectChange(e.target.checked)}
          aria-label="Select task"
          className="shrink-0"
        />

        <button
          type="button"
          onClick={onToggleComplete}
          disabled={toggling}
          aria-label={isDone ? "Mark as to do" : "Mark complete"}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-transparent disabled:opacity-50",
            isDone
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-300 hover:border-accent-500 hover:text-accent-500 dark:border-zinc-600"
          )}
        >
          <Check size={12} strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 text-zinc-400" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-zinc-400" />
          )}
          <span
            className={cn(
              "truncate text-sm font-medium text-zinc-800 dark:text-zinc-100",
              isDone && "text-zinc-400 line-through dark:text-zinc-500"
            )}
          >
            {task.title}
          </span>
        </button>

        {stageName && (
          <Badge tone="accent" className="hidden max-w-[9rem] truncate sm:inline-flex">
            {stageName}
          </Badge>
        )}
        <TaskStatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cn("shrink-0 text-xs", overdue ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400")}>
            {formatDateTime(task.dueDate)}
          </span>
        )}

        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit task"
          className="shrink-0 rounded p-1 text-zinc-300 opacity-0 hover:text-accent-600 group-hover:opacity-100 dark:text-zinc-600"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete task"
          className="shrink-0 rounded p-1 text-zinc-300 opacity-0 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 dark:text-zinc-600"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="mx-3 mb-3 space-y-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
          {task.description && <p className="text-sm text-zinc-600 dark:text-zinc-300">{task.description}</p>}
          <ChecklistTree taskId={task.id} />
          <ReminderPanel entityType="TASK" entityId={task.id} />
        </div>
      )}
    </li>
  );
}
