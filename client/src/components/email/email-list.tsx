import { EmailThread } from "@shared/schema";
import { EmailListItem } from "./email-list-item";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface EmailListProps {
  threads: EmailThread[];
  selectedThread: string | null;
  selectedThreadIds: Set<string>;
  isLoading: boolean;
  onThreadSelect: (id: string) => void;
  onThreadCheck: (id: string, checked: boolean) => void;
  onStarToggle: (id: string, starred: boolean) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function EmailList({
  threads,
  selectedThread,
  selectedThreadIds,
  isLoading,
  onThreadSelect,
  onThreadCheck,
  onStarToggle,
  onLoadMore,
  hasMore,
}: EmailListProps) {
  if (isLoading && threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="email-list-loading">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading emails...</p>
        </div>
      </div>
    );
  }

  if (!isLoading && threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="email-list-empty">
        <div className="text-center">
          <p className="text-muted-foreground">No email threads found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" data-testid="email-list">
      {threads.map((thread) => (
        <EmailListItem
          key={thread.id}
          thread={thread}
          isSelected={selectedThreadIds.has(thread.id)}
          isActive={selectedThread === thread.id}
          onSelect={onThreadCheck}
          onClick={onThreadSelect}
          onStarToggle={onStarToggle}
        />
      ))}
      
      {hasMore && (
        <div className="p-4 text-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
            data-testid="load-more-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
