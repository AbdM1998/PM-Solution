import type {
  Project, Task, ChecklistItem, ChecklistTemplate, Reminder, ReminderOccurrence,
  DashboardSummary, MyDay, PaginatedResult, User, EmailThread, EmailMessage,
  Tag, ActivityEntry, AppNotification, DevicePlatform, BoardTask,
  AdminUser, IntegrationsStatus, ReportsSummary,
  AuthConfig, ProjectStage, Attachment, AdminReminder, AdminDelivery, TestNotificationResult,
} from "./types";

export interface ApiClientOptions {
  baseUrl: string;
  /** Where file uploads/downloads go, if different from baseUrl. Used when the web app
   * is behind a proxy with a small request-body cap (Vercel: 4.5MB) — files then go
   * straight to the API's own origin (bearer token auth, so cross-origin is fine). */
  filesBaseUrl?: string;
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
    const fullInit: RequestInit = {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    };

    // Retry purely network-level failures (fetch() throwing — the browser never got a
    // response at all) a few times before giving up. On some machines the local
    // server's own network connection is intermittently intercepted/delayed by
    // endpoint-security software: confirmed by direct inspection that the exact same
    // request can fail outright and then succeed again seconds later on the same page,
    // with the server never actually going down. A short, bounded retry absorbs that
    // without masking a real server error (non-network failures, like 401/500, are
    // never retried here — they're legitimate responses, not dropped connections).
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.doRequest<T>(path, fullInit);
      } catch (err) {
        lastErr = err;
        const isNetworkFailure = err instanceof TypeError;
        if (!isNetworkFailure || attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  private async doRequest<T>(path: string, init: RequestInit): Promise<T> {
    const res = await this.fetchChecked(path, init);
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  private async fetchChecked(path: string, init: RequestInit, baseUrl = this.opts.baseUrl): Promise<Response> {
    const res = await fetch(`${baseUrl}${path}`, init);
    if (res.status === 401) {
      this.opts.onUnauthorized?.();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, (body as any)?.message ?? res.statusText, body);
    }
    return res;
  }

  private authHeader(): Record<string, string> {
    const token = this.opts.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** multipart/form-data upload — no JSON Content-Type, the browser sets the boundary. */
  private async upload<T>(path: string, form: FormData): Promise<T> {
    const res = await this.fetchChecked(
      path,
      { method: "POST", body: form, headers: this.authHeader() },
      this.opts.filesBaseUrl ?? this.opts.baseUrl
    );
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
  authConfig() {
    return this.request<AuthConfig>("/auth/config");
  }
  // ADDED (apps/web, 2026-11-07): documented in docs/API_DESIGN.md ("POST /auth/refresh"
  // / "POST /auth/logout") but had no ApiClient methods. Needed so the web app can give
  // up gracefully on 401 / let the user explicitly sign out; response shape for refresh
  // is a guess (`{ accessToken }`) consistent with login/register, not verified against
  // a running apps/api yet.
  refresh() {
    return this.request<{ accessToken: string }>("/auth/refresh", { method: "POST" });
  }
  logout() {
    return this.request<void>("/auth/logout", { method: "POST" });
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
  // `force` param ADDED (apps/web, 2026-11-07): docs/API_DESIGN.md says delete is
  // "blocked if it has tasks unless ?force=true" — optional, backward-compatible.
  deleteProject(id: string, force?: boolean) {
    return this.request<void>(`/projects/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
  }
  // ADDED (apps/web, 2026-11-07): "GET /projects/:id/activity" is documented in
  // docs/API_DESIGN.md and required for the project detail activity history, but had
  // no ApiClient method.
  getProjectActivity(id: string) {
    return this.request<ActivityEntry[]>(`/projects/${id}/activity`);
  }

  // Tasks
  listTasks(projectId: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request<PaginatedResult<Task>>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`);
  }
  // For the cross-project Board page — every task across every accessible project.
  listAllTasks() {
    return this.request<BoardTask[]>("/tasks");
  }
  createTask(projectId: string, data: unknown) {
    return this.request<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) });
  }
  // ADDED (apps/mobile, 2026-11-07): "GET /tasks/:id" is documented in
  // docs/API_DESIGN.md but had no single-entity ApiClient method. The mobile app needs
  // it to resolve a `projectflow://task/:id` deep link / notification tap into a task
  // detail screen without first loading its parent project's whole task list.
  getTask(id: string) {
    return this.request<Task>(`/tasks/${id}`);
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
  // ADDED (apps/web, 2026-11-07): "POST /tasks/reorder — { taskId, newIndex }[]" is
  // documented in docs/API_DESIGN.md (needed for task drag-and-drop) but had no
  // ApiClient method.
  reorderTasks(items: { taskId: string; newIndex: number }[]) {
    return this.request<void>("/tasks/reorder", { method: "POST", body: JSON.stringify(items) });
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
  // ADDED (apps/web, 2026-11-07): "POST /checklist-items/reorder" and
  // "POST /checklist-items/bulk-complete" are documented in docs/API_DESIGN.md (needed
  // for checklist drag-and-drop and bulk-complete) but had no ApiClient methods. The
  // reorder payload shape (`{ id, newIndex }[]`) is a guess mirroring `reorderTasks`,
  // not verified against a running apps/api yet.
  reorderChecklistItems(items: { id: string; newIndex: number }[]) {
    return this.request<void>("/checklist-items/reorder", { method: "POST", body: JSON.stringify(items) });
  }
  bulkCompleteChecklistItems(ids: string[]) {
    return this.request<void>("/checklist-items/bulk-complete", { method: "POST", body: JSON.stringify({ ids }) });
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

  // ADDED (apps/web, 2026-11-07): "GET /tags" / "POST /tags" are documented in
  // docs/API_DESIGN.md and `tagIds` already exists on CreateProjectInput /
  // UpdateProjectInput, but no ApiClient methods existed to list/create tags for the
  // project tag picker. PATCH/DELETE intentionally not added — not needed by apps/web yet.
  // Tags
  listTags() {
    return this.request<Tag[]>("/tags");
  }
  createTag(data: { name: string; color?: string }) {
    return this.request<Tag>("/tags", { method: "POST", body: JSON.stringify(data) });
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

  // ADDED (apps/mobile, 2026-11-07): "POST /devices/register" and the "/notifications"
  // endpoints are documented in docs/API_DESIGN.md but had no wire types or ApiClient
  // methods. Needed by the mobile app to register for push (device token hand-off to
  // the backend's notification channels — see apps/mobile's README for what this does
  // and does not guarantee) and to power the Notifications tab. Response shapes are a
  // best-effort guess consistent with the rest of this file (plain arrays for list
  // endpoints, `void` for actions), not verified against a running apps/api yet.
  registerDevice(platform: DevicePlatform, token: string) {
    return this.request<void>("/devices/register", { method: "POST", body: JSON.stringify({ platform, token }) });
  }
  listNotifications(unreadOnly?: boolean) {
    return this.request<AppNotification[]>(`/notifications${unreadOnly ? "?unread=true" : ""}`);
  }
  markNotificationRead(id: string) {
    return this.request<void>(`/notifications/${id}/read`, { method: "POST" });
  }
  markAllNotificationsRead() {
    return this.request<void>("/notifications/read-all", { method: "POST" });
  }

  // ---- Project lifecycle (stages) ----
  listStages(projectId: string) {
    return this.request<ProjectStage[]>(`/projects/${projectId}/stages`);
  }
  createStage(projectId: string, data: { name: string; description?: string }) {
    return this.request<ProjectStage>(`/projects/${projectId}/stages`, { method: "POST", body: JSON.stringify(data) });
  }
  applyStagePreset(projectId: string, preset: string) {
    return this.request<ProjectStage[]>(`/projects/${projectId}/stages/preset`, {
      method: "POST",
      body: JSON.stringify({ preset }),
    });
  }
  updateStage(projectId: string, stageId: string, data: { name?: string; description?: string }) {
    return this.request<ProjectStage>(`/projects/${projectId}/stages/${stageId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
  deleteStage(projectId: string, stageId: string) {
    return this.request<void>(`/projects/${projectId}/stages/${stageId}`, { method: "DELETE" });
  }
  reorderStages(projectId: string, items: { stageId: string; newIndex: number }[]) {
    return this.request<ProjectStage[]>(`/projects/${projectId}/stages/reorder`, {
      method: "POST",
      body: JSON.stringify(items),
    });
  }
  advanceStage(projectId: string) {
    return this.request<ProjectStage[]>(`/projects/${projectId}/stages/advance`, { method: "POST" });
  }

  // ---- Attachments (files) ----
  listAttachments(projectId: string) {
    return this.request<Attachment[]>(`/projects/${projectId}/attachments`);
  }
  uploadAttachment(projectId: string, file: File | Blob, fileName: string, taskId?: string) {
    const form = new FormData();
    form.append("file", file, fileName);
    if (taskId) form.append("taskId", taskId);
    return this.upload<Attachment>(`/projects/${projectId}/attachments`, form);
  }
  async downloadAttachment(id: string): Promise<Blob> {
    const res = await this.fetchChecked(
      `/attachments/${id}/download`,
      { headers: this.authHeader() },
      this.opts.filesBaseUrl ?? this.opts.baseUrl
    );
    return res.blob();
  }
  deleteAttachment(id: string) {
    return this.request<void>(`/attachments/${id}`, { method: "DELETE" });
  }

  // ---- Admin ----
  listAdminUsers() {
    return this.request<AdminUser[]>("/admin/users");
  }
  createAdminUser(data: { name: string; email: string; password: string; isAdmin?: boolean; whatsappNumber?: string }) {
    return this.request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(data) });
  }
  updateAdminUser(
    id: string,
    data: { name?: string; isAdmin?: boolean; isActive?: boolean; whatsappNumber?: string | null; password?: string }
  ) {
    return this.request<void>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }
  setUserAdmin(id: string, isAdmin: boolean) {
    return this.updateAdminUser(id, { isAdmin });
  }
  deleteAdminUser(id: string) {
    return this.request<void>(`/admin/users/${id}`, { method: "DELETE" });
  }
  getIntegrationsStatus() {
    return this.request<IntegrationsStatus>("/admin/integrations");
  }
  listAdminReminders() {
    return this.request<AdminReminder[]>("/admin/reminders");
  }
  setAdminReminderActive(id: string, isActive: boolean) {
    return this.request<void>(`/admin/reminders/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
  }
  listAdminDeliveries() {
    return this.request<AdminDelivery[]>("/admin/deliveries");
  }
  sendTestNotification(channel: "EMAIL" | "WHATSAPP", to: string) {
    return this.request<TestNotificationResult>("/admin/test-notification", {
      method: "POST",
      body: JSON.stringify({ channel, to }),
    });
  }
  listAdminAttachments() {
    return this.request<Attachment[]>("/admin/attachments");
  }

  // ---- Reports ----
  getReportsSummary() {
    return this.request<ReportsSummary>("/reports/summary");
  }
}
