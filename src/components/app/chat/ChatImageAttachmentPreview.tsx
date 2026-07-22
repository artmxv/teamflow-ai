import {
  downloadChatAttachmentFile,
  fetchChatAttachmentBlob,
  type ChatFileAttachment,
} from "@/lib/api/chat";
import { AuthenticatedImagePreview } from "@/components/app/files/AuthenticatedImagePreview";
import { cn } from "@/lib/utils";

import { ChatFileAttachmentCard } from "./ChatFileAttachmentCard";

type ChatImageAttachmentPreviewProps = {
  attachment: ChatFileAttachment;
  className?: string;
};

export function ChatImageAttachmentPreviewGrid({
  attachments,
}: {
  attachments: ChatFileAttachment[];
}) {
  if (!attachments.length) {
    return null;
  }

  const gridClassName =
    attachments.length === 1
      ? "grid-cols-1"
      : attachments.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={cn("grid w-full max-w-sm gap-1", gridClassName)}>
      {attachments.map((attachment) => (
        <ChatImageAttachmentPreview key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

export function ChatImageAttachmentPreview({
  attachment,
  className,
}: ChatImageAttachmentPreviewProps) {
  return (
    <AuthenticatedImagePreview
      downloadUrl={attachment.downloadUrl}
      filename={attachment.originalName}
      mimeType={attachment.mimeType ?? ""}
      className={cn("min-h-[88px] min-w-[88px]", className)}
      imageClassName="max-h-72 max-w-full"
      objectFit="contain"
      fetchBlob={() => fetchChatAttachmentBlob(attachment.downloadUrl)}
      onDownload={() =>
        downloadChatAttachmentFile(attachment.downloadUrl, attachment.originalName)
      }
      fallback={<ChatFileAttachmentCard attachment={attachment} />}
    />
  );
}
