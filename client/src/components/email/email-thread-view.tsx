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
  Package,
  MoreHorizontal
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { EmailThread, EmailMessage, Case, OrderWithShopifyData } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreateCaseModal } from "@/components/forms/create-case-modal";
import { EmailAttachments } from "./email-attachments";
import { SanitizedEmailContent } from "./sanitized-email-content";
import { EmailThreadSkeleton } from "./email-thread-skeleton";
import { EmailActionBar } from "./email-action-bar";
import { EmailMessageBody } from "./email-message-body";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface EmailThreadViewProps {
  threadId: string;
  initialEmail?: any; // RawEmail from list
}

interface ThreadWithMessages extends EmailThread {
  messages: EmailMessage[];
}

export function EmailThreadView({ threadId, initialEmail }: EmailThreadViewProps) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const { toast } = useToast();

  const { data: fetchedThread, isLoading } = useQuery<ThreadWithMessages>({
    queryKey: ["/api/email-threads", threadId],
    enabled: !initialEmail, // Only fetch if no initial email provided
  });

  // Construct virtual thread from initialEmail if present
  const thread = initialEmail ? {
    id: initialEmail.messageId,
    threadId: initialEmail.conversationId,
    subject: initialEmail.subject,
    customerEmail: initialEmail.from,
    lastActivity: initialEmail.receivedDateTime,
    status: 'open',
    isUnread: initialEmail.isRead === false,
    starred: initialEmail.starred,
    archived: initialEmail.archived,
    orderId: initialEmail.orderId,
    messages: [{
      id: initialEmail.messageId,
      uid: initialEmail.uid,
      threadId: initialEmail.conversationId,
      fromEmail: initialEmail.from,
      toEmail: initialEmail.to,
      subject: initialEmail.subject,
      body: initialEmail.body,
      isHtml: initialEmail.isHtml,
      sentAt: initialEmail.receivedDateTime,
      isRead: initialEmail.isRead,
      hasAttachments: initialEmail.hasAttachment
    }]
  } : fetchedThread;

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
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Mail className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">Select an email to read</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-foreground mb-2 truncate">
              {thread.subject || "No Subject"}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              {thread.status === 'open' && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Open</Badge>
              )}
              {thread.orderId && (
                <Badge variant="outline" className="gap-1">
                  <ShoppingCart className="h-3 w-3" />
                  Order #{thread.orderId}
                </Badge>
              )}
              {linkedCases && linkedCases.length > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Briefcase className="h-3 w-3" />
                  Case #{linkedCases[0].caseNumber}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={closeThread} title="Archive">
              <Archive className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" title="More actions">
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {thread.messages && thread.messages.length > 0 ? (
          thread.messages.map((message, index) => (
            <div key={message.id} className="group">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 mt-1">
                  <AvatarFallback className={cn("text-white text-sm font-medium", getAvatarColor(message.fromEmail))}>
                    {getInitials(message.fromEmail)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-foreground">{message.fromEmail.split('<')[0].trim()}</span>
                      <span className="text-xs text-muted-foreground">&lt;{message.fromEmail}&gt;</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {message.sentAt && formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mb-3">
                    to {message.toEmail}
                  </div>

                  <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                    <EmailMessageBody
                      messageId={message.id}
                      uid={message.uid || 0}
                      initialBody={null}
                      isHtml={message.isHtml || false}
                    />
                  </div>

                  <EmailAttachments messageId={message.id} uid={message.uid || 0} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            No messages in this thread
          </div>
        )}
      </div>

      {/* Email Action Bar - Custom ThriftHub Actions */}
      <div className="px-6 pb-4 border-b">
        <EmailActionBar
          threadId={threadId}
          emailContent={''}
          emailSubject={thread.subject || ''}
          customerEmail={thread.customerEmail || ''}
          uid={thread.messages?.[0]?.uid || undefined}
        />
      </div>

      {/* Reply Box */}
      <div className="p-4 border-t bg-background">
        {showReply ? (
          <div className="border rounded-lg shadow-sm bg-white dark:bg-card">
            <div className="p-2 border-b flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Reply className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Reply to {thread.customerEmail}</span>
            </div>
            <div className="p-4">
              <RichTextEditor
                content={replyText}
                onChange={setReplyText}
                placeholder="Write your reply..."
                className="min-h-[150px] border-0 focus-visible:ring-0 px-0"
              />
            </div>
            <div className="p-2 border-t flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowReply(false)}>
                  Discard
                </Button>
                <Button size="sm" onClick={handleSendReply} disabled={!replyText.trim() || sendReplyMutation.isPending}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start h-12 text-muted-foreground rounded-full px-6 shadow-sm hover:shadow-md transition-all"
            onClick={() => setShowReply(true)}
          >
            <Reply className="h-4 w-4 mr-2" />
            Reply to {thread.customerEmail}...
          </Button>
        )}
      </div>

      <CreateCaseModal
        open={showCreateCase}
        onOpenChange={setShowCreateCase}
        emailThread={thread}
      />
    </div>
  );
}