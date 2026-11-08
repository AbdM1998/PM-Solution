import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function MyDaySection({
  title,
  count,
  tone = "default",
  children,
}: {
  title: string;
  count: number;
  tone?: "default" | "warning";
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
            tone === "warning"
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {count}
        </span>
      </div>
      <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">{children}</Card>
    </section>
  );
}
