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
    <div
      className="mt-2 flex w-full max-w-full flex-col gap-1.5"
      data-no-message-long-press=""
    >
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
        "flex w-full max-w-full min-w-0 items-start gap-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-2 text-left text-sm transition-colors",
        unavailable ? "opacity-70" : "hover:bg-muted/60",
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
      <ListTodo className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium">
          {unavailable ? t("chat.attachmentUnavailable") : attachment.title}
        </p>
        {!unavailable ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {[attachment.status, attachment.projectName].filter(Boolean).join(" · ")}
            {attachment.dueDate
              ? ` · ${new Date(attachment.dueDate).toLocaleDateString()}`
              : ""}
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
        "flex w-full max-w-full min-w-0 items-start gap-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-2 text-left text-sm transition-colors",
        unavailable ? "opacity-70" : "hover:bg-muted/60",
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
      <FolderKanban className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
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
