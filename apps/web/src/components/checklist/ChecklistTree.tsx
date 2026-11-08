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

  function handleToggle(item: ChecklistItem) {
    setPendingToggleId(item.id);
    const done = () => setPendingToggleId(undefined);
    if (item.status === "COMPLETED") {
      updateItem.mutate({ id: item.id, data: { status: "PENDING" } }, { onSettled: done });
    } else {
      completeItem.mutate(item.id, { onSettled: done });
    }
  }

  function handleDelete(item: ChecklistItem) {
    setPendingDeleteId(item.id);
    deleteItem.mutate(item.id, { onSettled: () => setPendingDeleteId(undefined) });
  }

  function handleAddChild(parentId: string, title: string) {
    createItem.mutate({ title, parentId });
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
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Checklist</h4>
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
        onAdd={(title) => createItem.mutate({ title })}
        className="mt-1"
      />

      <TemplatePickerModal open={templateOpen} onClose={() => setTemplateOpen(false)} taskId={taskId} />
    </div>
  );
}
