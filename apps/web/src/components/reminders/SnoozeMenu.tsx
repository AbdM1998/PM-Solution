"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import type { SnoozeOption } from "@projectflow/shared";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn, toDateTimeLocalValue } from "@/lib/utils";

const PRESETS: { value: SnoozeOption; label: string }[] = [
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "later_today", label: "Later today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next_week", label: "Next week" },
];

export function SnoozeMenu({
  onSnooze,
  disabled,
  align = "left",
}: {
  onSnooze: (option: SnoozeOption, customAt?: string) => void;
  disabled?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState(() => toDateTimeLocalValue(new Date()));
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  return (
    <div className="relative inline-block" ref={ref}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Clock size={14} />
        Snooze
      </Button>
      {open && (
        <div
          className={cn(
            "absolute z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-800",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
              onClick={() => {
                setOpen(false);
                onSnooze(p.value);
              }}
            >
              {p.label}
            </button>
          ))}
          <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-700" />
          <div className="px-1 py-1">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Custom date &amp; time
            </label>
            <div className="flex gap-1.5">
              <Input
                type="datetime-local"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="px-2 py-1 text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  onSnooze("custom", new Date(customValue).toISOString());
                }}
              >
                Go
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
