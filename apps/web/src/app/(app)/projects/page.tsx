"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { ProjectStatusEnum, PriorityEnum } from "@projectflow/shared";

export default function ProjectsPage() {
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filters: Record<string, string> = {};
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (search) filters.search = search;

  const { data, isLoading, isError, error, refetch } = useProjects(filters);
  const createProject = useCreateProject();

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Everything you're working on."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New project
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="pl-8"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {ProjectStatusEnum.options.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto">
          <option value="">All priorities</option>
          {PriorityEnum.options.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <PageSpinner label="Loading projects…" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No projects match"
          description="Try adjusting your filters, or create a new project to get started."
          action={<Button onClick={() => setCreateOpen(true)}>New project</Button>}
        />
      )}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <ProjectForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        submitting={createProject.isPending}
        submitError={createProject.error}
        onSubmit={(payload) =>
          createProject.mutate(payload, {
            onSuccess: () => setCreateOpen(false),
          })
        }
      />
    </div>
  );
}
