import { File, Image as ImageIcon, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NoteAttachment } from "@shared/schema";

interface AttachmentListProps {
  attachments: NoteAttachment[];
  onDelete?: (attachmentId: string) => void;
  canDelete?: boolean;
}

export function AttachmentList({ attachments, onDelete, canDelete }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  const getFileIcon = (mimeType: string | null) => {
    if (mimeType?.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (attachment: NoteAttachment) => {
    if (attachment.filePath) {
      window.open(attachment.filePath, "_blank");
    }
  };

  return (
    <div className="mt-3 space-y-2" data-testid="attachment-list">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Attachments ({attachments.length})
      </p>
      <div className="grid gap-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-2 p-2 bg-muted rounded-lg group"
            data-testid={`attachment-${attachment.id}`}
          >
            {getFileIcon(attachment.mimeType)}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{attachment.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(attachment.sizeBytes)}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleDownload(attachment)}
                data-testid={`download-${attachment.id}`}
              >
                <Download className="h-4 w-4" />
              </Button>

              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onDelete(attachment.id)}
                  data-testid={`delete-${attachment.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
