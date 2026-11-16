import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Reads the API base URL from the env var documented in .env.example. */
export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
  // Building from Git Bash (MSYS) silently rewrites a POSIX-looking value like "/api"
  // into a Windows path ("C:/Program Files/Git/api") before Next.js inlines it, and
  // fetch() on that throws a TypeError that surfaces as "Could not reach the server"
  // on every request. Recover the intended relative path if that happened.
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return "/" + value.split(/[\\/]/).filter(Boolean).pop();
  }
  return value;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const dateYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Formats an ISO date string for display, converting to the viewer's local timezone. */
export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const isThisYear = d.getFullYear() === new Date().getFullYear();
  return (isThisYear ? dateFormatter : dateYearFormatter).format(d);
}

export function formatTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return timeFormatter.format(d);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return dateTimeFormatter.format(d);
}

/** Converts a Date to the `datetime-local` input value in the viewer's local time. */
export function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isPast(iso?: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/** Extracts a human-readable message from any error thrown by ApiClient or fetch. */
export function errorMessage(err: unknown): string {
  if (!err) return "Something went wrong.";
  if (err instanceof Error) {
    if (err.message === "Failed to fetch" || err.name === "TypeError") {
      return "Could not reach the server. It may be offline — please try again shortly.";
    }
    return err.message;
  }
  return String(err);
}
