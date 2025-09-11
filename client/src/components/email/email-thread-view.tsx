import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Reply,
  Forward,
  Archive,
  Tag,
  User,
  Paperclip,
  Clock,
  ExternalLink,
  Send,
  Briefcase,
  ShoppingCart,
  Mail,
  UserCircle,
  Link as LinkIcon,
  Package
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { EmailThread, EmailMessage, Case, Order } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreateCaseModal } from "@/components/forms/create-case-modal";

interface EmailThreadViewProps {
  threadId: string;
}

interface ThreadWithMessages extends EmailThread {
  messages: EmailMessage[];
}

export function EmailThreadView({ threadId }: EmailThreadViewProps) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const { toast } = useToast();

  const { data: thread, isLoading } = useQuery<ThreadWithMessages>({
    queryKey: ["/api/email-threads", threadId],
  });

  // Check if this thread is linked to any case
  const { data: linkedCases } = useQuery<Case[]>({
    queryKey: ["/api/cases", "linked", threadId],
    queryFn: async () => {
      const response = await fetch(`/api/cases?emailThreadId=${threadId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch linked cases');
      }
      return response.json();
    },
    enabled: !!threadId,
  });

  // Get all available cases for linking
  const { data: allCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: true,
  });

  // Get all available orders for linking  
  const { data: allOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: true,
  });

  const sendReplyMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; body: string }) => {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to send email");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", threadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
      setReplyText("");
      setShowReply(false);
      toast({
        title: "Reply sent",
        description: "Your reply has been sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send reply",
        description: "There was an error sending your reply",
        variant: "destructive",
      });
    }
  });

  const updateThreadMutation = useMutation({
    mutationFn: async (data: Partial<EmailThread>) => {
      const response = await fetch(`/api/email-threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update thread");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", threadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", "linked", threadId] });
    }
  });

  const linkToCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await fetch(`/api/email-threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (!response.ok) throw new Error("Failed to link to case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", threadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", "linked", threadId] });
      setSelectedCaseId("");
      toast({
        title: "Email gekoppeld",
        description: "Email thread is succesvol gekoppeld aan de case",
      });
    },
    onError: () => {
      toast({
        title: "Koppeling mislukt",
        description: "Er is een fout opgetreden bij het koppelen aan de case",
        variant: "destructive",
      });
    }
  });

  const linkToOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/email-threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) throw new Error("Failed to link to order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", threadId] });
      setSelectedOrderId("");
      toast({
        title: "Order gekoppeld",
        description: "Email thread is succesvol gekoppeld aan de order",
      });
    },
    onError: () => {
      toast({
        title: "Koppeling mislukt",
        description: "Er is een fout opgetreden bij het koppelen aan de order",
        variant: "destructive",
      });
    }
  });

  const handleSendReply = () => {
    if (!thread || !replyText.trim()) return;

    sendReplyMutation.mutate({
      to: thread.customerEmail || "",
      subject: `Re: ${thread.subject || "No Subject"}`,
      body: replyText,
    });
  };

  const markAsRead = () => {
    if (thread?.isUnread) {
      updateThreadMutation.mutate({ isUnread: false });
    }
  };

  const closeThread = () => {
    updateThreadMutation.mutate({ status: 'closed' });
  };

  const handleLinkToCase = () => {
    if (selectedCaseId) {
      linkToCaseMutation.mutate(selectedCaseId);
    }
  };

  const handleLinkToOrder = () => {
    if (selectedOrderId) {
      linkToOrderMutation.mutate(selectedOrderId);
    }
  };

  const formatMessageTime = (date: string | Date | null) => {
    if (!date) return "Unknown time";
    const messageDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return messageDate.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="email-thread-loading">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border rounded">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-16 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!thread) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <p className="text-muted-foreground">Thread not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full gap-6" data-testid="email-thread-detail">
      {/* Main Email Thread View */}
      <div className="flex-1 flex flex-col">
        {/* Thread Header */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {thread.subject || "No Subject"}
                  {linkedCases && linkedCases.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Briefcase className="h-3 w-3 mr-1" />
                      Gekoppeld aan Case #{linkedCases[0].caseNumber}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant={thread.status === 'open' ? 'default' : 'secondary'}>
                    {thread.status}
                  </Badge>
                  <Badge variant={thread.priority === 'high' ? 'destructive' : 'outline'}>
                    {thread.priority}
                  </Badge>
                  {thread.hasAttachment && (
                    <Badge variant="outline">
                      <Paperclip className="h-3 w-3 mr-1" />
                      Attachment
                    </Badge>
                  )}
                  {thread.isUnread && (
                    <Badge variant="secondary">Unread</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <User className="h-4 w-4" />
                    <span>{thread.customerEmail}</span>
                  </div>
                  {thread.orderId && (
                    <div className="flex items-center space-x-1">
                      <ExternalLink className="h-4 w-4" />
                      <span>Linked to Order</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {thread.isUnread && (
                  <Button variant="outline" size="sm" onClick={markAsRead}>
                    Mark as Read
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowReply(true)}>
                  <Reply className="h-4 w-4 mr-1" />
                  Reply
                </Button>
                <Button variant="outline" size="sm">
                  <Forward className="h-4 w-4 mr-1" />
                  Forward
                </Button>
                <Button variant="outline" size="sm" onClick={closeThread}>
                  <Archive className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {thread.messages && thread.messages.length > 0 ? (
            thread.messages.map((message, index) => (
              <Card key={message.id} data-testid={`email-message-${message.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {message.fromEmail.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{message.fromEmail}</div>
                        <div className="text-xs text-muted-foreground">
                          to {message.toEmail}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatMessageTime(message.sentAt)}</span>
                      {message.isOutbound && (
                        <Badge variant="outline" className="text-xs">Sent</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    {message.isHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: message.body || "" }} />
                    ) : (
                      <div className="whitespace-pre-wrap">{message.body}</div>
                    )}
                  </div>
                  
                  {message.attachments && (message.attachments as any[]).length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Paperclip className="h-4 w-4" />
                        <span>{(message.attachments as any[]).length} attachment(s)</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No messages in this thread
              </CardContent>
            </Card>
          )}
        </div>

        {/* Reply Area */}
        {showReply && (
          <Card data-testid="email-reply-area">
            <CardHeader>
              <CardTitle className="text-sm">Reply to {thread.customerEmail}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[100px]"
                data-testid="reply-textarea"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Paperclip className="h-4 w-4 mr-1" />
                    Attach
                  </Button>
                  <Button variant="outline" size="sm">
                    <Tag className="h-4 w-4 mr-1" />
                    Template
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowReply(false)}
                    data-testid="cancel-reply-button"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sendReplyMutation.isPending}
                    data-testid="send-reply-button"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {sendReplyMutation.isPending ? "Sending..." : "Send Reply"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Customer Context Sidebar */}
      <div className="w-80 space-y-4" data-testid="customer-context-sidebar">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Klantcontext
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="text-sm">{thread.customerEmail}</div>
            </div>
            
            {thread.orderId && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Gekoppelde Order</div>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{thread.orderId}</span>
                </div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-muted-foreground">Thread Status</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={thread.status === 'open' ? 'default' : 'secondary'}>
                  {thread.status}
                </Badge>
                <Badge variant={thread.priority === 'high' ? 'destructive' : 'outline'}>
                  {thread.priority}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Case Actions */}
            <div className="space-y-3">
              {linkedCases && linkedCases.length > 0 ? (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Gekoppelde Cases</div>
                  {linkedCases.map((caseItem) => (
                    <div key={caseItem.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div>
                        <div className="text-sm font-medium">Case #{caseItem.caseNumber}</div>
                        <div className="text-xs text-muted-foreground">{caseItem.title}</div>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/cases/${caseItem.id}`} data-testid={`view-case-${caseItem.id}`}>
                          Bekijken
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Case Beheer</div>
                  
                  {/* Create new case */}
                  <Button 
                    className="w-full" 
                    onClick={() => setShowCreateCase(true)}
                    data-testid="create-case-button"
                  >
                    <Briefcase className="h-4 w-4 mr-2" />
                    Maak Case
                  </Button>
                  
                  {/* Link to existing case */}
                  {allCases && allCases.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Of koppel aan bestaande case:</div>
                      <div className="flex gap-2">
                        <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecteer case..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allCases.map((caseItem) => (
                              <SelectItem key={caseItem.id} value={caseItem.id}>
                                Case #{caseItem.caseNumber} - {caseItem.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          size="sm" 
                          onClick={handleLinkToCase}
                          disabled={!selectedCaseId || linkToCaseMutation.isPending}
                          data-testid="link-case-button"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Maak een case aan of koppel aan een bestaande case om dit verzoek te beheren.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Order Linking */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground mb-2">Order Koppeling</div>
              
              {thread.orderId ? (
                <div className="p-2 bg-muted rounded">
                  <div className="text-sm font-medium">Gekoppelde Order</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShoppingCart className="h-3 w-3" />
                    Order ID: {thread.orderId}
                  </div>
                </div>
              ) : (
                allOrders && allOrders.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecteer order..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allOrders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              #{order.orderNumber} - €{((order.totalAmount || 0) / 100).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        size="sm" 
                        onClick={handleLinkToOrder}
                        disabled={!selectedOrderId || linkToOrderMutation.isPending}
                        data-testid="link-order-button"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Koppel een order aan deze email thread voor betere organisatie.
                    </p>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thread Informatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Berichten:</span>
              <span>{thread.messages?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Laatste activiteit:</span>
              <span>{formatMessageTime(thread.lastActivity)}</span>
            </div>
            {thread.hasAttachment && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bijlagen:</span>
                <span className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Ja
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Case Modal */}
      <CreateCaseModal 
        open={showCreateCase} 
        onOpenChange={setShowCreateCase}
        emailThread={thread}
      />
    </div>
  );
}
