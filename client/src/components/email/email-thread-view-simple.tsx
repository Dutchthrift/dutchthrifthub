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

// Simple test version without complex order dropdown
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!thread) {
    return <div>Thread not found</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <h1>Simple Email Thread View - Test</h1>
      <p>Thread: {thread.subject}</p>
      <p>From: {thread.customerEmail}</p>
    </div>
  );
}