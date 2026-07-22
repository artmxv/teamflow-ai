import {
  isChatImagePreviewAttachment,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/api/chat";

export type PinnedAttachmentPreviewLabels = {
  image: string;
  file: string;
  task: string;
  project: string;
};

/**
 * Short preview for a pinned message row.
 * Prefers text; otherwise a single attachment-type label.
 */
export function buildPinnedMessagePreview(
  message: Pick<ChatMessage, "content" | "attachments">,
  labels: PinnedAttachmentPreviewLabels,
): string {
  const trimmed = message.content.trim();
  if (trimmed) {
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }

  const attachments = message.attachments ?? [];
  if (attachments.length === 0) {
    return "";
  }

  const first = attachments[0]!;
  return labelForPinnedAttachment(first, labels);
}

function labelForPinnedAttachment(
  attachment: ChatAttachment,
  labels: PinnedAttachmentPreviewLabels,
): string {
  if (attachment.type === "TASK") {
    return labels.task;
  }
  if (attachment.type === "PROJECT") {
    return labels.project;
  }
  if (attachment.type === "FILE" && isChatImagePreviewAttachment(attachment)) {
    return labels.image;
  }
  return labels.file;
}
