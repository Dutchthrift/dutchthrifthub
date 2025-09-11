import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, Download, FileIcon, Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string | null;
  size: number | null;
  storageUrl: string;
  isInline: boolean;
}

interface EmailAttachmentsProps {
  messageId: string;
}

export function EmailAttachments({ messageId }: EmailAttachmentsProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<EmailAttachment | null>(null);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['email-attachments', messageId],
    queryFn: async (): Promise<EmailAttachment[]> => {
      const response = await fetch(`/api/emails/${messageId}/attachments`);
      if (!response.ok) {
        throw new Error('Failed to fetch attachments');
      }
      return response.json();
    },
  });

  const handlePreview = (attachment: EmailAttachment) => {
    setSelectedAttachment(attachment);
    setIsPreviewOpen(true);
  };

  const handleDownload = async (attachment: EmailAttachment) => {
    try {
      const response = await fetch(`/api/attachments${attachment.storageUrl}`);
      if (!response.ok) {
        throw new Error('Failed to download attachment');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      // Could add toast notification here
    }
  };

  const formatFileSize = (size: number | null) => {
    if (!size) return 'Unknown size';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string | null, filename: string) => {
    if (!contentType) return FileIcon;
    
    if (contentType.startsWith('image/')) return FileIcon;
    if (contentType.includes('pdf')) return FileIcon;
    if (contentType.includes('word') || contentType.includes('document')) return FileIcon;
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return FileIcon;
    if (contentType.includes('powerpoint') || contentType.includes('presentation')) return FileIcon;
    
    return FileIcon;
  };

  const canPreview = (contentType: string | null) => {
    if (!contentType) return false;
    return contentType.startsWith('image/') || contentType.includes('pdf');
  };

  const renderPreviewContent = () => {
    if (!selectedAttachment) return null;

    const { contentType, storageUrl, filename, id } = selectedAttachment;
    const attachmentUrl = `/api/attachments${storageUrl}`;

    if (contentType?.startsWith('image/')) {
      return (
        <div className="flex justify-center">
          <img
            src={attachmentUrl}
            alt={filename}
            className="max-w-full max-h-[500px] object-contain rounded"
            data-testid={`img-preview-${id}`}
          />
        </div>
      );
    }

    if (contentType?.includes('pdf')) {
      return (
        <iframe
          src={attachmentUrl}
          title={filename}
          className="w-full h-[500px] border rounded"
          data-testid={`pdf-preview-${id}`}
        />
      );
    }

    return (
      <div className="text-center py-8">
        <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium">{filename}</p>
        <p className="text-muted-foreground">Preview not available for this file type</p>
        <p className="text-sm text-muted-foreground mt-2">Use the buttons below to download or open in a new tab</p>
      </div>
    );
  };

  if (isLoading) {
    return null; // Don't show loading state to keep it clean
  }

  if (!attachments || attachments.length === 0) {
    return null; // No attachments, don't render anything
  }

  return (
    <div className="mt-3 pt-3 border-t" data-testid="email-attachments">
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
          <Paperclip className="h-4 w-4" />
          <span>{attachments.length} attachment(s)</span>
        </div>
        
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIconComponent = getFileIcon(attachment.contentType, attachment.filename);
            
            return (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-2 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors"
                data-testid={`attachment-${attachment.filename}`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <FileIconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => handlePreview(attachment)}
                      className="font-medium text-sm truncate hover:text-primary transition-colors text-left w-full"
                      title={attachment.filename}
                      data-testid={`link-preview-${attachment.filename}`}
                    >
                      {attachment.filename}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.size)}
                      {attachment.contentType && (
                        <span className="ml-2">• {attachment.contentType}</span>
                      )}
                      {attachment.isInline && (
                        <Badge variant="outline" className="ml-2 text-xs">Inline</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(attachment)}
                    className="flex-shrink-0"
                    data-testid={`button-preview-${attachment.filename}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                    className="flex-shrink-0"
                    data-testid={`download-${attachment.filename}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" data-testid="modal-attachment-preview">
          <DialogHeader>
            <DialogTitle>
              {selectedAttachment?.filename}
            </DialogTitle>
            <DialogDescription>
              {selectedAttachment?.contentType && (
                <span className="mr-4">Type: {selectedAttachment.contentType}</span>
              )}
              {selectedAttachment?.size && (
                <span>Size: {formatFileSize(selectedAttachment.size)}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {renderPreviewContent()}
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              asChild
              data-testid="button-open-new-tab"
            >
              <a
                href={selectedAttachment ? `/api/attachments${selectedAttachment.storageUrl}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
            <Button
              onClick={() => selectedAttachment && handleDownload(selectedAttachment)}
              data-testid="button-download-from-modal"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}