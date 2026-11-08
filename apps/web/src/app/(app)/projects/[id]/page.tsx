"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@projectflow/shared";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectStatsBar } from "@/components/projects/ProjectStatsBar";
import { ProjectActivity } from "@/components/projects/ProjectActivity";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { TaskList } from "@/components/tasks/TaskList";
import { ReminderPanel } from "@/components/reminders/ReminderPanel";
import { useProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const { data: project, isLoading, isError, error, refetch } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [forceDeletePrompt, setForceDeletePrompt] = useState(false);
  const [tab, setTab] = useState("tasks");

  function handleDelete(force?: boolean) {
    deleteProject.mutate(
      { id: projectId, force },
      {
        onSuccess: () => router.push("/projects"),
        onError: (err) => {
          // Per docs/API_DESIGN.md, delete is blocked with tasks unless ?force=true.
          if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
            setForceDeletePrompt(true);
          }
        },
      }
    );
  }

  if (isLoading) return <PageSpinner label="Loading project…" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!project) return null;

  return (
    <div>
      <ProjectHeader project={project} onEdit={() => setEditOpen(true)} onDelete={() => setConfirmDeleteOpen(true)} />

      <div className="mb-6">
        <ProjectStatsBar project={project} />
      </div>

      <Tabs
        tabs={[
          { id: "tasks", label: "Tasks" },
          { id: "reminders", label: "Reminders" },
          { id: "activity", label: "Activity" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "tasks" && <TaskList projectId={project.id} />}
      {tab === "reminders" && <ReminderPanel entityType="PROJECT" entityId={project.id} />}
      {tab === "activity" && <ProjectActivity projectId={project.id} />}

      <ProjectForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
        submitting={updateProject.isPending}
        submitError={updateProject.error}
        onSubmit={(payload) => updateProject.mutate(payload, { onSuccess: () => setEditOpen(false) })}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete project?"
        description="This permanently deletes the project. This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleteProject.isPending}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => handleDelete(false)}
      />

      <ConfirmDialog
        open={forceDeletePrompt}
        title="This project has tasks"
        description="Deleting it will also remove its tasks and checklists. Delete anyway?"
        confirmLabel="Delete anyway"
        danger
        pending={deleteProject.isPending}
        onCancel={() => {
          setForceDeletePrompt(false);
          setConfirmDeleteOpen(false);
        }}
        onConfirm={() => handleDelete(true)}
      />
    </div>
  );
}
