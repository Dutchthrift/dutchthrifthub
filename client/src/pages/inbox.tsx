import { useState } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, 
  Search, 
  Filter, 
  Archive, 
  Tag, 
  User, 
  Clock,
  Paperclip,
  MoreHorizontal,
  Reply,
  Forward,
  Trash2,
  RefreshCw
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { EmailThread, EmailMessage } from "@/lib/types";
import { EmailThreadView } from "@/components/email/email-thread-view";
import { EmailCompose } from "@/components/email/email-compose";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Inbox() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
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

  const filteredThreads = emailThreads?.filter(thread => {
    if (filter === "unread" && !thread.isUnread) return false;
    if (filter === "replied" && thread.status !== "closed") return false;
    if (filter === "attachments" && !thread.hasAttachment) return false;
    if (searchQuery && !thread.subject?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !thread.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const getThreadStatusColor = (thread: EmailThread) => {
    if (thread.priority === "urgent") return "bg-red-500";
    if (thread.priority === "high") return "bg-orange-500";
    if (thread.isUnread) return "bg-blue-600";
    if (thread.status === "closed") return "bg-gray-400";
    return "bg-green-500";
  };

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
      return activityDate.toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (activityDate >= yesterday) {
      return 'Yesterday';
    } else if (activityDate.getFullYear() === now.getFullYear()) {
      return activityDate.toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short'
      });
    } else {
      return activityDate.toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="inbox-page">
      <Navigation />
      
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6" data-testid="inbox-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
            <p className="text-muted-foreground">Manage email conversations and customer communications</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => syncEmailsMutation.mutate()}
              disabled={syncEmailsMutation.isPending}
              data-testid="sync-emails-button"
              className="border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncEmailsMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Emails
            </Button>
            <Button 
              onClick={() => setShowCompose(true)} 
              data-testid="compose-email-button"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="mr-2 h-4 w-4" />
              Compose
            </Button>
          </div>
        </div>

        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Email List */}
          <div className="w-1/3 flex flex-col" data-testid="email-list">
            {/* Search and Filters */}
            <div className="space-y-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="email-search-input"
                />
              </div>
              
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="grid w-full grid-cols-4 bg-muted">
                  <TabsTrigger 
                    value="all" 
                    data-testid="filter-all"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger 
                    value="unread" 
                    data-testid="filter-unread"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Unread
                  </TabsTrigger>
                  <TabsTrigger 
                    value="replied" 
                    data-testid="filter-replied"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Replied
                  </TabsTrigger>
                  <TabsTrigger 
                    value="attachments" 
                    data-testid="filter-attachments"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    <Paperclip className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Email Thread List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg animate-pulse">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded w-3/4 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No email threads found
                </div>
              ) : (
                filteredThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`group cursor-pointer transition-all border-b border-border hover:shadow-sm
                      ${selectedThread === thread.id 
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-600' 
                        : 'hover:bg-accent border-l-4 border-l-transparent'
                      }
                      ${thread.isUnread ? 'bg-background' : 'bg-muted/30'}
                    `}
                    onClick={() => setSelectedThread(thread.id)}
                    data-testid={`email-thread-${thread.id}`}
                  >
                    <div className="p-3 flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${getAvatarColor(thread.customerEmail || '')} flex items-center justify-center text-white font-medium text-sm`}>
                        {getInitials(thread.customerEmail || '')}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`text-sm truncate ${thread.isUnread ? 'font-bold text-foreground' : 'font-normal text-foreground'}`}>
                              {thread.customerEmail || "Unknown"}
                            </span>
                            {thread.hasAttachment && (
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            {thread.orderId && (
                              <Badge variant="outline" className="text-xs px-1 py-0">Order</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            {formatLastActivity(thread.lastActivity || new Date().toISOString())}
                          </span>
                        </div>

                        {/* Subject */}
                        <div className={`text-sm mb-1 truncate ${thread.isUnread ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'}`}>
                          {thread.subject || "No Subject"}
                        </div>

                        {/* Status badges */}
                        <div className="flex items-center gap-2">
                          {thread.priority !== "medium" && (
                            <Badge 
                              variant={thread.priority === "urgent" ? "destructive" : "default"}
                              className="text-xs px-1.5 py-0"
                            >
                              {thread.priority}
                            </Badge>
                          )}
                          {thread.status === "closed" && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              Closed
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
          </div>

          {/* Email Thread View */}
          <div className="flex-1" data-testid="email-thread-view">
            {selectedThread ? (
              <EmailThreadView threadId={selectedThread} />
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select an email thread</h3>
                  <p className="text-muted-foreground">Choose a conversation from the list to view details</p>
                </CardContent>
              </Card>
            )}
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
