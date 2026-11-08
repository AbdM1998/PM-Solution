export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white">
            P
          </div>
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">ProjectFlow</span>
        </div>
        {children}
      </div>
    </div>
  );
}
