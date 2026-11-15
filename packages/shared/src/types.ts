// Wire-format types shared by apps/web, apps/mobile and apps/api.
// Dates are ISO 8601 UTC strings on the wire (never Date objects) — each client
// converts to the user's timezone only for display/scheduling math.

export type ProjectStatus = "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type ChecklistStatus = "PENDING" | "COMPLETED";
export type ReminderEntityType = "PROJECT" | "TASK" | "CHECKLIST_ITEM";
export type ReminderType = "ONE_TIME" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
export type ReminderChannel = "IN_APP" | "EMAIL" | "WHATSAPP" | "PUSH" | "BROWSER_PUSH";
export type OccurrenceStatus = "PENDING" | "PROCESSING" | "SENT" | "SNOOZED" | "CANCELLED" | "FAILED";
export type SnoozeOption = "5m" | "10m" | "30m" | "1h" | "later_today" | "tomorrow" | "next_week" | "custom";

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  startDate: string;
  targetEndDate?: string | null;
  actualEndDate?: string | null;
  status: ProjectStatus;
  priority: Priority;
  color?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // computed, server-side only — never user-editable
  durationDays: number;
  daysElapsed: number;
  daysRemaining: number | null;
  daysOverdue: number;
  completionPercent: number;
  completedTaskCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
  // ADDED (apps/web, 2026-11-07): resolved tag objects for display, additive and
  // optional — the write path already accepted `tagIds` in CreateProjectInput /
  // UpdateProjectInput, but no field existed to read them back. See Tag below.
  tags?: Tag[];
}

// ADDED (apps/web, 2026-11-07): Tag CRUD is documented in docs/API_DESIGN.md and
// `tagIds` already exists on CreateProjectInput/UpdateProjectInput in schemas.ts, but
// no Tag type or ApiClient methods existed yet. Shape matches apps/api/prisma/schema.prisma
// `model Tag` (id, ownerId, name, color).
export interface Tag {
  id: string;
  ownerId: string;
  name: string;
  color?: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  assignedUserId?: string | null;
  orderIndex: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ADDED for the cross-project Board (Kanban) page: GET /tasks (no project scope)
// returns every task the user can access across all their projects, denormalized
// with the owning project's name/color for display — a plain Task alone doesn't
// carry enough to label a card on a board that spans projects.
export interface BoardTask extends Task {
  projectName: string;
  projectColor?: string | null;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  parentId?: string | null;
  title: string;
  description?: string | null;
  status: ChecklistStatus;
  priority: Priority;
  dueDate?: string | null;
  completedAt?: string | null;
  orderIndex: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string | null;
  items: { id: string; title: string; description?: string | null; orderIndex: number; defaultPriority: Priority }[];
}

export interface Reminder {
  id: string;
  entityType: ReminderEntityType;
  entityId: string;
  type: ReminderType;
  scheduledAt?: string | null;
  recurrenceRule?: string | null;
  offsetBeforeDueMinutes?: number | null;
  channels: ReminderChannel[];
  isActive: boolean;
  // Optional per-reminder override of where EMAIL/WHATSAPP delivery goes — see
  // apps/api/src/worker/scheduler.ts and the EMAIL/WHATSAPP channel adapters.
  targetEmail?: string | null;
  targetWhatsappNumber?: string | null;
}

export interface ReminderOccurrence {
  id: string;
  reminderId: string;
  nextFireAt: string;
  status: OccurrenceStatus;
  // context denormalized for list views (Dashboard / My Day / Calendar)
  entityType: ReminderEntityType;
  entityId: string;
  entityTitle: string;
  projectId: string;
  projectName: string;
}

// ADDED (apps/web, 2026-11-07): `GET /projects/:id/activity` is documented in
// docs/API_DESIGN.md and required by the project detail page's activity history, but
// had no ApiClient method or return type. Shape matches `model ActivityLog` in
// apps/api/prisma/schema.prisma; superset of the inline shape used by
// `DashboardSummary.recentActivity` (which is left untouched).
export interface ActivityEntry {
  id: string;
  projectId?: string | null;
  taskId?: string | null;
  userId: string;
  action: string;
  metadata?: unknown;
  createdAt: string;
}

export interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  tasksDueToday: number;
  overdueTasks: number;
  upcomingReminders: number;
  pendingChecklists: number;
  recentlyUpdatedProjects: Project[];
  recentActivity: { id: string; action: string; createdAt: string; projectId?: string | null; taskId?: string | null }[];
}

export interface MyDayItem {
  occurrenceId: string;
  time: string; // ISO, local-rendered by client
  title: string;
  projectId: string;
  projectName: string;
  entityType: ReminderEntityType;
  entityId: string;
}

export interface MyDay {
  today: MyDayItem[];
  overdue: MyDayItem[];
  completedToday: MyDayItem[];
  snoozed: MyDayItem[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmailThread {
  id: string;
  projectId: string;
  subject: string;
  conversationId?: string | null;
  externalUrl?: string | null;
  source: "MANUAL" | "IMPORTED_FILE" | "CONNECTED_ACCOUNT";
  notes?: string | null;
  createdAt: string;
}

// ADDED (apps/mobile, 2026-11-07): `POST /devices/register` and the `/notifications`
// endpoints are documented in docs/API_DESIGN.md but had no wire types/ApiClient methods
// yet. The mobile app needs both for expo-notifications device registration and the
// Notifications tab. Added here so apps/web can read the same shape later.
export type DevicePlatform = "IOS" | "ANDROID" | "WEB";

// Named `AppNotification` (not `Notification`) to avoid colliding with the DOM
// `Notification` type that's globally available in web/browser TS environments.
export interface AppNotification {
  id: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
  // denormalized context for list rendering, same convention as ReminderOccurrence above
  entityType?: ReminderEntityType | null;
  entityId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  fromAddress?: string | null;
  toAddresses?: string[] | null;
  ccAddresses?: string[] | null;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  sentAt?: string | null;
}
