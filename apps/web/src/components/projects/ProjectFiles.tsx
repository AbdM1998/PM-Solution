"use client";

import { useRef, useState } from "react";
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import type { Attachment } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useApi } from "@/lib/auth-context";
import { useTasks } from "@/hooks/useTasks";
import {
  downloadAttachment,
  formatBytes,
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "@/hooks/useAttachments";
import { errorMessage, formatDateTime } from "@/lib/utils";

const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,.ics";

export function ProjectFiles({ projectId }: { projectId: string }) {
  const api = useApi();
  const { data: files, isLoading } = useAttachments(projectId);
  const { data: tasks } = useTasks(projectId);
  const upload = useUploadAttachment(projectId);
  const del = useDeleteAttachment(projectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [taskId, setTaskId] = useState("");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [busyCount, setBusyCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    setUploadErrors([]);
    setBusyCount(arr.length);
    const errors: string[] = [];
    for (const file of arr) {
      try {
        await upload.mutateAsync({ file, taskId: taskId || undefined });
      } catch (err) {
        errors.push(`${file.name}: ${errorMessage(err)}`);
      }
      setBusyCount((n) => n - 1);
    }
    setUploadErrors(errors);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border-2 border-dashed p-5 transition-colors ${dragOver ? "border-accent-400 bg-accent-50/50 dark:bg-accent-900/20" : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"}`}
        onDragOver={(e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Upload size={20} className="text-accent-600" />
          <div className="min-w-[12rem] flex-1">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Drop files here or choose files</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              PDF, Office, images, ZIP, TXT/CSV — up to 25MB each
            </p>
          </div>
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="w-auto min-w-[11rem]" aria-label="Attach to task">
            <option value="">Whole project</option>
            {(tasks?.items ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                Task: {t.title}
              </option>
            ))}
          </Select>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          <Button size="sm" disabled={busyCount > 0} onClick={() => inputRef.current?.click()}>
            {busyCount > 0 ? `Uploading ${busyCount}…` : "Choose files"}
          </Button>
        </div>
        {uploadErrors.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {uploadErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      {downloadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">{downloadError}</p>
      )}

      {isLoading ? (
        <Spinner className="m-4" />
      ) : !files || files.length === 0 ? (
        <EmptyState icon={<Paperclip size={24} />} title="No files yet" description="Upload contracts, drawings, reports or anything else this project needs." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">File</th>
                <th className="px-4 py-2">Task</th>
                <th className="px-4 py-2">Size</th>
                <th className="px-4 py-2">Uploaded</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="shrink-0 text-zinc-400" />
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-100" dir="auto">
                        {f.fileName}
                      </span>
                    </div>
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
                        type="button"
                        title="Download"
                        onClick={() =>
                          downloadAttachment(api, f.id, f.fileName).catch((err) => setDownloadError(errorMessage(err)))
                        }
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-accent-600 dark:hover:bg-zinc-800"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setPendingDelete(f)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      >
                        <Trash2 size={15} />
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
        description={`"${pendingDelete?.fileName}" will be permanently deleted.`}
        confirmLabel="Delete"
        danger
        pending={del.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && del.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) })}
      />
    </div>
  );
}
