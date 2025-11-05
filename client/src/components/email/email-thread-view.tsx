import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import type { EmailThread, EmailMessage, Case, OrderWithShopifyData } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreateCaseModal } from "@/components/forms/create-case-modal";
import { EmailAttachments } from "./email-attachments";
import { SanitizedEmailContent } from "./sanitized-email-content";
import { EmailThreadSkeleton } from "./email-thread-skeleton";
import { cn } from "@/lib/utils";

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

  // Get all available cases for linking  
  const { data: allCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: true,
  });

  // Get linked cases for this thread
  const { data: linkedCases } = useQuery<Case[]>({
    queryKey: ["/api/cases", "linked", threadId],
    enabled: true,
  });

  // Get all available orders for linking  
  const { data: allOrders } = useQuery<OrderWithShopifyData[]>({
    queryKey: ["/api/orders"],
    enabled: true,
  });

  // Get the linked order details when thread has an orderId
  const { data: linkedOrder } = useQuery<OrderWithShopifyData>({
    queryKey: ["/api/orders", thread?.orderId],
    enabled: !!thread?.orderId,
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
      setReplyText("");
      setShowReply(false);
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", threadId] });
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

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/email-threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isUnread: false }),
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", threadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
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
      to: thread.customerEmail || '',
      subject: `Re: ${thread.subject}`,
      body: replyText,
    });
  };

  const markAsRead = () => {
    markAsReadMutation.mutate();
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
    const msgDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (msgDate >= today) {
      return msgDate.toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      return msgDate.toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: msgDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit'
      });
    }
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

  if (isLoading) {
    return <EmailThreadSkeleton />;
  }

  if (!thread) {
    return (
      <Card className="h-full" data-testid="email-thread-not-found">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Thread not found</h3>
            <p className="text-muted-foreground">The requested email thread could not be found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex gap-3" data-testid="email-thread-view">
      <div className="flex-1 flex flex-col">
        {/* Thread Header */}
        <div className="bg-background border-b border-border pb-2 mb-3 px-4 pt-3" data-testid="email-thread-header">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground mb-1.5">
                {thread.subject || "No Subject"}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <Badge 
                  variant={thread.status === 'open' ? 'default' : 'secondary'}
                  className={cn("text-xs py-0 h-5", thread.status === 'open' ? 'bg-green-600 hover:bg-green-700' : '')}
                >
                  {thread.status}
                </Badge>
                {thread.priority !== 'medium' && (
                  <Badge 
                    variant={thread.priority === 'urgent' ? 'destructive' : 'default'}
                    className={cn("text-xs py-0 h-5", thread.priority === 'high' ? 'bg-orange-500 hover:bg-orange-600' : '')}
                  >
                    {thread.priority}
                  </Badge>
                )}
                {thread.hasAttachment && (
                  <Badge variant="outline" className="border-blue-300 dark:border-blue-700 text-xs py-0 h-5">
                    <Paperclip className="h-3 w-3 mr-1" />
                    Attachments
                  </Badge>
                )}
                {linkedCases && linkedCases.length > 0 && (
                  <Badge variant="outline" className="border-purple-300 dark:border-purple-700 text-xs py-0 h-5">
                    Case #{linkedCases[0].caseNumber}
                  </Badge>
                )}
                {thread.orderId && (
                  <Badge variant="outline" className="border-indigo-300 dark:border-indigo-700 text-xs py-0 h-5">
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Order
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{thread.customerEmail}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {thread.isUnread && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={markAsRead}
                  className="border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                >
                  Mark as Read
                </Button>
              )}
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setShowReply(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
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
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {thread.messages && thread.messages.length > 0 ? (
            thread.messages.map((message, index) => (
              <div 
                key={message.id} 
                className={`bg-background border border-border rounded-lg hover:shadow-sm transition-shadow ${
                  message.isOutbound ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''
                }`}
                data-testid={`email-message-${message.id}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full ${getAvatarColor(message.fromEmail)} flex items-center justify-center text-white font-medium text-xs`}>
                        {getInitials(message.fromEmail)}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">{message.fromEmail}</div>
                        <div className="text-xs text-muted-foreground">
                          to {message.toEmail}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatMessageTime(message.sentAt)}</span>
                      {message.isOutbound && (
                        <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-800">
                          Sent
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 bg-white dark:bg-gray-950 rounded-md p-3 border border-gray-200 dark:border-gray-800">
                    <SanitizedEmailContent 
                      body={message.body || ""} 
                      isHtml={message.isHtml || false} 
                    />
                  </div>
                  
                  <EmailAttachments messageId={message.id} />
                </div>
              </div>
            ))
          ) : (
            <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
              No messages in this thread
            </div>
          )}
        </div>

        {/* Reply Area */}
        {showReply && (
          <Card data-testid="email-reply-area">
            <CardHeader>
              <CardTitle className="text-sm">Reply to {thread.customerEmail}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RichTextEditor
                content={replyText}
                onChange={setReplyText}
                placeholder="Type your reply..."
                className="min-h-[100px]"
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
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Customer Context Sidebar */}
      <div className="w-64 space-y-3" data-testid="customer-context-sidebar">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <UserCircle className="h-5 w-5 mr-2" />
              Klantcontext
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/cases/${caseItem.id}`} data-testid={`view-case-${caseItem.id}`}>
                            Bekijken
                          </a>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => linkToCaseMutation.mutate('')}
                          disabled={linkToCaseMutation.isPending}
                          data-testid={`unlink-case-${caseItem.id}`}
                        >
                          Ontkoppel
                        </Button>
                      </div>
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
                          <SelectTrigger className="flex-1" data-testid="case-select-trigger">
                            <SelectValue placeholder="Selecteer case..." />
                          </SelectTrigger>
                          <SelectContent data-testid="case-select-content">
                            {allCases.map((caseItem) => (
                              <SelectItem key={caseItem.id} value={caseItem.id} data-testid={`case-option-${caseItem.id}`}>
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

            {/* Order Linking - Simplified working version */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground mb-2">Order Koppeling</div>
              
              {thread.orderId ? (
                <div className="p-4 bg-muted rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Gekoppelde Order</div>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => linkToOrderMutation.mutate('')}
                      disabled={linkToOrderMutation.isPending}
                      data-testid="unlink-order-button"
                    >
                      Ontkoppel
                    </Button>
                  </div>
                  
                  {linkedOrder ? (
                    <div className="space-y-3">
                      {/* Order Header */}
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">Order {linkedOrder.orderNumber}</span>
                        <Badge variant="outline" className="text-xs">
                          {linkedOrder.status}
                        </Badge>
                      </div>

                      {/* Customer Info */}
                      {linkedOrder.orderData?.customer && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Klantnaam</div>
                            <div className="text-sm">
                              {linkedOrder.orderData.customer.first_name} {linkedOrder.orderData.customer.last_name}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Totaal uitgegeven</div>
                            <div className="text-sm font-medium">
                              €{((linkedOrder.totalAmount || 0) / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Address */}
                      {linkedOrder.orderData?.customer?.default_address && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Adres</div>
                          <div className="text-sm">
                            {linkedOrder.orderData.customer.default_address.address1}
                            {linkedOrder.orderData.customer.default_address.address2 && 
                              `, ${linkedOrder.orderData.customer.default_address.address2}`
                            }<br/>
                            {linkedOrder.orderData.customer.default_address.zip} {linkedOrder.orderData.customer.default_address.city}<br/>
                            {linkedOrder.orderData.customer.default_address.country}
                          </div>
                        </div>
                      )}

                      {/* Order Items */}
                      {linkedOrder.orderData?.line_items && linkedOrder.orderData.line_items.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-2">Aangekochte artikelen</div>
                          <div className="space-y-2">
                            {linkedOrder.orderData.line_items.map((item: any, index: number) => (
                              <div key={index} className="flex justify-between items-start p-2 bg-background rounded border">
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{item.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    SKU: {item.sku} • Qty: {item.quantity}
                                  </div>
                                </div>
                                <div className="text-sm font-medium ml-2">
                                  €{parseFloat(item.price).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tracking Information */}
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2">Tracking gegevens</div>
                        {linkedOrder.orderData?.fulfillments && linkedOrder.orderData.fulfillments.length > 0 ? (
                          <div className="space-y-2">
                            {linkedOrder.orderData.fulfillments.map((fulfillment: any, index: number) => (
                              <div key={index} className="p-2 bg-background rounded border">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      {fulfillment.tracking_company || 'Vervoerder onbekend'}
                                    </div>
                                    {fulfillment.tracking_number && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Tracking: {fulfillment.tracking_number}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      Status: {fulfillment.status || 'Onbekend'}
                                    </div>
                                  </div>
                                  {fulfillment.tracking_url && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => window.open(fulfillment.tracking_url, '_blank', 'noopener,noreferrer')}
                                      data-testid="track-shipment-button"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Track
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 bg-background rounded border text-center">
                            <div className="text-sm text-muted-foreground">
                              Geen tracking informatie beschikbaar
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShoppingCart className="h-3 w-3" />
                      Order ID: {thread.orderId} (laden...)
                    </div>
                  )}
                </div>
              ) : (
                allOrders && allOrders.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                        <SelectTrigger className="flex-1" data-testid="order-select-trigger">
                          <SelectValue placeholder="Selecteer order..." />
                        </SelectTrigger>
                        <SelectContent data-testid="order-select-content" className="max-h-60 overflow-y-auto">
                          {(allOrders || [])
                            .slice()
                            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                            .slice(0, 20)
                            .map((order) => (
                              <SelectItem key={order.id} value={order.id} data-testid={`order-option-${order.id}`}>
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