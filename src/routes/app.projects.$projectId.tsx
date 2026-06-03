import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AvatarStack } from "@/components/app/Avatar";
import { projectStatusMeta, type ProjectStatus } from "@/lib/mock-data";
import {
  deleteProject,
  fetchProjects,
  updateProject,
  type ProjectApiItem,
  type ProjectApiStatus,
} from "@/lib/api/projects";
import {
  fetchTasks,
  type TaskApiItem,
  type TaskApiPriority,
  type TaskApiStatus,
} from "@/lib/api/tasks";
import {
  deleteProjectDocument,
  downloadProjectDocumentFile,
  fetchProjectDocumentBlob,
  fetchProjectDocuments,
  formatDocumentSize,
  getProjectDocumentFileTypeBadge,
  isImageProjectDocument,
  openProjectDocument,
  uploadProjectDocument,
  type ProjectDocumentApiItem,
} from "@/lib/api/project-documents";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  ListTodo,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

export const Route = createFileRoute("/app/projects/$projectId")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Project — TeamFlow AI" }] }),
  component: ProjectDetailPage,
});

const apiStatusMap: Record<ProjectApiStatus, ProjectStatus> = {
  ACTIVE: "active",
  PLANNING: "planning",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
};

const taskStatusLabel: Record<TaskApiStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "Todo",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const taskStatusTone: Record<TaskApiStatus, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  TODO: "bg-info/15 text-info",
  IN_PROGRESS: "bg-primary/15 text-primary",
  REVIEW: "bg-warning/20 text-warning-foreground",
  DONE: "bg-success/15 text-success",
};

const taskPriorityLabel: Record<TaskApiPriority, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

const taskPriorityTone: Record<TaskApiPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-info/15 text-info",
  HIGH: "bg-warning/20 text-warning-foreground",
  URGENT: "bg-destructive/15 text-destructive",
};

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const isLoading = projectsQuery.isLoading || tasksQuery.isLoading;
  const isError = projectsQuery.isError || tasksQuery.isError;
  const error = (projectsQuery.error ?? tasksQuery.error) as Error | null;

  const apiProjects = projectsQuery.data ?? [];
  const apiTasks = tasksQuery.data ?? [];

  const project = apiProjects.find((p) => p.id === projectId) ?? null;
  const projectTasks = apiTasks.filter((t) => t.projectId === projectId);

  const updateProjectMutation = useMutation({
    mutationFn: (input: {
      projectId: string;
      name: string;
      description: string;
      status: ProjectApiStatus;
      dueDate: string | null;
    }) =>
      updateProject(input.projectId, {
        name: input.name,
        description: input.description,
        status: input.status,
        dueDate: input.dueDate,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Project could not be updated",
      );
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      await router.navigate({ to: "/app/projects" });
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error ? mutationError.message : "Project could not be deleted";
      toast.error(message);
    },
  });

  const memberIds = Array.from(
    new Set(projectTasks.map((t) => t.assignee?.id).filter(Boolean) as string[]),
  );
  const initialsMap = Object.fromEntries(
    projectTasks
      .map((t) => t.assignee)
      .filter(Boolean)
      .map((a) => [a!.id, a!.avatar ?? initialsFromName(a!.name)] as const),
  );

  return (
    <AppShell title="Project">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/projects">
              <ChevronLeft className="size-4" /> Back to Projects
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {isLoading ? "Loading..." : (project?.name ?? "Project")}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading ? "Fetching project details" : "Read-only project details"}
            </p>
          </div>
        </div>
        {project ? (
          <div className="flex items-center gap-2">
            <EditProjectDialog
              project={project}
              isSubmitting={updateProjectMutation.isPending}
              onSubmit={async (values) => {
                await updateProjectMutation.mutateAsync({
                  projectId: project.id,
                  ...values,
                });
              }}
            />
            <DeleteProjectDialog
              projectName={project.name}
              isSubmitting={deleteProjectMutation.isPending}
              onConfirm={async () => {
                await deleteProjectMutation.mutateAsync(project.id);
              }}
            />
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void projectsQuery.refetch();
            void tasksQuery.refetch();
          }}
        />
      ) : !project ? (
        <NotFoundState />
      ) : (
        <ProjectDetails
          project={project}
          projectTasks={projectTasks}
          memberIds={memberIds}
          initialsMap={initialsMap}
        />
      )}
    </AppShell>
  );
}

function EditProjectDialog({
  project,
  isSubmitting,
  onSubmit,
}: {
  project: ProjectApiItem;
  isSubmitting: boolean;
  onSubmit: (values: {
    name: string;
    description: string;
    status: ProjectApiStatus;
    dueDate: string | null;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const initial = useMemo(
    () => ({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      dueDate: project.dueDate ? project.dueDate.slice(0, 10) : "",
    }),
    [project.description, project.dueDate, project.name, project.status],
  );

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState<ProjectApiStatus>(initial.status);
  const [dueDate, setDueDate] = useState(initial.dueDate);

  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setDescription(initial.description);
    setStatus(initial.status);
    setDueDate(initial.dueDate);
  }, [initial.description, initial.dueDate, initial.name, initial.status, open]);

  const isValid = name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update safe project fields in your workspace.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit({
              name: name.trim(),
              description: description.trim(),
              status,
              dueDate: dueDate ? dueDate : null,
            }).then(() => setOpen(false));
          }}
        >
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ProjectApiStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNING">Planning</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_HOLD">On hold</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  projectName,
  isSubmitting,
  onConfirm,
}: {
  projectName: string;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isSubmitting}>
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This will permanently delete <span className="font-medium">{projectName}</span>. If the
            project has tasks, you will be asked to delete or move them first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => {
              void onConfirm().then(() => setOpen(false));
            }}
          >
            {isSubmitting ? "Deleting..." : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDetails({
  project,
  projectTasks,
  memberIds,
  initialsMap,
}: {
  project: ProjectApiItem;
  projectTasks: TaskApiItem[];
  memberIds: string[];
  initialsMap: Record<string, string>;
}) {
  const status = projectStatusMeta[apiStatusMap[project.status]];
  const due = formatDate(project.dueDate);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div
                className={
                  "h-2 w-16 rounded-full bg-gradient-to-r " +
                  (project.color ?? "from-indigo-500 to-violet-500")
                }
              />
              <h2 className="mt-4 truncate text-xl font-semibold tracking-tight">{project.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{project.description || "—"}</p>
            </div>
            <Badge variant="secondary" className={status.className + " border-0"}>
              {status.label}
            </Badge>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Stat label="Status" value={status.label} />
            <Stat
              label="Due"
              value={
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5 text-muted-foreground" /> {due}
                </span>
              }
            />
            <Stat
              label="Tasks"
              value={
                <span className="inline-flex items-center gap-1">
                  <ListTodo className="size-3.5 text-muted-foreground" /> {project.openTasks} /{" "}
                  {project.totalTasks}
                </span>
              }
            />
            <Stat
              label="Members"
              value={
                memberIds.length > 0 ? (
                  <AvatarStack ids={memberIds} initialsMap={initialsMap} />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )
              }
            />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-medium text-foreground">{project.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={
                  "h-full rounded-full bg-gradient-to-r " +
                  (project.color ?? "from-indigo-500 to-violet-500")
                }
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="text-base font-semibold">Tasks</h3>
          <p className="mt-1 text-xs text-muted-foreground">Tasks that belong to this project</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            {projectTasks.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No tasks in this project yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {projectTasks.map((task) => (
                  <li key={task.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {task.key}
                          </span>
                          <span className="truncate text-sm font-medium">{task.title}</span>
                        </div>
                        {task.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={taskStatusTone[task.status] + " border-0 capitalize"}
                          >
                            {taskStatusLabel[task.status]}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={taskPriorityTone[task.priority] + " border-0 capitalize"}
                          >
                            {taskPriorityLabel[task.priority]}
                          </Badge>
                          {task.dueDate ? (
                            <span className="text-[11px] text-muted-foreground">
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <ProjectDocumentsCard projectId={project.id} />
    </div>
  );
}

function ProjectDocumentsCard({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentsQuery = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => fetchProjectDocuments(projectId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProjectDocument(projectId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Document uploaded");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Document could not be uploaded",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteProjectDocument(projectId, documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Document deleted");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Document could not be deleted",
      );
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <ProjectDocumentsSection
        documents={documentsQuery.data ?? []}
        isLoading={documentsQuery.isLoading}
        isError={documentsQuery.isError}
        isUploading={uploadMutation.isPending}
        isDeletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
        fileInputRef={fileInputRef}
        onPickFile={() => fileInputRef.current?.click()}
        onFileSelected={(file) => {
          if (uploadMutation.isPending) return;
          uploadMutation.mutate(file);
        }}
        onOpen={(document) => {
          openProjectDocument(document).catch(() => {
            toast.error("Could not open document");
          });
        }}
        onDownload={(document) => {
          downloadProjectDocumentFile(document).catch(() => {
            toast.error("Could not download document");
          });
        }}
        onDelete={(documentId) => {
          if (deleteMutation.isPending) {
            return Promise.reject(new Error("Delete already in progress"));
          }
          return deleteMutation.mutateAsync(documentId);
        }}
      />
    </div>
  );
}

function ProjectDocumentsSection({
  documents,
  isLoading,
  isError,
  isUploading,
  isDeletingId,
  fileInputRef,
  onPickFile,
  onFileSelected,
  onOpen,
  onDownload,
  onDelete,
}: {
  documents: ProjectDocumentApiItem[];
  isLoading: boolean;
  isError: boolean;
  isUploading: boolean;
  isDeletingId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: () => void;
  onFileSelected: (file: File) => void;
  onOpen: (document: ProjectDocumentApiItem) => void;
  onDownload: (document: ProjectDocumentApiItem) => void;
  onDelete: (documentId: string) => Promise<unknown>;
}) {
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const isDeletingSelected = documentToDelete != null && isDeletingId === documentToDelete;

  async function handleConfirmDelete() {
    if (!documentToDelete || isDeletingSelected) return;
    try {
      await onDelete(documentToDelete);
      setDocumentToDelete(null);
    } catch {
      // Toast is shown by the parent mutation.
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-muted-foreground" />
            Documents
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Briefs, specs, presentations, and other project files
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={isUploading}
          onClick={onPickFile}
        >
          {isUploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {isUploading ? "Uploading…" : "Upload document"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,application/pdf,image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              onFileSelected(file);
            }
          }}
        />
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Loading documents…
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-6 text-center text-sm text-destructive">
            Could not load documents. Try refreshing the page.
          </p>
        ) : documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No documents yet. Upload a PDF, image, or office file (up to 20 MB).
          </p>
        ) : (
          documents.map((document) => (
            <ProjectDocumentRow
              key={document.id}
              document={document}
              isDeleting={isDeletingId === document.id}
              onOpen={() => onOpen(document)}
              onDownload={() => onDownload(document)}
              onRequestDelete={() => setDocumentToDelete(document.id)}
            />
          ))
        )}
      </div>
      <AlertDialog
        open={documentToDelete != null}
        onOpenChange={(open) => {
          if (!open && !isDeletingSelected) {
            setDocumentToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-sm gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This file will be removed from the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSelected}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={isDeletingSelected}
              onClick={() => void handleConfirmDelete()}
            >
              <Trash2 className="size-4" />
              {isDeletingSelected ? "Deleting…" : "Delete document"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ProjectDocumentPreview({ document }: { document: ProjectDocumentApiItem }) {
  const isImage = isImageProjectDocument(document);
  const badge = getProjectDocumentFileTypeBadge(document.originalName, document.mimeType);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isImage) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setPreviewUrl(null);
    setFailed(false);

    fetchProjectDocumentBlob(document)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document.id, document.downloadUrl, document.url, isImage]);

  const previewClassName =
    "size-9 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary";

  if (isImage && previewUrl && !failed) {
    return (
      <div className={previewClassName}>
        <img src={previewUrl} alt="" className="size-full object-cover" loading="lazy" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        previewClassName,
        "grid place-items-center text-[10px] font-semibold text-muted-foreground",
      )}
    >
      {isImage && !failed && !previewUrl ? <Loader2 className="size-3.5 animate-spin" /> : badge}
    </div>
  );
}

function ProjectDocumentRow({
  document,
  isDeleting,
  onOpen,
  onDownload,
  onRequestDelete,
}: {
  document: ProjectDocumentApiItem;
  isDeleting: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/10 px-2.5 py-2">
      <ProjectDocumentPreview document={document} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{document.originalName}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{formatDocumentSize(document.size)}</span>
          <span>·</span>
          <span>{formatDocumentDate(document.createdAt)}</span>
          <span>·</span>
          <span>{document.uploader.name}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          disabled={isDeleting}
          aria-label="Open document"
          onClick={onOpen}
        >
          <ExternalLink className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          disabled={isDeleting}
          aria-label="Download document"
          onClick={onDownload}
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          disabled={isDeleting}
          aria-label="Delete document"
          onClick={onRequestDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function formatDocumentDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
        <div className="h-2 w-16 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-2 h-1.5 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-soft">
      <h3 className="text-base font-semibold">Could not load project</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ??
          "We could not reach the server. Check that the backend is running, then try again."}
      </p>
      <Button
        onClick={onRetry}
        className="mt-5 bg-gradient-brand text-white shadow-glow hover:opacity-95"
      >
        Retry
      </Button>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <h3 className="text-base font-semibold">Project not found</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        This projectId does not match any project in your workspace.
      </p>
      <Button variant="outline" className="mt-5" asChild>
        <Link to="/app/projects">Back to Projects</Link>
      </Button>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
