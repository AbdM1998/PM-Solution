"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Plus, Trash2 } from "lucide-react";
import type { ChecklistItem } from "@projectflow/shared";
import { PriorityBadge } from "@/components/ui/Badge";
import { InlineAdd } from "@/components/ui/InlineAdd";
import { cn, formatDate } from "@/lib/utils";

export function SortableChecklistItem({
  item,
  onToggle,
  onDelete,
  onAddChild,
  toggling,
  deleting,
  children,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onDelete: () => void;
  onAddChild: (title: string) => void;
  toggling?: boolean;
  deleting?: boolean;
  children?: React.ReactNode;
}) {
  const [addingChild, setAddingChild] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const isCompleted = item.status === "COMPLETED";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group rounded-md", isDragging && "z-10 bg-white shadow-md dark:bg-zinc-800")}
    >
      <div className="flex items-center gap-2 py-1">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="shrink-0 cursor-grab touch-none text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          <GripVertical size={14} />
        </button>

        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          aria-label={isCompleted ? "Mark pending" : "Mark complete"}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-transparent disabled:opacity-50",
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-300 hover:border-accent-500 hover:text-accent-500 dark:border-zinc-600"
          )}
        >
          <Check size={11} strokeWidth={3} />
        </button>

        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200",
            isCompleted && "text-zinc-400 line-through dark:text-zinc-500"
          )}
        >
          {item.title}
        </span>

        {item.priority !== "MEDIUM" && <PriorityBadge priority={item.priority} />}
        {item.dueDate && <span className="shrink-0 text-xs text-zinc-400">{formatDate(item.dueDate)}</span>}

        <button
          type="button"
          onClick={() => setAddingChild((v) => !v)}
          aria-label="Add sub-item"
          className="shrink-0 rounded p-1 text-zinc-300 opacity-0 hover:text-accent-600 group-hover:opacity-100 dark:text-zinc-600"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete item"
          className="shrink-0 rounded p-1 text-zinc-300 opacity-0 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 dark:text-zinc-600"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {addingChild && (
        <div className="ml-9 border-l border-zinc-200 pl-2 dark:border-zinc-700">
          <InlineAdd
            placeholder="Sub-item title"
            onAdd={(title) => {
              onAddChild(title);
              setAddingChild(false);
            }}
          />
        </div>
      )}

      {children}
    </li>
  );
}
