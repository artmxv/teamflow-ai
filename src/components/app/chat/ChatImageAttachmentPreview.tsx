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
  onPreviewLayoutSettle?: () => void;
};

export function ChatImageAttachmentPreviewGrid({
  attachments,
  onPreviewLayoutSettle,
}: {
  attachments: ChatFileAttachment[];
  onPreviewLayoutSettle?: () => void;
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
        <ChatImageAttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onPreviewLayoutSettle={onPreviewLayoutSettle}
        />
      ))}
    </div>
  );
}

export function ChatImageAttachmentPreview({
  attachment,
  className,
  onPreviewLayoutSettle,
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
      onPreviewLayoutSettle={onPreviewLayoutSettle}
      fallback={<ChatFileAttachmentCard attachment={attachment} />}
    />
  );
}
