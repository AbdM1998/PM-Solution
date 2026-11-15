"use client";

import { useState } from "react";
import { Mail, MessageCircle, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useAdminUsers, useDeleteAdminUser, useIntegrationsStatus, useSetUserAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const { user: me } = useAuth();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: integrations, isLoading: integrationsLoading } = useIntegrationsStatus();
  const setUserAdmin = useSetUserAdmin();
  const deleteUser = useDeleteAdminUser();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Admin" description="Manage users and check integration status." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Mail size={16} /> Email (reminders)
          </div>
          {integrationsLoading ? (
            <Spinner className="mt-2" />
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              <Badge tone={integrations?.email.configured ? "green" : "amber"}>
                {integrations?.email.configured ? "Configured" : "Simulated (not configured)"}
              </Badge>
              <p className="text-zinc-500 dark:text-zinc-400">
                Sender: {integrations?.email.from ?? "—"}
              </p>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MessageCircle size={16} /> WhatsApp
          </div>
          {integrationsLoading ? (
            <Spinner className="mt-2" />
          ) : (
            <div className="mt-2">
              <Badge tone={integrations?.whatsapp.configured ? "green" : "amber"}>
                {integrations?.whatsapp.configured ? "Configured" : "Not configured"}
              </Badge>
            </div>
          )}
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Users</h2>
      <Card className="overflow-hidden">
        {usersLoading ? (
          <Spinner className="m-4" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Projects</th>
                <th className="px-4 py-2">Tasks</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-2 font-medium">{u.name}</td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{u.email}</td>
                  <td className="px-4 py-2">
                    <Badge tone={u.isAdmin ? "accent" : "neutral"}>{u.isAdmin ? "Admin" : "Member"}</Badge>
                  </td>
                  <td className="px-4 py-2">{u.projectCount}</td>
                  <td className="px-4 py-2">{u.taskCount}</td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      {u.id !== me?.id && (
                        <button
                          title={u.isAdmin ? "Remove admin" : "Make admin"}
                          onClick={() => setUserAdmin.mutate({ id: u.id, isAdmin: !u.isAdmin })}
                          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {u.isAdmin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                        </button>
                      )}
                      {u.id !== me?.id && (
                        <button
                          title="Delete user"
                          onClick={() => setPendingDeleteId(u.id)}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm p-5">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Delete this user and all their data? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteUser.mutate(pendingDeleteId);
                  setPendingDeleteId(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
