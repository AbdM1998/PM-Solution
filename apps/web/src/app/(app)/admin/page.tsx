"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell, Download, FileText, KeyRound, Mail, MessageCircle, Pause, Pencil, Play, Plus, Send, ShieldCheck,
  ShieldOff, Trash2, UserCheck, UserX,
} from "lucide-react";
import type { AdminUser } from "@projectflow/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input, Label, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import {
  useAdminAttachments,
  useAdminDeliveries,
  useAdminReminders,
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useIntegrationsStatus,
  useSendTestNotification,
  useSetAdminReminderActive,
  useUpdateAdminUser,
} from "@/hooks/useAdmin";
import { downloadAttachment, formatBytes, useDeleteAttachment } from "@/hooks/useAttachments";
import { useApi, useAuth } from "@/lib/auth-context";
import { cn, errorMessage, formatDate, formatDateTime } from "@/lib/utils";

const th = "px-4 py-2";
const thead =
  "border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400";
const row = "border-b border-zinc-100 last:border-0 dark:border-zinc-800";
const iconBtn = "rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30";

function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
      {errorMessage(error)}
    </p>
  );
}

// ---------------- Users ----------------

function UserFormModal({ user, onClose }: { user?: AdminUser; onClose: () => void }) {
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState(user?.whatsappNumber ?? "");
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin ?? false);
  const mutation = user ? updateUser : createUser;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (user) {
      updateUser.mutate(
        {
          id: user.id,
          data: { name, whatsappNumber: whatsapp.trim() || null, ...(password ? { password } : {}) },
        },
        { onSuccess: onClose }
      );
    } else {
      createUser.mutate(
        { name, email, password, isAdmin, ...(whatsapp.trim() ? { whatsappNumber: whatsapp.trim() } : {}) },
        { onSuccess: onClose }
      );
    }
  }

  return (
    <Modal open onClose={onClose} title={user ? `Edit ${user.name}` : "New user"}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="u-name">Full name</Label>
          <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="u-email">Email</Label>
          <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} required />
        </div>
        <div>
          <Label htmlFor="u-pass">{user ? "New password (leave empty to keep)" : "Password"}</Label>
          <Input
            id="u-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!user}
            minLength={8}
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label htmlFor="u-wa">WhatsApp number (for reminders)</Label>
          <Input
            id="u-wa"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="International format, e.g. 9627XXXXXXXX"
            dir="ltr"
          />
        </div>
        {!user && (
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Administrator
          </label>
        )}
        <ErrorNote error={mutation.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : user ? "Save" : "Create user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const { data: users, isLoading } = useAdminUsers();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create accounts, reset passwords, grant admin, or deactivate someone (keeps their projects).
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New user
        </Button>
      </div>
      <ErrorNote error={updateUser.error ?? deleteUser.error} />
      <Card className="overflow-x-auto">
        {isLoading ? (
          <Spinner className="m-4" />
        ) : (
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Email</th>
                <th className={th}>WhatsApp</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
                <th className={th}>Projects</th>
                <th className={th}>Joined</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id} className={cn(row, !u.isActive && "opacity-60")}>
                    <td className="px-4 py-2 font-medium">
                      {u.name} {self && <span className="text-xs text-zinc-400">(you)</span>}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{u.email}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400" dir="ltr">
                      {u.whatsappNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={u.isAdmin ? "accent" : "neutral"}>{u.isAdmin ? "Admin" : "Member"}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "Active" : "Deactivated"}</Badge>
                    </td>
                    <td className="px-4 py-2">{u.projectCount}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Edit / reset password" onClick={() => setEditing(u)} className={iconBtn}>
                          {self ? <KeyRound size={16} /> : <Pencil size={16} />}
                        </button>
                        {!self && (
                          <>
                            <button
                              title={u.isAdmin ? "Remove admin" : "Make admin"}
                              onClick={() => updateUser.mutate({ id: u.id, data: { isAdmin: !u.isAdmin } })}
                              className={iconBtn}
                            >
                              {u.isAdmin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                            </button>
                            <button
                              title={u.isActive ? "Deactivate" : "Reactivate"}
                              onClick={() => updateUser.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                              className={iconBtn}
                            >
                              {u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                            </button>
                            <button
                              title="Delete user"
                              onClick={() => setPendingDelete(u)}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {creating && <UserFormModal onClose={() => setCreating(false)} />}
      {editing && <UserFormModal user={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete ${pendingDelete?.name}?`}
        description="Permanently deletes the account and its reminders. Users who own projects can't be deleted — deactivate them instead."
        confirmLabel="Delete"
        danger
        pending={deleteUser.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteUser.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) })}
      />
    </div>
  );
}

// ---------------- Reminders ----------------

function RemindersTab() {
  const { data: reminders, isLoading } = useAdminReminders();
  const setActive = useSetAdminReminderActive();
  const [filter, setFilter] = useState<"active" | "all">("active");
  const list = (reminders ?? []).filter((r) => filter === "all" || r.isActive);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Every reminder in the system, from every user.</p>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as "active" | "all")} className="w-auto">
          <option value="active">Active only</option>
          <option value="all">All (incl. paused)</option>
        </Select>
      </div>
      <ErrorNote error={setActive.error} />
      {isLoading ? (
        <Spinner className="m-4" />
      ) : list.length === 0 ? (
        <EmptyState icon={<Bell size={24} />} title="No reminders" description="Reminders users add on projects, tasks or checklist items show up here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={th}>Reminder for</th>
                <th className={th}>Project</th>
                <th className={th}>Owner</th>
                <th className={th}>Repeats</th>
                <th className={th}>Channels</th>
                <th className={th}>Next</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={cn(row, !r.isActive && "opacity-60")}>
                  <td className="px-4 py-2">
                    <span className="font-medium" dir="auto">{r.entityTitle}</span>
                    <span className="ml-1 text-xs text-zinc-400">{r.entityType.replace("_", " ").toLowerCase()}</span>
                  </td>
                  <td className="px-4 py-2">
                    {r.projectId ? (
                      <Link href={`/projects/${r.projectId}`} className="text-accent-700 hover:underline dark:text-accent-400" dir="auto">
                        {r.projectName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{r.ownerName}</td>
                  <td className="px-4 py-2">{r.type.replace("_", " ").toLowerCase()}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.channels.map((c) => (
                        <Badge key={c} tone={c === "EMAIL" ? "blue" : c === "WHATSAPP" ? "green" : "neutral"}>
                          {c.replace("_", " ").toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                    {r.isActive ? (r.nextFireAt ? formatDateTime(r.nextFireAt) : "done") : "paused"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      title={r.isActive ? "Pause" : "Resume"}
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ id: r.id, isActive: !r.isActive })}
                      className={iconBtn}
                    >
                      {r.isActive ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------------- Files ----------------

function FilesTab() {
  const api = useApi();
  const { data: files, isLoading } = useAdminAttachments();
  const del = useDeleteAttachment();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const total = (files ?? []).reduce((s, f) => s + f.sizeBytes, 0);

  return (
    <div>
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        All uploaded files across projects ({files?.length ?? 0} files, {formatBytes(total)}). Upload files from a
        project&apos;s <b>Files</b> tab.
      </p>
      <ErrorNote error={downloadError ?? del.error} />
      {isLoading ? (
        <Spinner className="m-4" />
      ) : !files || files.length === 0 ? (
        <EmptyState icon={<FileText size={24} />} title="No files uploaded yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={th}>File</th>
                <th className={th}>Project</th>
                <th className={th}>Task</th>
                <th className={th}>Size</th>
                <th className={th}>Uploaded</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className={row}>
                  <td className="px-4 py-2 font-medium" dir="auto">{f.fileName}</td>
                  <td className="px-4 py-2">
                    {f.projectId ? (
                      <Link href={`/projects/${f.projectId}`} className="text-accent-700 hover:underline dark:text-accent-400" dir="auto">
                        {f.projectName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{f.taskTitle ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{formatBytes(f.sizeBytes)}</td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(f.createdAt)}
                    {f.uploadedByName ? ` · ${f.uploadedByName}` : ""}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        title="Download"
                        className={iconBtn}
                        onClick={() => downloadAttachment(api, f.id, f.fileName).catch(setDownloadError)}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        title="Delete"
                        className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                        onClick={() => setPendingDelete({ id: f.id, name: f.fileName })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete file?"
        description={`"${pendingDelete?.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && del.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) })}
      />
    </div>
  );
}

// ---------------- Notifications ----------------

function TestSendCard({ channel, configured }: { channel: "EMAIL" | "WHATSAPP"; configured: boolean }) {
  const { user } = useAuth();
  const send = useSendTestNotification();
  const [to, setTo] = useState(channel === "EMAIL" ? user?.email ?? "" : user?.whatsappNumber ?? "");
  const isEmail = channel === "EMAIL";
  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <Label htmlFor={`test-${channel}`}>Send a test {isEmail ? "email" : "WhatsApp message"} to</Label>
      <div className="flex gap-2">
        <Input
          id={`test-${channel}`}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={isEmail ? "name@example.com" : "9627XXXXXXXX"}
          dir="ltr"
        />
        <Button size="sm" disabled={send.isPending || !to.trim()} onClick={() => send.mutate({ channel, to: to.trim() })}>
          <Send size={14} /> {send.isPending ? "Sending…" : "Send"}
        </Button>
      </div>
      {send.data && (
        <p
          className={cn(
            "mt-2 rounded-md px-3 py-2 text-sm",
            send.data.ok && !send.data.simulated && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
            send.data.ok && send.data.simulated && "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
            !send.data.ok && "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
          )}
        >
          {send.data.detail}
        </p>
      )}
      {send.error ? <p className="mt-2 text-sm text-red-600">{errorMessage(send.error)}</p> : null}
      {!configured && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Not configured on the server yet — see the deployment guide ({isEmail ? "SMTP_*" : "WHATSAPP_*"} settings).
        </p>
      )}
    </div>
  );
}

function NotificationsTab() {
  const { data: integrations, isLoading } = useIntegrationsStatus();
  const { data: deliveries, isLoading: dLoading } = useAdminDeliveries();

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Bell size={16} /> In-app notifications
          </div>
          <div className="mt-2">
            <Badge tone="green">Always on</Badge>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Shown in the bell menu and pushed live to open browsers.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Mail size={16} /> Email
          </div>
          {isLoading ? (
            <Spinner className="mt-2" />
          ) : (
            <>
              <div className="mt-2 space-y-1 text-sm">
                <Badge tone={integrations?.email.configured ? "green" : "amber"}>
                  {integrations?.email.configured ? "Configured" : "Simulated (not configured)"}
                </Badge>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Server: {integrations?.email.host ?? "—"} · Sender: {integrations?.email.from ?? "—"}
                </p>
              </div>
              <TestSendCard channel="EMAIL" configured={!!integrations?.email.configured} />
            </>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MessageCircle size={16} /> WhatsApp
          </div>
          {isLoading ? (
            <Spinner className="mt-2" />
          ) : (
            <>
              <div className="mt-2">
                <Badge tone={integrations?.whatsapp.configured ? "green" : "amber"}>
                  {integrations?.whatsapp.configured ? "Configured" : "Not configured"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Sent to the reminder&apos;s number, or else the user&apos;s WhatsApp number from the Users tab.
              </p>
              <TestSendCard channel="WHATSAPP" configured={!!integrations?.whatsapp.configured} />
            </>
          )}
        </Card>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Delivery log (latest 200)</h3>
      {dLoading ? (
        <Spinner className="m-4" />
      ) : !deliveries || deliveries.length === 0 ? (
        <EmptyState icon={<Send size={24} />} title="Nothing sent yet" description="Every reminder delivery attempt is recorded here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Channel</th>
                <th className={th}>To</th>
                <th className={th}>Reminder</th>
                <th className={th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className={row}>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500 dark:text-zinc-400">{formatDateTime(d.attemptedAt)}</td>
                  <td className="px-4 py-2">{d.channel.replace("_", " ").toLowerCase()}</td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400" dir="ltr">{d.target ?? "—"}</td>
                  <td className="px-4 py-2" dir="auto">{d.title ?? "—"}</td>
                  <td className="px-4 py-2">
                    {d.status === "FAILED" ? (
                      <span title={d.error ?? ""}>
                        <Badge tone="red">Failed</Badge>
                        <span className="ml-2 text-xs text-red-600 dark:text-red-400">{d.error}</span>
                      </span>
                    ) : d.simulated ? (
                      <Badge tone="amber">Simulated</Badge>
                    ) : (
                      <Badge tone="green">{d.status === "SENT" ? "Sent" : d.status}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState("users");
  return (
    <div>
      <PageHeader title="Admin" description="Users, reminders, files and notification channels." />
      <Tabs
        tabs={[
          { id: "users", label: "Users" },
          { id: "reminders", label: "Reminders" },
          { id: "files", label: "Files" },
          { id: "notifications", label: "Notifications" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "users" && <UsersTab />}
      {tab === "reminders" && <RemindersTab />}
      {tab === "files" && <FilesTab />}
      {tab === "notifications" && <NotificationsTab />}
    </div>
  );
}
