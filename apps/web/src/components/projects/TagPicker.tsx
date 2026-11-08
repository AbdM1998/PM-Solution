"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTags, useCreateTag } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

export function TagPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: tags, isLoading } = useTags();
  const createTag = useCreateTag();
  const [draft, setDraft] = useState("");

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((t) => t !== id) : [...selectedIds, id]);
  }

  async function addTag() {
    const name = draft.trim();
    if (!name) return;
    try {
      const tag = await createTag.mutateAsync({ name });
      onChange([...selectedIds, tag.id]);
      setDraft("");
    } catch {
      // Surfaced via createTag.isError below; keep the draft so the user can retry.
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {isLoading && <span className="text-xs text-zinc-400">Loading tags…</span>}
        {tags?.map((tag) => {
          const active = selectedIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-accent-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              )}
            >
              {tag.name}
              {active && <X size={11} />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="New tag name"
          className="w-36 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!draft.trim() || createTag.isPending}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent-600 hover:bg-accent-50 disabled:opacity-50 dark:text-accent-400 dark:hover:bg-accent-900/30"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {createTag.isError && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Couldn&apos;t create that tag. Try again.</p>
      )}
    </div>
  );
}
