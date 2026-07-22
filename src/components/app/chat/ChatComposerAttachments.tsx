import { useQuery } from "@tanstack/react-query";
import {
  FileUp,
  FolderKanban,
  ListTodo,
  Paperclip,
  Search,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  CHAT_MAX_FILE_ATTACHMENTS,
  type PendingChatFile,
  type PendingChatProject,
  type PendingChatTask,
} from "@/lib/api/chat";
import { fetchProjects } from "@/lib/api/projects";
import { formatAttachmentSize } from "@/lib/api/task-attachments";
import { fetchTasks } from "@/lib/api/tasks";
import { useI18n } from "@/lib/i18n";
import { isUploadFileTooLarge, MAX_UPLOAD_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

type ChatComposerAttachmentsProps = {
  files: PendingChatFile[];
  tasks: PendingChatTask[];
  projects: PendingChatProject[];
  disabled?: boolean;
  onFilesChange: (files: PendingChatFile[]) => void;
  onTasksChange: (tasks: PendingChatTask[]) => void;
  onProjectsChange: (projects: PendingChatProject[]) => void;
  onValidationError: (message: string | null) => void;
};

export function ChatPendingAttachmentChips({
  files,
  tasks,
  projects,
  disabled,
  onFilesChange,
  onTasksChange,
  onProjectsChange,
}: Omit<ChatComposerAttachmentsProps, "onValidationError">) {
  const { t } = useI18n();
  const hasPending = files.length > 0 || tasks.length > 0 || projects.length > 0;
  if (!hasPending) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {files.map((item) => (
        <PendingChip
          key={item.key}
          label={item.file.name}
          meta={formatAttachmentSize(item.file.size)}
          removeLabel={t("chat.removeAttachment")}
          onRemove={() => onFilesChange(files.filter((file) => file.key !== item.key))}
          disabled={disabled}
        />
      ))}
      {tasks.map((task) => (
        <PendingChip
          key={`task-${task.id}`}
          label={task.title}
          meta={task.projectName ?? task.status}
          removeLabel={t("chat.removeAttachment")}
          onRemove={() => onTasksChange(tasks.filter((item) => item.id !== task.id))}
          disabled={disabled}
        />
      ))}
      {projects.map((project) => (
        <PendingChip
          key={`project-${project.id}`}
          label={project.name}
          meta={project.status ?? undefined}
          removeLabel={t("chat.removeAttachment")}
          onRemove={() => onProjectsChange(projects.filter((item) => item.id !== project.id))}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export function ChatAttachMenu({
  files,
  tasks,
  projects,
  disabled,
  onFilesChange,
  onTasksChange,
  onProjectsChange,
  onValidationError,
}: ChatComposerAttachmentsProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (!selected.length) {
            return;
          }

          const remainingSlots = CHAT_MAX_FILE_ATTACHMENTS - files.length;
          if (remainingSlots <= 0) {
            onValidationError(
              t("chat.validationTooManyFiles").replace(
                "{max}",
                String(CHAT_MAX_FILE_ATTACHMENTS),
              ),
            );
            return;
          }

          const next = [...files];
          for (const file of selected.slice(0, remainingSlots)) {
            if (!file.size) {
              onValidationError(t("chat.validationEmptyFile"));
              return;
            }
            if (isUploadFileTooLarge(file)) {
              onValidationError(
                t("chat.validationFileTooLarge").replace("{max}", String(MAX_UPLOAD_MB)),
              );
              return;
            }
            next.push({
              key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
              file,
            });
          }

          if (selected.length > remainingSlots) {
            onValidationError(
              t("chat.validationTooManyFiles").replace(
                "{max}",
                String(CHAT_MAX_FILE_ATTACHMENTS),
              ),
            );
          } else {
            onValidationError(null);
          }
          onFilesChange(next);
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground"
            disabled={disabled}
            aria-label={t("chat.attach")}
          >
            <Paperclip className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onSelect={() => {
              fileInputRef.current?.click();
            }}
          >
            <FileUp className="size-4" />
            {t("chat.attachFiles")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTaskPickerOpen(true)}>
            <ListTodo className="size-4" />
            {t("chat.attachTask")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setProjectPickerOpen(true)}>
            <FolderKanban className="size-4" />
            {t("chat.attachProject")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EntityPickerDialog
        open={taskPickerOpen}
        onOpenChange={setTaskPickerOpen}
        title={t("chat.attachTask")}
        searchPlaceholder={t("chat.searchTasks")}
        emptyLabel={t("chat.noTasksFound")}
        kind="task"
        selectedIds={new Set(tasks.map((task) => task.id))}
        onSelect={(item) => {
          if (tasks.some((task) => task.id === item.id)) {
            return;
          }
          onTasksChange([
            ...tasks,
            {
              id: item.id,
              title: item.title,
              status: item.status,
              projectName: item.subtitle,
            },
          ]);
          onValidationError(null);
        }}
      />

      <EntityPickerDialog
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        title={t("chat.attachProject")}
        searchPlaceholder={t("chat.searchProjects")}
        emptyLabel={t("chat.noProjectsFound")}
        kind="project"
        selectedIds={new Set(projects.map((project) => project.id))}
        onSelect={(item) => {
          if (projects.some((project) => project.id === item.id)) {
            return;
          }
          onProjectsChange([
            ...projects,
            {
              id: item.id,
              name: item.title,
              status: item.status,
            },
          ]);
          onValidationError(null);
        }}
      />
    </>
  );
}

function PendingChip({
  label,
  meta,
  removeLabel,
  onRemove,
  disabled,
}: {
  label: string;
  meta?: string;
  removeLabel: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-1 text-xs">
      <span className="truncate font-medium">{label}</span>
      {meta ? <span className="truncate text-muted-foreground">{meta}</span> : null}
      <button
        type="button"
        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel}
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

type PickerItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  status: string;
};

function EntityPickerDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  emptyLabel,
  kind,
  selectedIds,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder: string;
  emptyLabel: string;
  kind: "task" | "project";
  selectedIds: Set<string>;
  onSelect: (item: PickerItem) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: open && kind === "task",
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: open && kind === "project",
  });

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (kind === "task") {
      const list = (tasksQuery.data ?? [])
        .filter((task) => !selectedIds.has(task.id))
        .map((task) => ({
          id: task.id,
          title: task.title,
          subtitle: task.project.name,
          status: task.status,
        }));
      if (!normalized) {
        return list;
      }
      return list.filter(
        (item) =>
          item.title.toLowerCase().includes(normalized) ||
          (item.subtitle ?? "").toLowerCase().includes(normalized),
      );
    }

    const list = (projectsQuery.data ?? [])
      .filter((project) => !selectedIds.has(project.id))
      .map((project) => ({
        id: project.id,
        title: project.name,
        subtitle: null,
        status: project.status,
      }));
    if (!normalized) {
      return list;
    }
    return list.filter((item) => item.title.toLowerCase().includes(normalized));
  }, [kind, projectsQuery.data, query, selectedIds, tasksQuery.data]);

  const loading = kind === "task" ? tasksQuery.isLoading : projectsQuery.isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{searchPlaceholder}</DialogDescription>
        </DialogHeader>
        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("chat.loadingAttachments")}
            </p>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors hover:bg-muted",
                )}
                onClick={() => {
                  onSelect(item);
                  setQuery("");
                  onOpenChange(false);
                }}
              >
                <span className="truncate text-sm font-medium">{item.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[item.status, item.subtitle].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
