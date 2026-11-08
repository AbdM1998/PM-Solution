import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center dark:bg-zinc-950">
      <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">404</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">This page doesn&apos;t exist.</p>
      <Link href="/dashboard" className="text-sm font-medium text-accent-600 hover:underline dark:text-accent-400">
        Back to dashboard
      </Link>
    </div>
  );
}
