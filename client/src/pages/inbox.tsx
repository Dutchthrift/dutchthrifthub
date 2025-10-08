import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Mail, 
  Search, 
  Inbox as InboxIcon,
  Send,
  Archive as ArchiveIcon,
  Star,
  MailOpen,
  RefreshCw,
  Paperclip,
  ShoppingBag,
  Trash2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { EmailThread } from "@/lib/types";
import { EmailThreadView } from "@/components/email/email-thread-view";
import { EmailCompose } from "@/components/email/email-compose";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FolderType = "inbox" | "sent" | "archived" | "starred" | "unread";
type FilterType = "all" | "with-order" | "without-order";

export default function Inbox() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolder, setCurrentFolder] = useState<FolderType>("inbox");
  const [currentFilter, setCurrentFilter] = useState<FilterType>("all");
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const { toast } = useToast();

  const { data: emailThreads, isLoading } = useQuery<EmailThread[]>({
    queryKey: ["/api/email-threads"],
  });

  const syncEmailsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/emails/sync", { method: "POST" });
      if (!response.ok) throw new Error("Failed to sync emails");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
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
      const response = await fetch(`/api/email-threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update thread");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Partial<EmailThread>) => {
      const promises = Array.from(selectedThreads).map(threadId =>
        fetch(`/api/email-threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }).then(res => res.json())
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
      setSelectedThreads(new Set());
      toast({ title: "Threads updated successfully" });
    },
  });

  const filteredThreads = emailThreads?.filter(thread => {
    if (currentFolder === "inbox" && thread.folder !== "inbox") return false;
    if (currentFolder === "sent" && thread.folder !== "sent") return false;
    if (currentFolder === "archived" && !thread.archived) return false;
    if (currentFolder === "starred" && !thread.starred) return false;
    if (currentFolder === "unread" && !thread.isUnread) return false;

    if (currentFilter === "with-order" && !thread.orderId) return false;
    if (currentFilter === "without-order" && thread.orderId) return false;

    if (searchQuery && !thread.subject?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !thread.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    return true;
  }) || [];

  const unreadCount = emailThreads?.filter(t => t.isUnread && t.folder === "inbox").length || 0;
  const starredCount = emailThreads?.filter(t => t.starred).length || 0;

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
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (activityDate >= today) {
      return activityDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (activityDate >= yesterday) {
      return 'Yesterday';
    } else if (activityDate.getFullYear() === now.getFullYear()) {
      return activityDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
      });
    } else {
      return activityDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  };

  const handleToggleStar = (threadId: string, starred: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    updateThreadMutation.mutate({ threadId, updates: { starred: !starred } });
  };

  const handleToggleRead = (threadId: string, isUnread: boolean) => {
    updateThreadMutation.mutate({ threadId, updates: { isUnread: !isUnread } });
  };

  const handleArchive = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateThreadMutation.mutate({ threadId, updates: { archived: true } });
    if (selectedThread === threadId) {
      setSelectedThread(null);
    }
  };

  const handleBulkAction = (action: "read" | "unread" | "star" | "unstar" | "archive" | "delete") => {
    const updates: Partial<EmailThread> = {};
    switch (action) {
      case "read":
        updates.isUnread = false;
        break;
      case "unread":
        updates.isUnread = true;
        break;
      case "star":
        updates.starred = true;
        break;
      case "unstar":
        updates.starred = false;
        break;
      case "archive":
        updates.archived = true;
        break;
    }
    bulkUpdateMutation.mutate(updates);
  };

  const handleSelectAll = () => {
    if (selectedThreads.size === filteredThreads.length) {
      setSelectedThreads(new Set());
    } else {
      setSelectedThreads(new Set(filteredThreads.map(t => t.id)));
    }
  };

  const handleToggleThread = (threadId: string) => {
    const newSelected = new Set(selectedThreads);
    if (newSelected.has(threadId)) {
      newSelected.delete(threadId);
    } else {
      newSelected.add(threadId);
    }
    setSelectedThreads(newSelected);
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
          e.preventDefault();
          navigateThread("up");
          break;
        case "arrowdown":
          e.preventDefault();
          navigateThread("down");
          break;
        case "r":
          if (selectedThread) {
            const thread = filteredThreads.find(t => t.id === selectedThread);
            if (thread) {
              setShowCompose(true);
            }
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

  return (
    <div className="min-h-screen bg-background" data-testid="inbox-page">
      <Navigation />
      
      <main className="flex h-[calc(100vh-64px)]">
        <div className={cn(
          "border-r bg-card transition-all duration-300 flex-shrink-0",
          leftSidebarCollapsed ? "w-16" : "w-64"
        )}>
          <div className="p-4 border-b flex items-center justify-between">
            {!leftSidebarCollapsed && (
              <h2 className="font-semibold text-lg">Mail</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
              data-testid="toggle-sidebar"
            >
              {leftSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {!leftSidebarCollapsed && (
            <>
              <div className="p-3">
                <Button 
                  onClick={() => setShowCompose(true)} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="compose-email-button"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Compose
                </Button>
              </div>

              <div className="px-2 space-y-1">
                <button
                  onClick={() => setCurrentFolder("inbox")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                    currentFolder === "inbox" 
                      ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium" 
                      : "hover:bg-accent"
                  )}
                  data-testid="folder-inbox"
                >
                  <InboxIcon className="h-5 w-5" />
                  <span className="flex-1 text-left">Inbox</span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-auto bg-blue-600 text-white">
                      {unreadCount}
                    </Badge>
                  )}
                </button>

                <button
                  onClick={() => setCurrentFolder("starred")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                    currentFolder === "starred" 
                      ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium" 
                      : "hover:bg-accent"
                  )}
                  data-testid="folder-starred"
                >
                  <Star className="h-5 w-5" />
                  <span className="flex-1 text-left">Starred</span>
                  {starredCount > 0 && (
                    <span className="text-xs text-muted-foreground">{starredCount}</span>
                  )}
                </button>

                <button
                  onClick={() => setCurrentFolder("sent")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                    currentFolder === "sent" 
                      ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium" 
                      : "hover:bg-accent"
                  )}
                  data-testid="folder-sent"
                >
                  <Send className="h-5 w-5" />
                  <span>Sent</span>
                </button>

                <button
                  onClick={() => setCurrentFolder("unread")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                    currentFolder === "unread" 
                      ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium" 
                      : "hover:bg-accent"
                  )}
                  data-testid="folder-unread"
                >
                  <MailOpen className="h-5 w-5" />
                  <span>Unread</span>
                </button>

                <button
                  onClick={() => setCurrentFolder("archived")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                    currentFolder === "archived" 
                      ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium" 
                      : "hover:bg-accent"
                  )}
                  data-testid="folder-archived"
                >
                  <ArchiveIcon className="h-5 w-5" />
                  <span>Archived</span>
                </button>
              </div>

              <div className="mt-6 px-2">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Filters
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setCurrentFilter("all")}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                      currentFilter === "all" 
                        ? "bg-accent font-medium" 
                        : "hover:bg-accent"
                    )}
                    data-testid="filter-all"
                  >
                    All Emails
                  </button>
                  <button
                    onClick={() => setCurrentFilter("with-order")}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                      currentFilter === "with-order" 
                        ? "bg-accent font-medium" 
                        : "hover:bg-accent"
                    )}
                    data-testid="filter-with-order"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    With Order
                  </button>
                  <button
                    onClick={() => setCurrentFilter("without-order")}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
                      currentFilter === "without-order" 
                        ? "bg-accent font-medium" 
                        : "hover:bg-accent"
                    )}
                    data-testid="filter-without-order"
                  >
                    Without Order
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="border-b bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="email-search-input"
                />
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

            {selectedThreads.size > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{selectedThreads.size} selected</span>
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

          <div className="flex-1 flex overflow-hidden">
            <div className="w-96 border-r overflow-y-auto" data-testid="email-list">
              {filteredThreads.length > 0 && (
                <div className="border-b p-2 flex items-center gap-2">
                  <Checkbox
                    checked={selectedThreads.size === filteredThreads.length && filteredThreads.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="select-all-checkbox"
                  />
                  <span className="text-sm text-muted-foreground">Select all</span>
                </div>
              )}

              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="h-4 w-4 bg-muted rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No emails found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Try adjusting your search" : "Your inbox is empty"}
                  </p>
                </div>
              ) : (
                filteredThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className={cn(
                      "group border-b transition-colors cursor-pointer",
                      selectedThread === thread.id 
                        ? "bg-blue-50 dark:bg-blue-950/20" 
                        : "hover:bg-accent",
                      thread.isUnread && "bg-background"
                    )}
                    onClick={() => {
                      setSelectedThread(thread.id);
                      if (thread.isUnread) {
                        handleToggleRead(thread.id, thread.isUnread);
                      }
                    }}
                    data-testid={`email-thread-${thread.id}`}
                  >
                    <div className="p-3 flex items-start gap-3">
                      <Checkbox
                        checked={selectedThreads.has(thread.id)}
                        onCheckedChange={() => handleToggleThread(thread.id)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-${thread.id}`}
                      />

                      <button
                        onClick={(e) => handleToggleStar(thread.id, thread.starred || false, e)}
                        className="flex-shrink-0"
                        data-testid={`star-${thread.id}`}
                      >
                        <Star 
                          className={cn(
                            "h-4 w-4 transition-colors",
                            thread.starred 
                              ? "fill-yellow-400 text-yellow-400" 
                              : "text-muted-foreground hover:text-yellow-400"
                          )} 
                        />
                      </button>

                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm",
                        getAvatarColor(thread.customerEmail || '')
                      )}>
                        {getInitials(thread.customerEmail || '')}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={cn(
                              "text-sm truncate",
                              thread.isUnread ? "font-bold" : "font-normal"
                            )}>
                              {thread.customerEmail || "Unknown"}
                            </span>
                            {thread.hasAttachment && (
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            {formatLastActivity(thread.lastActivity || new Date().toISOString())}
                          </span>
                        </div>

                        <div className={cn(
                          "text-sm mb-1 truncate",
                          thread.isUnread ? "font-semibold" : "font-normal text-muted-foreground"
                        )}>
                          {thread.subject || "No Subject"}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {thread.orderId && (
                            <Badge 
                              variant="outline" 
                              className="text-xs px-2 py-0 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                            >
                              <ShoppingBag className="h-3 w-3 mr-1" />
                              Order
                            </Badge>
                          )}
                          {thread.priority !== "medium" && (
                            <Badge 
                              variant={thread.priority === "urgent" ? "destructive" : "default"}
                              className="text-xs px-1.5 py-0"
                            >
                              {thread.priority}
                            </Badge>
                          )}
                          {thread.isUnread && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex-1 overflow-y-auto" data-testid="email-thread-view">
              {selectedThread ? (
                <EmailThreadView threadId={selectedThread} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Card className="p-8 text-center border-0 shadow-none">
                    <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Select an email</h3>
                    <p className="text-muted-foreground mb-4">
                      Choose a conversation from the list to view details
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><kbd className="px-2 py-1 bg-muted rounded">↑</kbd> <kbd className="px-2 py-1 bg-muted rounded">↓</kbd> Navigate</p>
                      <p><kbd className="px-2 py-1 bg-muted rounded">r</kbd> Reply</p>
                      <p><kbd className="px-2 py-1 bg-muted rounded">a</kbd> Archive</p>
                      <p><kbd className="px-2 py-1 bg-muted rounded">s</kbd> Star</p>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <EmailCompose 
        open={showCompose} 
        onOpenChange={setShowCompose}
      />
    </div>
  );
}
