import { useEffect, useMemo, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AssigneeMultiPicker } from "@/components/app/AssigneeMultiPicker";
import { UserAvatar } from "@/components/app/UserAvatar";
import { DeadlineDatePicker } from "@/components/app/DeadlineDatePicker";
import { DeadlineTimePicker } from "@/components/app/DeadlineTimePicker";
import { deadlineStatusDateTimeRowClassName } from "@/components/app/deadline-field-styles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addProjectMember, fetchProjectMembers } from "@/lib/api/project-members";
import { createProject, type ProjectApiItem, type ProjectApiStatus } from "@/lib/api/projects";
import { fetchWorkspaceMembers } from "@/lib/api/workspace-members";
import { useCurrentWorkspace } from "@/lib/auth/use-current-user";
import { resolveEditAssigneeOptions } from "@/lib/assignee-options";
import { useI18n, type TKey } from "@/lib/i18n";
import { friendlyApiErrorMessage } from "@/lib/api-error";
import { dueDateTimeToIso } from "@/lib/due-datetime";
import { invalidateWorkspaceContentQueries } from "@/lib/workspace-queries";
import { type Priority, type ProjectStatus, type TaskStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Translate = (key: TKey) => string;

const dueDateTimeRefine = <T extends { dueDate?: string; dueTime?: string }>(
  t: Translate,
  schema: z.ZodType<T>,
) =>
  schema.superRefine((data, ctx) => {
    const hasDate = Boolean(data.dueDate?.trim());
    const hasTime = Boolean(data.dueTime?.trim());
    if (hasDate && !hasTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.dueTimeRequired"),
        path: ["dueTime"],
      });
    }
    if (hasTime && !hasDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.dueDateRequired"),
        path: ["dueDate"],
      });
    }
  });

const getProjectSchema = (t: Translate) =>
  dueDateTimeRefine(
    t,
    z.object({
      name: z.string().trim().min(2, t("validation.projectNameMin")),
      description: z.string().max(300, t("validation.projectDescriptionMax")).optional(),
      status: z.enum(["planning", "active", "on_hold", "completed"]),
      dueDate: z.string().optional(),
      dueTime: z.string().optional(),
    }),
  );

export type NewProjectFormValues = z.infer<ReturnType<typeof getProjectSchema>> & {
  memberUserIds: string[];
};

type ProjectFormValues = z.infer<ReturnType<typeof getProjectSchema>>;

const projectStatusToApi: Record<ProjectStatus, ProjectApiStatus> = {
  active: "ACTIVE",
  planning: "PLANNING",
  on_hold: "ON_HOLD",
  completed: "COMPLETED",
};

const getTaskSchema = (t: Translate) =>
  dueDateTimeRefine(
    t,
    z.object({
      title: z.string().trim().min(2, t("validation.taskTitleMin")),
      description: z.string().max(500, t("validation.taskDescriptionMax")).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      status: z.enum(["backlog", "todo", "in_progress", "review", "done"]),
      assigneeIds: z.array(z.string()).optional(),
      dueDate: z.string().optional(),
      dueTime: z.string().optional(),
    }),
  );

export type TaskFormValues = z.infer<ReturnType<typeof getTaskSchema>> & {
  projectId?: string;
};

type NewProjectDialogProps = {
  children: ReactNode;
  workspaceId?: string;
  onCreated?: (project: ProjectApiItem) => void | Promise<void>;
};

export function NewProjectDialog({ children, workspaceId, onCreated }: NewProjectDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: authWorkspace } = useCurrentWorkspace();
  const resolvedWorkspaceId = workspaceId ?? authWorkspace?.id;
  const [open, setOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(getProjectSchema(t)),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      status: "planning",
      dueDate: "",
      dueTime: "",
    },
  });

  const workspaceMembersQuery = useQuery({
    queryKey: ["workspace-members"],
    queryFn: fetchWorkspaceMembers,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      if (!resolvedWorkspaceId) {
        throw new Error(t("projects.new.workspaceRequired"));
      }

      const project = await createProject({
        workspaceId: resolvedWorkspaceId,
        name: values.name.trim(),
        description: values.description?.trim() ?? "",
        status: projectStatusToApi[values.status],
        dueDate: dueDateTimeToIso(values.dueDate, values.dueTime),
      });

      const memberResults = await Promise.allSettled(
        selectedMemberIds.map((userId) => addProjectMember(project.id, userId)),
      );
      const failedCount = memberResults.filter((result) => result.status === "rejected").length;

      return { project, failedCount, memberCount: selectedMemberIds.length };
    },
    onSuccess: async ({ project, failedCount, memberCount }) => {
      await invalidateWorkspaceContentQueries(queryClient, resolvedWorkspaceId);

      if (memberCount > 0 && failedCount > 0) {
        toast.warning(t("projects.new.membersPartialWarning"));
      } else {
        toast.success(t("projects.new.created"));
      }

      await onCreated?.(project);
      resetForm();
      setOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Only workspace owners and admins can create projects")) {
        toast.error(t("access.createProjectDenied"));
        return;
      }
      toast.error(friendlyApiErrorMessage(error, t, "projects.new.createFailed"));
    },
  });

  function resetForm() {
    reset({
      name: "",
      description: "",
      status: "planning",
      dueDate: "",
      dueTime: "",
    });
    setSelectedMemberIds([]);
  }

  useEffect(() => {
    if (!open) return;
    reset({
      name: "",
      description: "",
      status: "planning",
      dueDate: "",
      dueTime: "",
    });
    setSelectedMemberIds([]);
  }, [open, reset]);

  function toggleMember(userId: string, checked: boolean) {
    setSelectedMemberIds((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
    );
  }

  async function submit(values: ProjectFormValues) {
    await createMutation.mutateAsync(values);
  }

  const workspaceMembers = workspaceMembersQuery.data ?? [];
  const isSubmitting = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("common.newProject")}</DialogTitle>
          <DialogDescription>{t("projects.new.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <Field label={t("projects.new.projectName")} error={errors.name?.message}>
            <Input {...register("name")} placeholder={t("projects.new.namePlaceholder")} />
          </Field>
          <Field label={t("projects.new.description")} error={errors.description?.message}>
            <Textarea
              {...register("description")}
              placeholder={t("projects.new.description")}
              rows={3}
            />
          </Field>
          <div className={deadlineStatusDateTimeRowClassName}>
            <Field
              className="min-w-0"
              label={t("projects.new.status")}
              error={errors.status?.message}
            >
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "planning"}
                    onValueChange={(value) => field.onChange(value as ProjectStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("projects.new.status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">{t("projects.statusPlanning")}</SelectItem>
                      <SelectItem value="active">{t("projects.statusActive")}</SelectItem>
                      <SelectItem value="on_hold">{t("projects.statusOnHold")}</SelectItem>
                      <SelectItem value="completed">{t("projects.statusCompleted")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              className="min-w-0"
              label={t("projects.new.dueDate")}
              error={errors.dueDate?.message}
            >
              <Controller
                control={control}
                name="dueDate"
                render={({ field }) => (
                  <DeadlineDatePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    aria-label={t("projects.new.dueDate")}
                    aria-invalid={Boolean(errors.dueDate)}
                  />
                )}
              />
            </Field>
            <Field
              className="min-w-0"
              label={t("projects.new.dueTime")}
              labelClassName="whitespace-nowrap"
              error={errors.dueTime?.message}
            >
              <Controller
                control={control}
                name="dueTime"
                render={({ field }) => (
                  <DeadlineTimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    aria-label={t("projects.new.dueTime")}
                    aria-invalid={Boolean(errors.dueTime)}
                  />
                )}
              />
            </Field>
          </div>
          <div className="space-y-2">
            <div>
              <Label>{t("projects.new.members")}</Label>
              <p className="text-xs text-muted-foreground">{t("projects.new.selectMembers")}</p>
            </div>
            <div className="app-scrollbar max-h-44 overflow-y-auto rounded-xl border border-border">
              {workspaceMembersQuery.isLoading ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : workspaceMembers.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("projects.new.noTeammates")}
                </p>
              ) : (
                <ul className="divide-y divide-border p-1">
                  {workspaceMembers.map((member) => {
                    const checked = selectedMemberIds.includes(member.id);
                    const checkboxId = `new-project-member-${member.id}`;
                    return (
                      <li key={member.id}>
                        <label
                          htmlFor={checkboxId}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50",
                            checked && "bg-muted/40",
                          )}
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            disabled={isSubmitting}
                            onCheckedChange={(value) => toggleMember(member.id, value === true)}
                          />
                          <UserAvatar
                            id={member.id}
                            name={member.name}
                            avatar={member.avatar}
                            avatarUrl={member.avatarUrl}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {member.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {member.email}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("projects.new.membersHintLater")}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting || !resolvedWorkspaceId}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              {isSubmitting ? t("projects.new.creating") : t("common.createProject")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type NewTaskDialogProps = {
  children: ReactNode;
  initialStatus?: TaskStatus;
  isSubmitting?: boolean;
  fixedProjectId?: string;
  projectOptions?: { id: string; name: string }[];
  onSubmit: (values: TaskFormValues) => Promise<void>;
};

export function NewTaskDialog({
  children,
  initialStatus = "todo",
  isSubmitting = false,
  fixedProjectId,
  projectOptions,
  onSubmit,
}: NewTaskDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(
    fixedProjectId ?? projectOptions?.[0]?.id ?? "",
  );
  const projectSelectValue = selectedProjectId || projectOptions?.[0]?.id || "__no_project__";
  const showProjectSelect = !!projectOptions && projectOptions.length > 0 && !fixedProjectId;
  const effectiveProjectId = fixedProjectId ?? (showProjectSelect ? selectedProjectId : undefined);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(getTaskSchema(t)),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: initialStatus,
      assigneeIds: [],
      dueDate: "",
      dueTime: "",
    },
  });

  const watchedAssigneeIds = useWatch({ control, name: "assigneeIds" }) ?? [];

  const projectMembersQuery = useQuery({
    queryKey: ["project-members", effectiveProjectId],
    queryFn: () => fetchProjectMembers(effectiveProjectId!),
    enabled: open && !!effectiveProjectId,
  });

  const workspaceMembersQuery = useQuery({
    queryKey: ["workspace-members"],
    queryFn: fetchWorkspaceMembers,
    enabled: open,
  });

  const resolvedAssigneeOptions = useMemo(
    () => resolveEditAssigneeOptions(projectMembersQuery.data, workspaceMembersQuery.data),
    [projectMembersQuery.data, workspaceMembersQuery.data],
  );

  const assigneeOptionsLoading =
    !!effectiveProjectId &&
    (projectMembersQuery.isLoading ||
      ((projectMembersQuery.data?.length ?? 0) === 0 && workspaceMembersQuery.isLoading));

  useEffect(() => {
    if (!open) return;
    const validIds = new Set(resolvedAssigneeOptions.map((option) => option.id));
    const filtered = watchedAssigneeIds.filter((id) => validIds.has(id));
    if (filtered.length !== watchedAssigneeIds.length) {
      setValue("assigneeIds", filtered, { shouldValidate: true });
    }
  }, [open, resolvedAssigneeOptions, setValue, watchedAssigneeIds]);

  useEffect(() => {
    if (!open) return;
    setSelectedProjectId(fixedProjectId ?? projectOptions?.[0]?.id ?? "");
    reset({
      title: "",
      description: "",
      priority: "medium",
      status: initialStatus,
      assigneeIds: [],
      dueDate: "",
      dueTime: "",
    });
  }, [open, initialStatus, fixedProjectId, projectOptions, reset]);

  async function submit(values: TaskFormValues) {
    try {
      const targetProjectId =
        fixedProjectId ?? (showProjectSelect ? selectedProjectId : values.projectId);
      if (!targetProjectId) {
        toast.error(t("tasks.projectRequired"));
        throw new Error("Project is required.");
      }

      const normalizedAssigneeIds = (values.assigneeIds ?? []).filter((id) =>
        resolvedAssigneeOptions.some((option) => option.id === id),
      );
      await onSubmit({
        ...values,
        dueDate: dueDateTimeToIso(values.dueDate, values.dueTime) ?? "",
        assigneeIds: normalizedAssigneeIds,
        projectId: targetProjectId,
      });
      reset({
        title: "",
        description: "",
        priority: "medium",
        status: initialStatus,
        assigneeIds: [],
        dueDate: "",
      });
      setOpen(false);
    } catch {
      // Parent handles toasts and validation errors.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        closeClassName="top-5 right-5"
        className="flex max-h-[min(90vh,640px)] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="shrink-0 space-y-1 px-6 pb-3 pt-7 pr-12">
          <DialogTitle>{t("common.newTask")}</DialogTitle>
          <DialogDescription>{t("tasks.new.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 pb-4 pt-1">
          {showProjectSelect ? (
            <Field label={t("tasks.selectProject")}>
              <Select
                value={projectSelectValue}
                onValueChange={(value) => {
                  if (value !== "__no_project__") {
                    setSelectedProjectId(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("tasks.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <div className="space-y-3">
            <Field label={t("tasks.task")} error={errors.title?.message}>
              <Input {...register("title")} placeholder={t("tasks.new.titlePlaceholder")} />
            </Field>
            <div className={deadlineStatusDateTimeRowClassName}>
              <Field
                className="min-w-0"
                label={t("tasks.status")}
                error={errors.status?.message}
              >
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? initialStatus}
                      onValueChange={(value) => field.onChange(value as TaskStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("tasks.new.selectStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">{t("board.backlog")}</SelectItem>
                        <SelectItem value="todo">{t("board.todo")}</SelectItem>
                        <SelectItem value="in_progress">{t("board.inProgress")}</SelectItem>
                        <SelectItem value="review">{t("board.review")}</SelectItem>
                        <SelectItem value="done">{t("board.done")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                className="min-w-0"
                label={t("tasks.dueDate")}
                error={errors.dueDate?.message}
              >
                <Controller
                  control={control}
                  name="dueDate"
                  render={({ field }) => (
                    <DeadlineDatePicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      aria-label={t("tasks.dueDate")}
                      aria-invalid={Boolean(errors.dueDate)}
                    />
                  )}
                />
              </Field>
              <Field
                className="min-w-0"
                label={t("tasks.dueTime")}
                labelClassName="whitespace-nowrap"
                error={errors.dueTime?.message}
              >
                <Controller
                  control={control}
                  name="dueTime"
                  render={({ field }) => (
                    <DeadlineTimePicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      aria-label={t("tasks.dueTime")}
                      aria-invalid={Boolean(errors.dueTime)}
                    />
                  )}
                />
              </Field>
            </div>
            <Field label={t("tasks.description")} error={errors.description?.message}>
              <Textarea
                {...register("description")}
                rows={2}
                className="min-h-[52px] resize-none"
                placeholder={t("tasks.new.descriptionPlaceholder")}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("tasks.priority")} error={errors.priority?.message}>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "medium"}
                      onValueChange={(value) => field.onChange(value as Priority)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("tasks.new.selectPriority")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t("tasks.priorityLow")}</SelectItem>
                        <SelectItem value="medium">{t("tasks.priorityMedium")}</SelectItem>
                        <SelectItem value="high">{t("tasks.priorityHigh")}</SelectItem>
                        <SelectItem value="urgent">{t("tasks.priorityUrgent")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("tasks.assignees")} error={errors.assigneeIds?.message}>
                  <Controller
                    control={control}
                    name="assigneeIds"
                    render={({ field }) => (
                      <AssigneeMultiPicker
                        compact
                        options={resolvedAssigneeOptions}
                        value={field.value ?? []}
                        disabled={isSubmitting}
                        isLoading={assigneeOptionsLoading}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </Field>
              </div>
            </div>
          </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting || (showProjectSelect && !selectedProjectId)}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              {isSubmitting ? t("tasks.new.creating") : t("common.createTask")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
  className,
  labelClassName,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col items-stretch gap-1.5", className)}>
      <Label className={cn("block h-4 leading-none", labelClassName)}>{label}</Label>
      {children}
      {error ? <p className="text-xs leading-4 text-destructive">{error}</p> : null}
    </div>
  );
}
