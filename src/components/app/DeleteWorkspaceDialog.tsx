import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiError, setSelectedWorkspaceId } from "@/lib/api/client";
import { deleteWorkspace } from "@/lib/api/workspaces";
import { useI18n } from "@/lib/i18n";
import { invalidateWorkspaceScopedQueries } from "@/lib/workspace-queries";

type DeleteWorkspaceDialogProps = {
  workspaceId: string;
  children: ReactNode;
};

export function DeleteWorkspaceDialog({ workspaceId, children }: DeleteWorkspaceDialogProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: async (result) => {
      if (result.fallbackWorkspace) {
        setSelectedWorkspaceId(result.fallbackWorkspace.id);
      }
      await invalidateWorkspaceScopedQueries(queryClient);
      toast.success(t("workspace.deleted"));
      setOpen(false);
      void navigate({ to: "/app/dashboard" });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === "LAST_WORKSPACE_CANNOT_BE_DELETED") {
          toast.error(t("workspace.deleteLastWorkspace"));
          return;
        }
        if (error.status === 403) {
          toast.error(t("workspace.deleteNotOwner"));
          return;
        }
      }
      toast.error(t("workspace.deleteFailed"));
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("workspace.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("workspace.deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {mutation.isPending ? t("common.loading") : t("workspace.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
