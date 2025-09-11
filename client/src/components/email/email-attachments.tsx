import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, Download, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
                    <div className="font-medium text-sm truncate" title={attachment.filename}>
                      {attachment.filename}
                    </div>
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
            );
          })}
        </div>
      </div>
    </div>
  );
}