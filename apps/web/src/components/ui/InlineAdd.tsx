"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function InlineAdd({
  placeholder,
  onAdd,
  className,
  pending,
}: {
  placeholder: string;
  onAdd: (title: string) => void;
  className?: string;
  pending?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const title = value.trim();
    if (!title) return;
    onAdd(title);
    setValue("");
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Plus size={14} className="shrink-0 text-zinc-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        disabled={pending}
        className="w-full border-none bg-transparent py-1 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50 dark:text-zinc-200 dark:placeholder:text-zinc-500"
      />
    </div>
  );
}
