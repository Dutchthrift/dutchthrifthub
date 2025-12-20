import { EmailThread } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Paperclip, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailListItemProps {
  thread: EmailThread;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: (id: string) => void;
  onStarToggle: (id: string, starred: boolean) => void;
}

export function EmailListItem({
  thread,
  isSelected,
  isActive,
  onSelect,
  onClick,
  onStarToggle,
}: EmailListItemProps) {
  const getInitials = (email: string) => {
    if (!email) return "?";
    const name = email.split("@")[0];
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (email: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
    ];
    const hash = email.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatLastActivity = (date: string | Date) => {
    const activityDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (activityDate >= today) {
      // Today: show time only
      return activityDate.toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (activityDate >= sevenDaysAgo) {
      // Last 7 days: show weekday + time
      return activityDate.toLocaleDateString('nl-NL', { weekday: 'long' }) + ' ' +
        activityDate.toLocaleTimeString('nl-NL', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
    } else if (activityDate.getFullYear() === now.getFullYear()) {
      // This year: show day + month
      return activityDate.toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short'
      });
    } else {
      // Older: show day + month + year
      return activityDate.toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  };

  return (
    <div
      className={cn(
        "group cursor-pointer transition-all border-b border-border hover:shadow-sm relative",
        isActive
          ? "bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-600"
          : "hover:bg-accent border-l-4 border-l-transparent",
        thread.isUnread ? "bg-background" : "bg-muted/30"
      )}
      onClick={() => onClick(thread.id)}
      data-testid={`email-list-item-${thread.id}`}
    >
      <div className="p-3 flex items-start gap-3">
        {/* Checkbox */}
        <div className="flex items-center pt-1" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(thread.id, checked as boolean)}
            data-testid={`checkbox-${thread.id}`}
          />
        </div>

        {/* Star */}
        <button
          className="flex items-center pt-1 hover:scale-110 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            onStarToggle(thread.id, !thread.starred);
          }}
          data-testid={`star-${thread.id}`}
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              thread.starred
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          />
        </button>

        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm",
            getAvatarColor(thread.customerEmail || '')
          )}
        >
          {getInitials(thread.customerEmail || '')}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={cn(
                  "text-sm truncate",
                  thread.isUnread ? "font-bold text-foreground" : "font-normal text-foreground"
                )}
                data-testid={`sender-${thread.id}`}
              >
                {thread.customerEmail || "Unknown"}
              </span>
              {thread.hasAttachment && (
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              {thread.orderId && (
                <Badge
                  variant="outline"
                  className="text-xs px-1 py-0 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                  data-testid={`order-badge-${thread.id}`}
                >
                  Order
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0" data-testid={`time-${thread.id}`}>
              {formatLastActivity(thread.lastActivity || new Date().toISOString())}
            </span>
          </div>

          {/* Subject */}
          <div
            className={cn(
              "text-sm mb-1 truncate",
              thread.isUnread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
            )}
            data-testid={`subject-${thread.id}`}
          >
            {thread.subject || "No Subject"}
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {thread.priority !== "medium" && (
              <Badge
                variant={thread.priority === "urgent" ? "destructive" : "default"}
                className="text-xs px-1.5 py-0"
                data-testid={`priority-${thread.id}`}
              >
                {thread.priority}
              </Badge>
            )}
            {thread.status === "closed" && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0" data-testid={`status-closed-${thread.id}`}>
                Closed
              </Badge>
            )}
            {thread.isUnread && (
              <div className="w-2 h-2 bg-blue-600 rounded-full" data-testid={`unread-indicator-${thread.id}`}></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
