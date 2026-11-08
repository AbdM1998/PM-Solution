"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "system", icon: Monitor, label: "System theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
] as const;

export function ThemeToggle() {
  // `theme` is intentionally `undefined` on the server and on the very first client
  // render (next-themes resolves it from localStorage/system preference after mount,
  // by design, to avoid a hydration mismatch) — so every option briefly renders
  // unselected before the real theme pops in. No extra "mounted" state needed here.
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors dark:text-zinc-400",
            theme === value
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
