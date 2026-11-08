"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center dark:bg-zinc-950">
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Something went wrong</p>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        An unexpected error occurred. You can try again, or come back later.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
