import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "./Button";
import { errorMessage } from "@/lib/utils";

export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/20">
      <AlertTriangle className="text-red-500" size={24} />
      <div>
        <p className="font-medium text-red-700 dark:text-red-300">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-red-600/90 dark:text-red-400/90">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
      <div className="text-zinc-400 dark:text-zinc-500">{icon ?? <Inbox size={24} />}</div>
      <p className="font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
      {description && <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
