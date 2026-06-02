import { useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { useI18n, type TKey } from "@/lib/i18n";
import {
  members,
  projects,
  type Priority,
  type Project,
  type ProjectStatus,
  type TaskStatus,
} from "@/lib/mock-data";
import { type AssigneeOption, UNASSIGNED_ASSIGNEE_VALUE } from "@/lib/assignee-options";

type Translate = (key: TKey) => string;

const getProjectSchema = (t: Translate) =>
  z.object({
    name: z.string().trim().min(2, t("validation.projectNameMin")),
    description: z.string().max(300, t("validation.projectDescriptionMax")).optional(),
    status: z.enum(["planning", "active", "on_hold", "completed"]),
  });

type ProjectFormValues = z.infer<ReturnType<typeof getProjectSchema>>;

const getTaskSchema = (t: Translate) =>
  z.object({
    title: z.string().trim().min(2, t("validation.taskTitleMin")),
    description: z.string().max(500, t("validation.taskDescriptionMax")).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    status: z.enum(["backlog", "todo", "in_progress", "review", "done"]),
    assigneeId: z.string().optional(),
    dueDate: z.string().optional(),
  });

export type TaskFormValues = z.infer<ReturnType<typeof getTaskSchema>>;

type NewProjectDialogProps = {
  children: ReactNode;
  isSubmitting?: boolean;
  onCreate?: (project: Project) => void | Promise<void>;
};

export function NewProjectDialog({
  children,
  isSubmitting = false,
  onCreate,
}: NewProjectDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
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
    },
  });

  async function submit(values: ProjectFormValues) {
    try {
      await onCreate?.({
        id: `p-${Date.now()}`,
        name: values.name.trim(),
        description: values.description?.trim() || "New project created from the mock UI.",
        status: values.status,
        progress: 0,
        openTasks: 0,
        totalTasks: 0,
        members: [members[0].id],
        color: "from-indigo-500 to-violet-500",
        dueDate: "2026-12-31",
        updatedAt: "just now",
      });
      toast.success("Project created");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project could not be created");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("common.newProject")}</DialogTitle>
          <DialogDescription>Create a mock project for this browser session.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <Field label={t("common.newProject")} error={errors.name?.message}>
            <Input {...register("name")} placeholder="Orion launch" />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} placeholder="What is this project about?" />
          </Field>
          <Field label={t("tasks.status")} error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as ProjectStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">{t("projects.planning")}</SelectItem>
                    <SelectItem value="active">{t("projects.active")}</SelectItem>
                    <SelectItem value="on_hold">{t("projects.onHold")}</SelectItem>
                    <SelectItem value="completed">{t("projects.completed")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              {t("common.createProject")}
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
  assigneeOptions?: AssigneeOption[];
  onSubmit: (values: TaskFormValues) => Promise<void>;
};

export function NewTaskDialog({
  children,
  initialStatus = "todo",
  isSubmitting = false,
  assigneeOptions = [],
  onSubmit,
}: NewTaskDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(getTaskSchema(t)),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: initialStatus,
      assigneeId: undefined,
      dueDate: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      title: "",
      description: "",
      priority: "medium",
      status: initialStatus,
      assigneeId: undefined,
      dueDate: "",
    });
  }, [open, initialStatus, reset]);

  async function submit(values: TaskFormValues) {
    try {
      // New tasks must use real API user ids (backend rejects mock ids).
      const normalizedAssigneeId =
        values.assigneeId && assigneeOptions.some((option) => option.id === values.assigneeId)
          ? values.assigneeId
          : undefined;
      await onSubmit({ ...values, assigneeId: normalizedAssigneeId });
      reset({
        title: "",
        description: "",
        priority: "medium",
        status: initialStatus,
        assigneeId: undefined,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("common.newTask")}</DialogTitle>
          <DialogDescription>Add a mock task to the current view.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("tasks.task")} error={errors.title?.message}>
              <Input {...register("title")} placeholder="Write release notes" />
            </Field>
            <Field label={t("tasks.dueDate")} error={errors.dueDate?.message}>
              <Input type="date" className="date-input-native" {...register("dueDate")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" error={errors.description?.message}>
                <Textarea {...register("description")} placeholder="Add context for the team" />
              </Field>
            </div>
            <Field label={t("tasks.priority")} error={errors.priority?.message}>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as Priority)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={t("tasks.status")} error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as TaskStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
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
            <Field label={t("tasks.assignee")} error={errors.assigneeId?.message}>
              <Controller
                control={control}
                name="assigneeId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? UNASSIGNED_ASSIGNEE_VALUE}
                    onValueChange={(value) => {
                      field.onChange(value === UNASSIGNED_ASSIGNEE_VALUE ? undefined : value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_ASSIGNEE_VALUE}>Unassigned</SelectItem>
                      {assigneeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              {isSubmitting ? "Creating..." : t("common.createTask")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
