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
