import { Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadChatAttachmentFile, type ChatFileAttachment } from "@/lib/api/chat";
import { formatAttachmentSize } from "@/lib/api/task-attachments";
import { friendlyChatErrorMessage } from "@/lib/chat-errors";
import { useI18n } from "@/lib/i18n";

export function ChatFileAttachmentCard({ attachment }: { attachment: ChatFileAttachment }) {
  const { t } = useI18n();
  const [downloading, setDownloading] = useState(false);

  return (
    <div className="flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-auxiliary/25 bg-auxiliary/7 px-2.5 py-2 text-sm shadow-sm">
      <FileText className="size-4 shrink-0 text-auxiliary" aria-hidden />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium" title={attachment.originalName}>
          {attachment.originalName}
        </p>
        {attachment.sizeBytes != null ? (
          <p className="text-[11px] text-muted-foreground">
            {formatAttachmentSize(attachment.sizeBytes)}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 lg:size-8"
        disabled={downloading}
        aria-label={t("chat.downloadFile")}
        onClick={() => {
          setDownloading(true);
          void downloadChatAttachmentFile(attachment.downloadUrl, attachment.originalName)
            .catch((error) => {
              toast.error(friendlyChatErrorMessage(error, t, "chat.downloadFailed"));
            })
            .finally(() => setDownloading(false));
        }}
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
      </Button>
    </div>
  );
}
