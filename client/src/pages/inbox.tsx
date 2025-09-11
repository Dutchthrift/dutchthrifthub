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
    if (thread.priority === "urgent") return "bg-destructive";
    if (thread.priority === "high") return "bg-chart-1";
    if (thread.isUnread) return "bg-primary";
    if (thread.status === "closed") return "bg-muted-foreground";
    return "bg-chart-2";
  };

  const formatLastActivity = (date: string) => {
    const activityDate = new Date(date);
    
    // Format as "HH:MM DD-MM-YYYY"
    const time = activityDate.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const dateStr = activityDate.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    return `${time}\n${dateStr}`;
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
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncEmailsMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Emails
            </Button>
            <Button onClick={() => setShowCompose(true)} data-testid="compose-email-button">
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
                  <TabsTrigger value="unread" data-testid="filter-unread">Unread</TabsTrigger>
                  <TabsTrigger value="replied" data-testid="filter-replied">Replied</TabsTrigger>
                  <TabsTrigger value="attachments" data-testid="filter-attachments">
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
                  <Card
                    key={thread.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedThread === thread.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedThread(thread.id)}
                    data-testid={`email-thread-${thread.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${getThreadStatusColor(thread)}`}></div>
                          <span className="font-medium text-sm truncate">
                            {thread.subject || "No Subject"}
                          </span>
                          {thread.hasAttachment && (
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatLastActivity(thread.lastActivity || new Date().toISOString())}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground truncate">
                          {thread.customerEmail}
                        </span>
                        <div className="flex items-center space-x-1">
                          {thread.orderId && (
                            <Badge variant="outline" className="text-xs">Order</Badge>
                          )}
                          {thread.isUnread && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
