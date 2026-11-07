import type {
  Project, Task, ChecklistItem, ChecklistTemplate, Reminder, ReminderOccurrence,
  DashboardSummary, MyDay, PaginatedResult, User, EmailThread, EmailMessage,
} from "./types";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => string | null | undefined;
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export class ApiClient {
  constructor(private opts: ApiClientOptions) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.opts.getAccessToken();
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (res.status === 401) {
      this.opts.onUnauthorized?.();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, (body as any)?.message ?? res.statusText, body);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // Auth
  login(email: string, password: string) {
    return this.request<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }
  register(email: string, password: string, name: string) {
    return this.request<{ accessToken: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  }
  me() {
    return this.request<User>("/auth/me");
  }

  // Dashboard
  dashboardSummary() {
    return this.request<DashboardSummary>("/dashboard/summary");
  }
  myDay() {
    return this.request<MyDay>("/dashboard/my-day");
  }

  // Projects
  listProjects(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<PaginatedResult<Project>>(`/projects${qs ? `?${qs}` : ""}`);
  }
  getProject(id: string) {
    return this.request<Project>(`/projects/${id}`);
  }
  createProject(data: unknown) {
    return this.request<Project>("/projects", { method: "POST", body: JSON.stringify(data) });
  }
  updateProject(id: string, data: unknown) {
    return this.request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }
  deleteProject(id: string) {
    return this.request<void>(`/projects/${id}`, { method: "DELETE" });
  }

  // Tasks
  listTasks(projectId: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<PaginatedResult<Task>>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`);
  }
  createTask(projectId: string, data: unknown) {
    return this.request<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) });
  }
  updateTask(id: string, data: unknown) {
    return this.request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }
  deleteTask(id: string) {
    return this.request<void>(`/tasks/${id}`, { method: "DELETE" });
  }
  bulkCompleteTasks(taskIds: string[]) {
    return this.request<void>("/tasks/bulk-complete", { method: "POST", body: JSON.stringify({ taskIds }) });
  }

  // Checklist items
  listChecklistItems(taskId: string) {
    return this.request<ChecklistItem[]>(`/tasks/${taskId}/checklist-items`);
  }
  createChecklistItem(taskId: string, data: unknown) {
    return this.request<ChecklistItem>(`/tasks/${taskId}/checklist-items`, { method: "POST", body: JSON.stringify(data) });
  }
  updateChecklistItem(id: string, data: unknown) {
    return this.request<ChecklistItem>(`/checklist-items/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }
  completeChecklistItem(id: string) {
    return this.request<ChecklistItem>(`/checklist-items/${id}/complete`, { method: "POST" });
  }
  deleteChecklistItem(id: string) {
    return this.request<void>(`/checklist-items/${id}`, { method: "DELETE" });
  }

  // Templates
  listChecklistTemplates() {
    return this.request<ChecklistTemplate[]>("/checklist-templates");
  }
  createChecklistTemplate(data: unknown) {
    return this.request<ChecklistTemplate>("/checklist-templates", { method: "POST", body: JSON.stringify(data) });
  }
  applyChecklistTemplate(templateId: string, taskId: string) {
    return this.request<ChecklistItem[]>(`/checklist-templates/${templateId}/apply`, {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
  }

  // Reminders
  listReminders(entityType: string, entityId: string) {
    return this.request<Reminder[]>(`/reminders?entityType=${entityType}&entityId=${entityId}`);
  }
  createReminder(data: unknown) {
    return this.request<Reminder>("/reminders", { method: "POST", body: JSON.stringify(data) });
  }
  deleteReminder(id: string) {
    return this.request<void>(`/reminders/${id}`, { method: "DELETE" });
  }
  listOccurrences(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<ReminderOccurrence[]>(`/reminders/occurrences${qs ? `?${qs}` : ""}`);
  }
  snoozeOccurrence(id: string, option: string, customAt?: string) {
    return this.request<ReminderOccurrence>(`/occurrences/${id}/snooze`, {
      method: "POST",
      body: JSON.stringify({ option, customAt }),
    });
  }
  completeOccurrence(id: string) {
    return this.request<ReminderOccurrence>(`/occurrences/${id}/complete`, { method: "POST" });
  }

  // Email threads
  listEmailThreads(projectId: string) {
    return this.request<EmailThread[]>(`/projects/${projectId}/email-threads`);
  }
  createEmailThread(projectId: string, data: unknown) {
    return this.request<EmailThread>(`/projects/${projectId}/email-threads`, { method: "POST", body: JSON.stringify(data) });
  }
  listEmailMessages(threadId: string) {
    return this.request<EmailMessage[]>(`/email-threads/${threadId}/messages`);
  }
}
