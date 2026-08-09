import { useNavigate } from "@tanstack/react-router";
import { FolderKanban, ListTodo } from "lucide-react";

import {
  type ChatAttachment,
  type ChatFileAttachment,
  type ChatProjectAttachment,
  type ChatTaskAttachment,
  isChatImagePreviewAttachment,
} from "@/lib/api/chat";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ChatFileAttachmentCard } from "./ChatFileAttachmentCard";
import { ChatImageAttachmentPreviewGrid } from "./ChatImageAttachmentPreview";

type ChatMessageAttachmentsProps = {
  attachments: ChatAttachment[];
  onPreviewLayoutSettle?: () => void;
};

type AttachmentGroup = ChatAttachment | ChatFileAttachment[];

function groupChatAttachments(attachments: ChatAttachment[]): AttachmentGroup[] {
  const groups: AttachmentGroup[] = [];
  let imageBatch: ChatFileAttachment[] = [];

  const flushImages = () => {
    if (imageBatch.length > 0) {
      groups.push([...imageBatch]);
      imageBatch = [];
    }
  };

  for (const attachment of attachments) {
    if (attachment.type === "FILE" && isChatImagePreviewAttachment(attachment)) {
      imageBatch.push(attachment);
      continue;
    }
    flushImages();
    groups.push(attachment);
  }

  flushImages();
  return groups;
}

export function ChatMessageAttachments({
  attachments,
  onPreviewLayoutSettle,
}: ChatMessageAttachmentsProps) {
  if (!attachments.length) {
    return null;
  }

  const groups = groupChatAttachments(attachments);

  return (
    <div className="mt-2 flex w-full max-w-full flex-col gap-1.5" data-no-message-long-press="">
      {groups.map((group) => {
        if (Array.isArray(group)) {
          return (
            <ChatImageAttachmentPreviewGrid
              key={group.map((item) => item.id).join("-")}
              attachments={group}
              onPreviewLayoutSettle={onPreviewLayoutSettle}
            />
          );
        }
        if (group.type === "FILE") {
          return <ChatFileAttachmentCard key={group.id} attachment={group} />;
        }
        if (group.type === "TASK") {
          return <TaskAttachmentCard key={group.id} attachment={group} />;
        }
        return <ProjectAttachmentCard key={group.id} attachment={group} />;
      })}
    </div>
  );
}

function TaskAttachmentCard({ attachment }: { attachment: ChatTaskAttachment }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const unavailable = attachment.unavailable || !attachment.taskId;

  return (
    <button
      type="button"
      disabled={unavailable}
      className={cn(
        "flex w-full max-w-full min-w-0 items-start gap-2 rounded-lg border border-primary/25 bg-linear-to-br from-primary/10 to-accent/60 px-2.5 py-2 text-left text-sm outline-none transition-[border-color,background-color,box-shadow] focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/20",
        unavailable
          ? "opacity-70"
          : "hover:border-primary/40 hover:from-primary/15 hover:to-accent/75",
      )}
      onClick={() => {
        if (!attachment.taskId) {
          return;
        }
        void navigate({
          to: "/app/tasks",
          search: { taskId: attachment.taskId },
        });
      }}
    >
      <ListTodo className="mt-0.5 size-4 shrink-0 text-primary/85" aria-hidden />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium">
          {unavailable ? t("chat.attachmentUnavailable") : attachment.title}
        </p>
        {!unavailable ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {[attachment.status, attachment.projectName].filter(Boolean).join(" · ")}
            {attachment.dueDate ? ` · ${new Date(attachment.dueDate).toLocaleDateString()}` : ""}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function ProjectAttachmentCard({ attachment }: { attachment: ChatProjectAttachment }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const unavailable = attachment.unavailable || !attachment.projectId;

  return (
    <button
      type="button"
      disabled={unavailable}
      className={cn(
        "flex w-full max-w-full min-w-0 items-start gap-2 rounded-lg border border-auxiliary/30 bg-linear-to-br from-auxiliary/12 to-secondary/65 px-2.5 py-2 text-left text-sm outline-none transition-[border-color,background-color,box-shadow] focus-visible:border-auxiliary/50 focus-visible:ring-2 focus-visible:ring-auxiliary/20",
        unavailable
          ? "opacity-70"
          : "hover:border-auxiliary/45 hover:from-auxiliary/18 hover:to-secondary/80",
      )}
      onClick={() => {
        if (!attachment.projectId) {
          return;
        }
        void navigate({
          to: "/app/projects/$projectId",
          params: { projectId: attachment.projectId },
        });
      }}
    >
      <FolderKanban className="mt-0.5 size-4 shrink-0 text-auxiliary" aria-hidden />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium">
          {unavailable ? t("chat.attachmentUnavailable") : attachment.name}
        </p>
        {!unavailable && attachment.status ? (
          <p className="truncate text-[11px] text-muted-foreground">{attachment.status}</p>
        ) : null}
      </div>
    </button>
  );
}
