import Link from "next/link";
import { Check, ClipboardCheck, FolderKanban, ListTodo } from "lucide-react";
import type { MyDayItem, SnoozeOption } from "@projectflow/shared";
import { SnoozeMenu } from "@/components/reminders/SnoozeMenu";
import { formatTime, cn } from "@/lib/utils";

const ENTITY_ICON = {
  PROJECT: FolderKanban,
  TASK: ListTodo,
  CHECKLIST_ITEM: ClipboardCheck,
} as const;

export function MyDayItemRow({
  item,
  variant = "default",
  onComplete,
  onSnooze,
  completing,
  snoozing,
}: {
  item: MyDayItem;
  variant?: "default" | "overdue" | "completed" | "snoozed";
  onComplete?: () => void;
  onSnooze?: (option: SnoozeOption, customAt?: string) => void;
  completing?: boolean;
  snoozing?: boolean;
}) {
  const Icon = ENTITY_ICON[item.entityType] ?? ListTodo;
  const isCompleted = variant === "completed";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {onComplete ? (
        <button
          type="button"
          onClick={onComplete}
          disabled={completing}
          aria-label="Mark complete"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-transparent hover:border-accent-500 hover:text-accent-500 disabled:opacity-50 dark:border-zinc-600"
        >
          <Check size={13} strokeWidth={3} />
        </button>
      ) : (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check size={13} strokeWidth={3} />
        </div>
      )}

      <Icon size={15} className="shrink-0 text-zinc-400" />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium text-zinc-800 dark:text-zinc-100",
            isCompleted && "text-zinc-400 line-through dark:text-zinc-500"
          )}
        >
          {item.title}
        </p>
        <Link
          href={`/projects/${item.projectId}`}
          className="truncate text-xs text-zinc-500 hover:text-accent-600 hover:underline dark:text-zinc-400"
        >
          {item.projectName}
        </Link>
      </div>

      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          variant === "overdue" ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
        )}
      >
        {variant === "snoozed" ? `until ${formatTime(item.time)}` : formatTime(item.time)}
      </span>

      {onSnooze && (
        <SnoozeMenu onSnooze={onSnooze} disabled={snoozing} align="right" />
      )}
    </div>
  );
}
