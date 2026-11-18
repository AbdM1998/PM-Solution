"use client";

import { useMemo, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { LayoutTemplate } from "lucide-react";
import type { ChecklistItem } from "@projectflow/shared";
import { Button } from "@/components/ui/Button";
import { InlineAdd } from "@/components/ui/InlineAdd";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import {
  useChecklistItems,
  useCreateChecklistItem,
  useCompleteChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useReorderChecklistItems,
} from "@/hooks/useChecklist";
import { errorMessage } from "@/lib/utils";
import { ChecklistLevel, ROOT_KEY } from "./ChecklistLevel";
import { TemplatePickerModal } from "./TemplatePickerModal";

export function ChecklistTree({ taskId }: { taskId: string }) {
  const { data: items, isLoading, isError, error, refetch } = useChecklistItems(taskId);
  const createItem = useCreateChecklistItem(taskId);
  const completeItem = useCompleteChecklistItem(taskId);
  const updateItem = useUpdateChecklistItem(taskId);
  const deleteItem = useDeleteChecklistItem(taskId);
  const reorderItems = useReorderChecklistItems(taskId);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string>();
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();

  const itemsByParent = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of items ?? []) {
      const key = item.parentId ?? ROOT_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const [actionError, setActionError] = useState<unknown>(null);
  const total = items?.length ?? 0;
  const completed = items?.filter((i) => i.status === "COMPLETED").length ?? 0;

  function handleToggle(item: ChecklistItem) {
    setPendingToggleId(item.id);
    setActionError(null);
    const done = () => setPendingToggleId(undefined);
    if (item.status === "COMPLETED") {
      updateItem.mutate({ id: item.id, data: { status: "PENDING" } }, { onSettled: done, onError: setActionError });
    } else {
      completeItem.mutate(item.id, { onSettled: done, onError: setActionError });
    }
  }

  function handleDelete(item: ChecklistItem) {
    setPendingDeleteId(item.id);
    deleteItem.mutate(item.id, { onSettled: () => setPendingDeleteId(undefined), onError: setActionError });
  }

  function handleAddChild(parentId: string, title: string) {
    setActionError(null);
    createItem.mutate({ title, parentId }, { onError: setActionError });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!items || !over || active.id === over.id) return;
    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;
    if ((activeItem.parentId ?? null) !== (overItem.parentId ?? null)) return; // no re-parenting via drag

    const key = activeItem.parentId ?? ROOT_KEY;
    const siblings = (itemsByParent.get(key) ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);
    const oldIndex = siblings.findIndex((i) => i.id === active.id);
    const newIndex = siblings.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(siblings, oldIndex, newIndex);
    reorderItems.mutate(reordered.map((it, idx) => ({ id: it.id, newIndex: idx })));
  }

  if (isLoading) return <PageSpinner label="Loading checklist…" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Checklist{" "}
          {total > 0 && (
            <span className={completed === total ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}>
              {completed}/{total}
            </span>
          )}
          {total > completed && (
            <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              — complete all items to close the task
            </span>
          )}
        </h4>
        <Button size="sm" variant="ghost" onClick={() => setTemplateOpen(true)}>
          <LayoutTemplate size={14} /> From template
        </Button>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <ChecklistLevel
          parentKey={ROOT_KEY}
          itemsByParent={itemsByParent}
          depth={0}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAddChild={handleAddChild}
          pendingToggleId={pendingToggleId}
          pendingDeleteId={pendingDeleteId}
        />
      </DndContext>

      <InlineAdd
        placeholder="Add a checklist item…"
        pending={createItem.isPending}
        onAdd={(title) => {
          setActionError(null);
          createItem.mutate({ title }, { onError: setActionError });
        }}
        className="mt-1"
      />
      {actionError ? (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage(actionError)}
        </p>
      ) : null}

      <TemplatePickerModal open={templateOpen} onClose={() => setTemplateOpen(false)} taskId={taskId} />
    </div>
  );
}
