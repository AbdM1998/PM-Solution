"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReminderOccurrence } from "@projectflow/shared";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useOccurrences } from "@/hooks/useReminders";
import { cn } from "@/lib/utils";

export function MonthCalendar() {
  const [cursor, setCursor] = useState(() => new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = useMemo(() => {
    const result: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [gridStart, gridEnd]);

  const { data, isLoading, isError, error, refetch } = useOccurrences({
    from: gridStart.toISOString(),
    to: gridEnd.toISOString(),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, ReminderOccurrence[]>();
    for (const occ of data ?? []) {
      const key = format(new Date(occ.nextFireAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(occ);
    }
    return map;
  }, [data]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
            <ChevronLeft size={15} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>

      {isLoading && <PageSpinner label="Loading calendar…" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const items = byDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const today = isSameDay(day, new Date());
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[88px] border-b border-r border-zinc-100 p-1.5 dark:border-zinc-800",
                    !inMonth && "bg-zinc-50/60 dark:bg-zinc-900/40"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      today
                        ? "bg-accent-600 font-semibold text-white"
                        : inMonth
                        ? "text-zinc-600 dark:text-zinc-300"
                        : "text-zinc-400 dark:text-zinc-600"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {items.slice(0, 3).map((occ) => (
                      <Link
                        key={occ.id}
                        href={`/projects/${occ.projectId}`}
                        className="block truncate rounded bg-accent-50 px-1 py-0.5 text-[11px] text-accent-700 hover:bg-accent-100 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50"
                        title={occ.entityTitle}
                      >
                        {occ.entityTitle}
                      </Link>
                    ))}
                    {items.length > 3 && (
                      <span className="block px-1 text-[11px] text-zinc-400">+{items.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
