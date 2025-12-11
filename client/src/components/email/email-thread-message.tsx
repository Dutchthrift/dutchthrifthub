import { ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';

interface EmailMessage {
    id: string;
    messageId: string;
    fromEmail: string;
    toEmail: string;
    subject?: string;
    body?: string;
    isHtml?: boolean;
    isOutbound?: boolean;
    sentAt?: string;
    createdAt?: string;
    attachments?: any;
}

interface EmailThreadMessageProps {
    message: EmailMessage;
    isExpanded: boolean;
    onToggle: () => void;
    isLatest?: boolean;
}

export function EmailThreadMessage({
    message,
    isExpanded,
    onToggle,
    isLatest = false,
}: EmailThreadMessageProps) {
    const sentDate = message.sentAt ? new Date(message.sentAt) : new Date(message.createdAt || '');
    const hasAttachments = message.attachments && (
        Array.isArray(message.attachments) ? message.attachments.length > 0 : Object.keys(message.attachments).length > 0
    );

    // Extract sender name from email
    const senderName = message.fromEmail.split('@')[0].replace(/[._-]/g, ' ');
    const capitalizedName = senderName.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Preview text for collapsed state
    const getPreviewText = () => {
        if (!message.body) return '(Geen inhoud)';
        // Strip HTML and take first 100 characters
        const textContent = message.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
    };

    // Avatar colors based on whether outbound or inbound
    const avatarBg = message.isOutbound ? 'bg-orange-500' : 'bg-blue-500';
    const avatarInitial = message.isOutbound ? 'J' : capitalizedName.charAt(0);

    return (
        <div className={cn(
            "border rounded-lg transition-all duration-200",
            isExpanded
                ? "bg-card border-border shadow-sm"
                : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border cursor-pointer",
            // Orange left border for outbound (your) messages, blue for inbound
            message.isOutbound
                ? "border-l-4 border-l-orange-500"
                : "border-l-4 border-l-blue-500"
        )}>
            {/* Collapsed/Header View */}
            <div
                onClick={onToggle}
                className={cn(
                    "flex items-center gap-3 p-3 cursor-pointer",
                    isExpanded && "border-b hover:bg-muted/50"
                )}
            >
                {/* Expand/Collapse indicator */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </button>

                {/* Avatar */}
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0",
                    avatarBg
                )}>
                    {avatarInitial}
                </div>

                {/* Email info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "font-medium text-sm truncate",
                            message.isOutbound && "text-primary"
                        )}>
                            {message.isOutbound ? 'Jij' : capitalizedName}
                        </span>
                        {hasAttachments && (
                            <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                        {isLatest && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Nieuwste
                            </Badge>
                        )}
                    </div>

                    {/* Preview (only when collapsed) */}
                    {!isExpanded && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {getPreviewText()}
                        </p>
                    )}
                </div>

                {/* Date */}
                <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {sentDate.toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: sentDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })}
                    {' '}
                    {sentDate.toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4">
                    {/* From/To details */}
                    <div className="text-xs text-muted-foreground mb-4 space-y-1">
                        <div>
                            <span className="font-medium">Van:</span> {message.fromEmail}
                        </div>
                        <div>
                            <span className="font-medium">Aan:</span> {message.toEmail}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        {message.isHtml && message.body ? (
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(message.body, {
                                        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'blockquote'],
                                        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style']
                                    })
                                }}
                            />
                        ) : (
                            <pre className="whitespace-pre-wrap font-sans text-sm">
                                {message.body || '(Geen inhoud)'}
                            </pre>
                        )}
                    </div>

                    {/* Attachments */}
                    {hasAttachments && (
                        <div className="mt-4 pt-4 border-t">
                            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                Bijlagen
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {Array.isArray(message.attachments) && message.attachments.map((att: any, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                        {att.filename || att.name || `Bijlage ${idx + 1}`}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
