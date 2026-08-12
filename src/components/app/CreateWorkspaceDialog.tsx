import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
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
import { ApiError, setSelectedWorkspaceId } from "@/lib/api/client";
import { createWorkspace } from "@/lib/api/workspaces";
import { useI18n, type TKey } from "@/lib/i18n";
import { invalidateWorkspaceScopedQueries } from "@/lib/workspace-queries";
import { getWorkspaceAccent } from "@/lib/workspace-color";
import { nameToInitials } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

const TEAM_SIZE_SELECT_EMPTY = "__unset__";

const TEAM_SIZE_OPTIONS: { value: string; labelKey: TKey }[] = [
  { value: "0-5", labelKey: "settings.teamSize0to5" },
  { value: "6-10", labelKey: "settings.teamSize6to10" },
  { value: "11-20", labelKey: "settings.teamSize11to20" },
  { value: "21-50", labelKey: "settings.teamSize21to50" },
  { value: "51+", labelKey: "settings.teamSize51plus" },
];

const getSchema = () =>
  z.object({
    name: z.string().trim().min(2),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]*$/)
      .optional(),
    teamSize: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof getSchema>>;

type CreateWorkspaceDialogProps = {
  children: ReactNode;
};

export function CreateWorkspaceDialog({ children }: CreateWorkspaceDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const {
    formState: { errors, isValid, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(getSchema()),
    mode: "onChange",
    defaultValues: {
      name: "",
      slug: "",
      teamSize: "",
    },
  });

  const teamSize = watch("teamSize");
  const workspaceName = watch("name");
  const workspaceSlug = watch("slug");
  const previewAccent = getWorkspaceAccent({
    slug: workspaceSlug?.trim() || undefined,
    name: workspaceName?.trim() || undefined,
  });
  const previewInitials = workspaceName?.trim() ? nameToInitials(workspaceName.trim()) : "WS";

  const mutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async (workspace) => {
      setSelectedWorkspaceId(workspace.id);
      await invalidateWorkspaceScopedQueries(queryClient);
      toast.success(t("workspace.created"));
      setOpen(false);
      reset();
      void navigate({ to: "/app/dashboard" });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === "WORKSPACE_LIMIT_REACHED") {
          toast.error(t("workspace.limitReached"));
          return;
        }
        if (error.status === 403) {
          toast.error(t("workspace.createDenied"));
          return;
        }
        if (error.status === 409 && error.message.toLowerCase().includes("address")) {
          toast.error(t("workspace.slugTaken"));
          return;
        }
      }
      toast.error(t("workspace.createFailed"));
    },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate({
      name: values.name.trim(),
      slug: values.slug?.trim() || undefined,
      teamSize: values.teamSize || undefined,
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("workspace.createWorkspace")}</DialogTitle>
          <DialogDescription>{t("workspace.subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-xs font-semibold text-white shadow-sm",
                previewAccent.gradient,
              )}
            >
              {previewInitials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {workspaceName?.trim() || t("workspace.name")}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {workspaceSlug?.trim()
                  ? `${workspaceSlug.trim()}.teamflow.app`
                  : t("workspace.address")}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-name">{t("workspace.name")}</Label>
            <Input id="workspace-name" {...register("name")} autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-slug">{t("workspace.address")}</Label>
            <Input
              id="workspace-slug"
              {...register("slug")}
              placeholder="my-team"
              className="font-mono text-sm"
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-team-size">{t("settings.teamSize")}</Label>
            <Select
              value={teamSize ? teamSize : TEAM_SIZE_SELECT_EMPTY}
              onValueChange={(value) =>
                setValue("teamSize", value === TEAM_SIZE_SELECT_EMPTY ? "" : value, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="workspace-team-size">
                <SelectValue placeholder={t("settings.teamSize")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TEAM_SIZE_SELECT_EMPTY}>—</SelectItem>
                {TEAM_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={!isValid || isSubmitting || mutation.isPending}
            >
              {mutation.isPending ? t("common.loading") : t("workspace.createWorkspace")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
