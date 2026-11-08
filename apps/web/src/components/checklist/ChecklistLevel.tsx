"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ChecklistItem } from "@projectflow/shared";
import { SortableChecklistItem } from "./SortableChecklistItem";

export const ROOT_KEY = "__root__";

export function ChecklistLevel({
  parentKey,
  itemsByParent,
  depth,
  onToggle,
  onDelete,
  onAddChild,
  pendingToggleId,
  pendingDeleteId,
}: {
  parentKey: string;
  itemsByParent: Map<string, ChecklistItem[]>;
  depth: number;
  onToggle: (item: ChecklistItem) => void;
  onDelete: (item: ChecklistItem) => void;
  onAddChild: (parentId: string, title: string) => void;
  pendingToggleId?: string;
  pendingDeleteId?: string;
}) {
  const siblings = (itemsByParent.get(parentKey) ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);
  if (siblings.length === 0) return null;

  return (
    <SortableContext items={siblings.map((s) => s.id)} strategy={verticalListSortingStrategy}>
      <ul className={depth > 0 ? "ml-5 border-l border-zinc-100 pl-2 dark:border-zinc-800" : ""}>
        {siblings.map((item) => (
          <SortableChecklistItem
            key={item.id}
            item={item}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item)}
            onAddChild={(title) => onAddChild(item.id, title)}
            toggling={pendingToggleId === item.id}
            deleting={pendingDeleteId === item.id}
          >
            <ChecklistLevel
              parentKey={item.id}
              itemsByParent={itemsByParent}
              depth={depth + 1}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              pendingToggleId={pendingToggleId}
              pendingDeleteId={pendingDeleteId}
            />
          </SortableChecklistItem>
        ))}
      </ul>
    </SortableContext>
  );
}
