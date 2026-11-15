"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FolderKanban, LayoutDashboard, Sun, Trello } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-day", label: "My Day", icon: Sun },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/board", label: "Board", icon: Trello },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
