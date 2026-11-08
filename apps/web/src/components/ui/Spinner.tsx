import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin text-zinc-400", className)} size={18} />;
}

export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-48 w-full flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
      <Spinner className="h-6 w-6" />
      <span>{label}</span>
    </div>
  );
}
