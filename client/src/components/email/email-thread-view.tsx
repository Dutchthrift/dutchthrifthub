import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Reply,
  Forward,
  Archive,
  Tag,
  User,
  Paperclip,
  Clock,
  ExternalLink,
  Send
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { EmailThread, EmailMessage } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmailThreadViewProps {
  threadId: string;
}

interface ThreadWithMessages extends EmailThread {
  messages: EmailMessage[];
}

export function EmailThreadView({ threadId }: EmailThreadViewProps) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const { toast } = useToast();

  const { data: thread, isLoading } = useQuery<ThreadWithMessages>({
    queryKey: ["/api/email-threads", threadId],
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

  const formatMessageTime = (date: string | null) => {
    if (!date) return "Unknown time";
    const messageDate = new Date(date);
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
    <div className="flex flex-col h-full" data-testid="email-thread-detail">
      {/* Thread Header */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{thread.subject || "No Subject"}</CardTitle>
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
  );
}
