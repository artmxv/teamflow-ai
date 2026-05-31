import { useState, type ReactNode } from "react";
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
import {
  members,
  projects,
  type Priority,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskStatus,
} from "@/lib/mock-data";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters"),
  description: z.string().max(300, "Description must be 300 characters or less").optional(),
  status: z.enum(["planning", "active", "on_hold", "completed"]),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const taskSchema = z.object({
  title: z.string().trim().min(2, "Task title must be at least 2 characters"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]),
  assigneeId: z.string().min(1, "Assignee is required"),
  dueDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

type NewProjectDialogProps = {
  children: ReactNode;
  onCreate?: (project: Project) => void;
};

export function NewProjectDialog({ children, onCreate }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      status: "planning",
    },
  });

  function submit(values: ProjectFormValues) {
    onCreate?.({
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
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Create a mock project for this browser session.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <Field label="Project name" error={errors.name?.message}>
            <Input {...register("name")} placeholder="Orion launch" />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <Textarea
              {...register("description")}
              placeholder="What is this project about?"
            />
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => field.onChange(value as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              Create project
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
  onCreate?: (task: Task) => void;
};

export function NewTaskDialog({ children, initialStatus = "todo", onCreate }: NewTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: initialStatus,
      assigneeId: members[0].id,
      dueDate: "",
    },
  });

  function submit(values: TaskFormValues) {
    onCreate?.({
      id: `t-${Date.now()}`,
      key: `TF-${Math.floor(Math.random() * 900 + 100)}`,
      title: values.title.trim(),
      description: values.description?.trim() || "New task created from the mock UI.",
      status: values.status,
      priority: values.priority,
      assigneeId: values.assigneeId,
      projectId: projects[0].id,
      dueDate: values.dueDate || null,
      labels: ["New"],
      comments: [],
      checklist: [],
      activity: [{ id: "a1", text: "Task created from mock UI", at: "just now" }],
      attachments: [],
    });
    toast.success("Task created");
    reset({
      title: "",
      description: "",
      priority: "medium",
      status: initialStatus,
      assigneeId: members[0].id,
      dueDate: "",
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Add a mock task to the current view.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" error={errors.title?.message}>
            <Input {...register("title")} placeholder="Write release notes" />
          </Field>
          <Field label="Due date" error={errors.dueDate?.message}>
            <Input type="date" {...register("dueDate")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" error={errors.description?.message}>
              <Textarea
                {...register("description")}
                placeholder="Add context for the team"
              />
            </Field>
          </div>
          <Field label="Priority" error={errors.priority?.message}>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => field.onChange(value as Priority)}>
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
          <Field label="Status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => field.onChange(value as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">Todo</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Assignee" error={errors.assigneeId?.message}>
            <Controller
              control={control}
              name="assigneeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              Create task
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
