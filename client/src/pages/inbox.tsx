import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailSidebar } from "@/components/email/email-sidebar";
import { EmailList } from "@/components/email/email-list";
import { EmailThreadView } from "@/components/email/email-thread-view";
import { EmailCompose } from "@/components/email/email-compose";
import { 
  MailOpen,
  Mail,
  Star,
  Archive as ArchiveIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { EmailThread } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FolderType = "inbox" | "sent" | "archived" | "starred" | "unread";
type FilterType = 'with-order' | 'without-order' | null;

export default function Inbox() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolder, setCurrentFolder] = useState<FolderType>("inbox");
  const [currentFilter, setCurrentFilter] = useState<FilterType>(null);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const { toast } = useToast();

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    if (currentFolder === 'inbox') {
      params.append('folder', 'inbox');
      params.append('archived', 'false');
    } else if (currentFolder === 'sent') {
      params.append('folder', 'sent');
    } else if (currentFolder === 'archived') {
      params.append('archived', 'true');
    } else if (currentFolder === 'starred') {
      params.append('starred', 'true');
    } else if (currentFolder === 'unread') {
      params.append('isUnread', 'true');
    }
    
    if (currentFilter === 'with-order') {
      params.append('hasOrder', 'true');
    } else if (currentFilter === 'without-order') {
      params.append('hasOrder', 'false');
    }
    
    return params.toString();
  };

  const { data: emailThreads = [], isLoading } = useQuery<EmailThread[]>({
    queryKey: ["/api/email-threads", currentFolder, currentFilter],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const response = await fetch(`/api/email-threads?${queryString}`);
      if (!response.ok) throw new Error("Failed to fetch email threads");
      return response.json();
    },
  });

  const filteredThreads = emailThreads.filter(thread => {
    if (searchQuery && 
        !thread.subject?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !thread.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const syncEmailsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/emails/sync", { method: "POST" });
      if (!response.ok) throw new Error("Failed to sync emails");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"], exact: false });
      toast({
        title: "Emails synced",
        description: `Synced ${data.synced} new emails`,
      });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync emails from server",
        variant: "destructive",
      });
    }
  });

  const updateThreadMutation = useMutation({
    mutationFn: async ({ threadId, updates }: { threadId: string; updates: Partial<EmailThread> }) => {
      return apiRequest("PATCH", `/api/email-threads/${threadId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"], exact: false });
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, threadIds }: { action: string; threadIds: string[] }) => {
      return apiRequest("POST", `/api/email-threads/bulk/${action}`, { threadIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"], exact: false });
      setSelectedThreadIds(new Set());
      toast({ title: "Action completed successfully" });
    },
    onError: () => {
      toast({
        title: "Action failed",
        description: "Failed to perform bulk action",
        variant: "destructive",
      });
    }
  });

  const handleFolderChange = (folder: string) => {
    setCurrentFolder(folder as FolderType);
    setSelectedThread(null);
    setSelectedThreadIds(new Set());
  };

  const handleFilterChange = (filter: FilterType) => {
    if (currentFilter === filter) {
      setCurrentFilter(null);
    } else {
      setCurrentFilter(filter);
    }
    setSelectedThreadIds(new Set());
  };

  const handleThreadSelect = (id: string) => {
    setSelectedThread(id);
    const thread = filteredThreads.find(t => t.id === id);
    if (thread?.isUnread) {
      updateThreadMutation.mutate({ threadId: id, updates: { isUnread: false } });
    }
  };

  const handleThreadCheck = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedThreadIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedThreadIds(newSelected);
  };

  const handleStarToggle = (id: string, starred: boolean) => {
    updateThreadMutation.mutate({ threadId: id, updates: { starred } });
  };

  const handleBulkAction = (action: "read" | "unread" | "star" | "unstar" | "archive") => {
    const threadIds = Array.from(selectedThreadIds);
    bulkActionMutation.mutate({ action, threadIds });
  };

  const handleSelectAll = () => {
    if (selectedThreadIds.size === filteredThreads.length && filteredThreads.length > 0) {
      setSelectedThreadIds(new Set());
    } else {
      setSelectedThreadIds(new Set(filteredThreads.map(t => t.id)));
    }
  };

  const navigateThread = useCallback((direction: "up" | "down") => {
    if (!selectedThread || filteredThreads.length === 0) {
      if (filteredThreads.length > 0) {
        setSelectedThread(filteredThreads[0].id);
      }
      return;
    }

    const currentIndex = filteredThreads.findIndex(t => t.id === selectedThread);
    if (currentIndex === -1) return;

    if (direction === "up" && currentIndex > 0) {
      setSelectedThread(filteredThreads[currentIndex - 1].id);
    } else if (direction === "down" && currentIndex < filteredThreads.length - 1) {
      setSelectedThread(filteredThreads[currentIndex + 1].id);
    }
  }, [selectedThread, filteredThreads]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || 
          (e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "arrowup":
        case "k":
          e.preventDefault();
          navigateThread("up");
          break;
        case "arrowdown":
        case "j":
          e.preventDefault();
          navigateThread("down");
          break;
        case "r":
          if (selectedThread) {
            setShowCompose(true);
          }
          break;
        case "a":
          if (selectedThread) {
            updateThreadMutation.mutate({ 
              threadId: selectedThread, 
              updates: { archived: true } 
            });
            setSelectedThread(null);
          }
          break;
        case "s":
          if (selectedThread) {
            const thread = filteredThreads.find(t => t.id === selectedThread);
            if (thread) {
              updateThreadMutation.mutate({ 
                threadId: selectedThread, 
                updates: { starred: !thread.starred } 
              });
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedThread, filteredThreads, navigateThread, updateThreadMutation]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncEmailsMutation.mutate();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const selectedThreadData = filteredThreads.find(t => t.id === selectedThread);

  return (
    <div className="min-h-screen bg-background" data-testid="inbox-page">
      <Navigation />
      
      <main className="flex h-[calc(100vh-64px)]">
        {/* Left Sidebar */}
        <div className={cn(
          "border-r transition-all duration-300 flex-shrink-0",
          leftSidebarCollapsed ? "w-0 overflow-hidden" : "w-64"
        )}>
          {!leftSidebarCollapsed && (
            <EmailSidebar
              selectedFolder={currentFolder}
              selectedFilter={currentFilter}
              onFolderChange={handleFolderChange}
              onFilterChange={handleFilterChange}
              onCompose={() => setShowCompose(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}
        </div>

        {/* Middle Column - Email List */}
        <div className="w-80 flex flex-col border-r flex-shrink-0">
          {/* Header */}
          <div className="border-b bg-card p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
                  data-testid="toggle-left-sidebar"
                >
                  {leftSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
                
                {filteredThreads.length > 0 && (
                  <Checkbox
                    checked={selectedThreadIds.size === filteredThreads.length && filteredThreads.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="select-all-checkbox"
                  />
                )}
                
                {selectedThreadIds.size > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {selectedThreadIds.size} selected
                  </span>
                )}
              </div>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => syncEmailsMutation.mutate()}
                disabled={syncEmailsMutation.isPending}
                data-testid="sync-emails-button"
              >
                <RefreshCw className={cn("h-4 w-4", syncEmailsMutation.isPending && "animate-spin")} />
              </Button>
            </div>

            {/* Bulk Actions */}
            {selectedThreadIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkAction("read")}
                  data-testid="bulk-mark-read"
                >
                  <MailOpen className="h-3 w-3 mr-1" />
                  Mark Read
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkAction("unread")}
                  data-testid="bulk-mark-unread"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Mark Unread
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkAction("star")}
                  data-testid="bulk-star"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Star
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkAction("archive")}
                  data-testid="bulk-archive"
                >
                  <ArchiveIcon className="h-3 w-3 mr-1" />
                  Archive
                </Button>
              </div>
            )}
          </div>

          {/* Email List */}
          <EmailList
            threads={filteredThreads}
            selectedThread={selectedThread}
            selectedThreadIds={selectedThreadIds}
            isLoading={isLoading}
            onThreadSelect={handleThreadSelect}
            onThreadCheck={handleThreadCheck}
            onStarToggle={handleStarToggle}
          />
        </div>

        {/* Right Panel - Thread View */}
        <div className={cn(
          "transition-all duration-300 flex flex-col",
          rightPanelCollapsed ? "w-0 overflow-hidden" : "flex-1"
        )}>
          {!rightPanelCollapsed && (
            <>
              <div className="border-b p-4 flex items-center justify-between">
                <h2 className="font-semibold">
                  {selectedThreadData ? "Email Thread" : "Select an email"}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightPanelCollapsed(true)}
                  data-testid="toggle-right-panel"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {selectedThreadData ? (
                  <EmailThreadView 
                    threadId={selectedThreadData.id}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Select an email to view</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          
          {rightPanelCollapsed && (
            <div className="p-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRightPanelCollapsed(false)}
                data-testid="expand-right-panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>

      <EmailCompose 
        open={showCompose}
        onOpenChange={setShowCompose}
      />
    </div>
  );
}
