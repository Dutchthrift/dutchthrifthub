import { useState } from "react";
import { useParams, useLocation } from "wouter";
import type { User } from "@shared/schema";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Mail,
  Package,
  Wrench,
  CheckSquare,
  StickyNote,
  Calendar,
  User as UserIcon,
  AlertTriangle,
  Clock,
  Link as LinkIcon,
  Unlink,
  Plus,
  MessageSquare,
  Activity,
  FileText
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Case, CaseWithDetails, EmailThread, Order, Repair, Todo } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotesPanel } from "@/components/notes/NotesPanel";

const CASE_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_customer", label: "Waiting Customer" },
  { value: "waiting_part", label: "Waiting Part" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function CaseDetail() {
  const params = useParams();
  const caseId = params.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showSlaDialog, setShowSlaDialog] = useState(false);
  const [slaDeadline, setSlaDeadline] = useState("");
  const [linkType, setLinkType] = useState<"email" | "order" | "repair" | "todo" | "">("");
  const [linkedId, setLinkedId] = useState("");
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: caseData, isLoading } = useQuery<CaseWithDetails>({
    queryKey: ["/api/cases", caseId],
    enabled: !!caseId,
  });

  const { data: relatedEmails } = useQuery<EmailThread[]>({
    queryKey: ["/api/email-threads", "caseId", caseId],
    queryFn: async () => {
      const response = await fetch(`/api/email-threads?caseId=${caseId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch related emails');
      return response.json();
    },
    enabled: !!caseId,
  });

  const { data: relatedOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders", "caseId", caseId],
    queryFn: async () => {
      const response = await fetch(`/api/orders?caseId=${caseId}`);
      if (!response.ok) throw new Error('Failed to fetch related orders');
      return response.json();
    },
    enabled: !!caseId,
  });

  const { data: relatedRepairs } = useQuery<Repair[]>({
    queryKey: ["/api/repairs", "caseId", caseId],
    queryFn: async () => {
      const response = await fetch(`/api/repairs?caseId=${caseId}`);
      if (!response.ok) throw new Error('Failed to fetch related repairs');
      return response.json();
    },
    enabled: !!caseId,
  });

  const { data: relatedTodos } = useQuery<Todo[]>({
    queryKey: ["/api/todos", "caseId", caseId],
    queryFn: async () => {
      const response = await fetch(`/api/todos?caseId=${caseId}`);
      if (!response.ok) throw new Error('Failed to fetch related todos');
      return response.json();
    },
    enabled: !!caseId,
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error("Not authenticated");
      const data = await response.json();
      return data.user;
    },
  });



  const { data: caseEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/cases", caseId, "events"],
    enabled: !!caseId,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users/list"],
  });

  const { data: caseLinks = [] } = useQuery<any[]>({
    queryKey: ["/api/cases", caseId, "links"],
    enabled: !!caseId && showLinkDialog,
  });

  const { data: allEmails = [] } = useQuery<any[]>({
    queryKey: ["/api/email-threads"],
    enabled: showLinkDialog && linkType === "email",
  });

  const { data: allOrdersResponse } = useQuery<any>({
    queryKey: ["/api/orders", { page: 1, limit: 1000 }],
    queryFn: async () => {
      const response = await fetch("/api/orders?page=1&limit=1000");
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: showLinkDialog && linkType === "order",
  });

  const allOrders = allOrdersResponse?.orders || [];

  const { data: allRepairsResponse } = useQuery<any>({
    queryKey: ["/api/repairs"],
    queryFn: async () => {
      const response = await fetch("/api/repairs");
      if (!response.ok) throw new Error("Failed to fetch repairs");
      const data = await response.json();
      return Array.isArray(data) ? data : (data.repairs || []);
    },
    enabled: showLinkDialog && linkType === "repair",
  });

  const allRepairs = Array.isArray(allRepairsResponse) ? allRepairsResponse : (allRepairsResponse?.repairs || allRepairsResponse || []);

  const { data: allTodosResponse } = useQuery<any>({
    queryKey: ["/api/todos"],
    queryFn: async () => {
      const response = await fetch("/api/todos");
      if (!response.ok) throw new Error("Failed to fetch todos");
      const data = await response.json();
      return Array.isArray(data) ? data : (data.todos || []);
    },
    enabled: showLinkDialog && linkType === "todo",
  });

  const allTodos = Array.isArray(allTodosResponse) ? allTodosResponse : (allTodosResponse?.todos || allTodosResponse || []);

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Case> }) => {
      const response = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      toast({
        title: "Case updated",
        description: "Case has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update case",
        variant: "destructive",
      });
    }
  });



  const assignCaseMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: userId }),
      });
      if (!response.ok) throw new Error("Failed to assign case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "events"] });
      setShowAssignDialog(false);
      setSelectedUserId("");
      toast({
        title: "Case assigned",
        description: "Case has been assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to assign case",
        description: "Could not assign case to user",
        variant: "destructive",
      });
    }
  });

  const setSlaMutation = useMutation({
    mutationFn: async (deadline: string) => {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slaDeadline: deadline }),
      });
      if (!response.ok) throw new Error("Failed to set SLA deadline");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "events"] });
      setShowSlaDialog(false);
      setSlaDeadline("");
      toast({
        title: "SLA deadline set",
        description: "SLA deadline has been set successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to set SLA",
        description: "Could not set SLA deadline",
        variant: "destructive",
      });
    }
  });

  const linkItemMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const response = await fetch(`/api/cases/${caseId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkType: type, linkedId: id }),
      });
      if (!response.ok) throw new Error("Failed to link item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", "caseId", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", "caseId", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/repairs", "caseId", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/todos", "caseId", caseId] });
      setShowLinkDialog(false);
      setLinkType("");
      setLinkedId("");
      toast({
        title: "Item linked",
        description: "Item has been linked to case successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to link item",
        description: "Could not link item to case",
        variant: "destructive",
      });
    }
  });

  const convertToReturnMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/returns/from-case/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to convert case to return");
      return response.json();
    },
    onSuccess: (returnData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      setShowConvertDialog(false);
      toast({
        title: "Return created",
        description: `Return ${returnData.returnNumber} created successfully from this case`,
      });
      // Navigate to the new return
      setLocation(`/returns/${returnData.id}`);
    },
    onError: () => {
      toast({
        title: "Failed to convert",
        description: "Could not convert case to return",
        variant: "destructive",
      });
    }
  });

  const handleStartEdit = () => {
    if (caseData) {
      setEditTitle(caseData.title);
      setEditDescription(caseData.description || "");
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (caseData && caseId) {
      updateCaseMutation.mutate({
        id: caseId,
        data: {
          title: editTitle,
          description: editDescription || null
        }
      });
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
    setEditDescription("");
  };

  const handleStatusChange = (newStatus: string) => {
    if (caseData && caseId) {
      updateCaseMutation.mutate({
        id: caseId,
        data: { status: newStatus as any }
      });
    }
  };

  const handlePriorityChange = (newPriority: string) => {
    if (caseData && caseId) {
      updateCaseMutation.mutate({
        id: caseId,
        data: { priority: newPriority as any }
      });
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30";
      case "high": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30";
      case "medium": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30";
      case "low": return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30";
      default: return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30";
      case "in_progress": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30";
      case "waiting_customer": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30";
      case "waiting_part": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30";
      case "resolved": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30";
      case "closed": return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30";
      default: return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30";
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Not set";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'Not available';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString();
  };

  const getAvailableItems = () => {
    const linkedIds = caseLinks.map((link: any) => link.linkedId);

    switch (linkType) {
      case "email":
        return allEmails.filter((item: any) => !linkedIds.includes(item.id));
      case "order":
        return allOrders.filter((item: any) => !linkedIds.includes(item.id));
      case "repair":
        return allRepairs.filter((item: any) => !linkedIds.includes(item.id));
      case "todo":
        return allTodos.filter((item: any) => !linkedIds.includes(item.id));
      default:
        return [];
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-4"></div>
            <div className="grid gap-6">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-2">Case not found</h2>
            <p className="text-muted-foreground mb-4">The case you're looking for doesn't exist.</p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="case-detail-page">
      <Navigation />

      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8" data-testid="case-header">
          <div className="flex items-start space-x-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="back-button" className="mt-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-medium tracking-tight">Case #{caseData.caseNumber}</h1>
                <Badge className={`${getStatusColor(caseData.status)} text-sm font-normal px-3 py-1`} data-testid="case-status-badge">
                  {CASE_STATUS_OPTIONS.find(s => s.value === caseData.status)?.label}
                </Badge>
                <Badge className={`${getPriorityColor(caseData.priority)} text-sm font-normal px-3 py-1`} data-testid="case-priority-badge">
                  {caseData.priority}
                </Badge>
              </div>
              <p className="text-muted-foreground font-light mt-1">
                Created {formatDateTime(caseData.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Select value={caseData.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40" data-testid="status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASE_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={caseData.priority || undefined} onValueChange={handlePriorityChange}>
              <SelectTrigger className="w-32" data-testid="priority-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setShowEmailDialog(true)} data-testid="send-email-button">
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>

            <Button variant="outline" onClick={() => setShowConvertDialog(true)} data-testid="convert-to-return-button">
              <Package className="mr-2 h-4 w-4" />
              Convert to Return
            </Button>
          </div>
        </div>

        {/* Case Details */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Case Information */}
            <Card data-testid="case-information" className="border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Case Information</CardTitle>
                  {isEditing ? (
                    <div className="flex items-center space-x-2">
                      <Button size="sm" onClick={handleSaveEdit} data-testid="save-edit-button">
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit} data-testid="cancel-edit-button">
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleStartEdit} data-testid="edit-case-button">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  {isEditing ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      data-testid="edit-title-input"
                    />
                  ) : (
                    <p className="mt-1" data-testid="case-title">{caseData.title}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  {isEditing ? (
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      data-testid="edit-description-input"
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap font-light" data-testid="case-description">
                      {caseData.description || "No description provided"}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer</label>
                    <p className="mt-1 font-light" data-testid="case-customer">
                      {caseData.customer ? (
                        `${caseData.customer.firstName} ${caseData.customer.lastName}`
                      ) : (
                        caseData.customerEmail
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                    <p className="mt-1 font-light" data-testid="case-assignee">
                      {caseData.assignedUser ? (
                        `${caseData.assignedUser.firstName} ${caseData.assignedUser.lastName}`
                      ) : (
                        "Unassigned"
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">SLA Deadline</label>
                    <p className="mt-1 font-light" data-testid="case-sla-deadline">{formatDate(caseData.slaDeadline)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p className="mt-1 font-light" data-testid="case-updated">{formatDateTime(caseData.updatedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card data-testid="case-timeline" className="border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="flex items-center text-lg font-medium">
                  <Activity className="mr-2 h-4 w-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {caseEvents && caseEvents.length > 0 ? (
                  <div className="space-y-4">
                    {caseEvents.map((event: any) => (
                      <div key={event.id} className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-700 pb-4 last:pb-0" data-testid={`timeline-event-${event.id}`}>
                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white dark:border-zinc-900 bg-primary/20 ring-4 ring-white dark:ring-zinc-900" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{event.message}</p>
                          {event.metadata && (
                            <p className="text-xs text-muted-foreground mt-1 font-light">
                              {JSON.stringify(event.metadata)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 font-light">
                            {formatDateTime(event.createdAt)} • {event.createdByUser?.username || 'System'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No timeline events yet</p>
                )}
              </CardContent>
            </Card>

            {/* Related Items Tabs */}
            <Card data-testid="related-items" className="border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
              <Tabs defaultValue="emails" className="w-full">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Related Items</CardTitle>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="emails" data-testid="emails-tab">
                      <Mail className="mr-2 h-4 w-4" />
                      Emails ({relatedEmails?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="orders" data-testid="orders-tab">
                      <Package className="mr-2 h-4 w-4" />
                      Orders ({relatedOrders?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="repairs" data-testid="repairs-tab">
                      <Wrench className="mr-2 h-4 w-4" />
                      Repairs ({relatedRepairs?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="todos" data-testid="todos-tab">
                      <CheckSquare className="mr-2 h-4 w-4" />
                      To-dos ({relatedTodos?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="notes" data-testid="notes-tab">
                      <StickyNote className="mr-2 h-4 w-4" />
                      Notes
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent>
                  <TabsContent value="emails" className="space-y-4" data-testid="emails-content">
                    {relatedEmails?.length ? (
                      relatedEmails.map(email => (
                        <div key={email.id} className="border rounded p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{email.subject}</h4>
                            <Badge variant={email.isUnread ? "default" : "secondary"}>
                              {email.isUnread ? "Unread" : "Read"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            From: {email.customerEmail}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(email.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No emails linked to this case</p>
                    )}
                  </TabsContent>

                  <TabsContent value="orders" className="space-y-4" data-testid="orders-content">
                    {relatedOrders?.length ? (
                      relatedOrders.map(order => (
                        <div key={order.id} className="border rounded p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">Order {order.orderNumber}</h4>
                            <Badge>{order.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.customerEmail} • €{((order.totalAmount || 0) / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No orders linked to this case</p>
                    )}
                  </TabsContent>

                  <TabsContent value="repairs" className="space-y-4" data-testid="repairs-content">
                    {relatedRepairs?.length ? (
                      relatedRepairs.map(repair => (
                        <div key={repair.id} className="border rounded p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{repair.title}</h4>
                            <Badge>{repair.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {repair.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Priority: {repair.priority} • {formatDateTime(repair.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No repairs linked to this case</p>
                    )}
                  </TabsContent>

                  <TabsContent value="todos" className="space-y-4" data-testid="todos-content">
                    {relatedTodos?.length ? (
                      relatedTodos.map(todo => (
                        <div key={todo.id} className="border rounded p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{todo.title}</h4>
                            <Badge>{todo.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {todo.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Priority: {todo.priority} • Due: {formatDate(todo.dueDate)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No todos linked to this case</p>
                    )}
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-4" data-testid="notes-content">
                    {currentUser && (
                      <NotesPanel entityType="case" entityId={caseId!} currentUser={currentUser} />
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card data-testid="quick-actions" className="border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" variant="outline" onClick={() => setShowEmailDialog(true)} data-testid="button-send-email-quick-action">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setShowAssignDialog(true)} data-testid="assign-case-button">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Assign Case
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setShowLinkDialog(true)} data-testid="link-items-button">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Link Items
                </Button>

                <Button className="w-full justify-start" variant="outline" onClick={() => setShowSlaDialog(true)} data-testid="set-sla-button">
                  <Clock className="mr-2 h-4 w-4" />
                  Set SLA
                </Button>
              </CardContent>
            </Card>

            {/* Case Statistics */}
            <Card data-testid="case-stats" className="border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Case Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Emails</span>
                  <span className="text-sm font-medium">{relatedEmails?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Orders</span>
                  <span className="text-sm font-medium">{relatedOrders?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Repairs</span>
                  <span className="text-sm font-medium">{relatedRepairs?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">To-dos</span>
                  <span className="text-sm font-medium">{relatedTodos?.length || 0}</span>
                </div>

              </CardContent>
            </Card>
          </div>
        </div>
      </main>



      {/* Assign Case Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent data-testid="assign-case-dialog">
          <DialogHeader>
            <DialogTitle>Assign Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="user-select">
                  <SelectValue placeholder="Choose a user to assign..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id} data-testid={`user-option-${user.id}`}>
                      {user.firstName} {user.lastName} ({user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  setSelectedUserId("");
                }}
                data-testid="cancel-assign-button"
              >
                Cancel
              </Button>
              <Button
                onClick={() => assignCaseMutation.mutate(selectedUserId)}
                disabled={!selectedUserId || assignCaseMutation.isPending}
                data-testid="save-assign-button"
              >
                {assignCaseMutation.isPending ? "Assigning..." : "Assign Case"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set SLA Dialog */}
      <Dialog open={showSlaDialog} onOpenChange={setShowSlaDialog}>
        <DialogContent data-testid="set-sla-dialog">
          <DialogHeader>
            <DialogTitle>Set SLA Deadline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Deadline Date</label>
              <Input
                type="datetime-local"
                value={slaDeadline}
                onChange={(e) => setSlaDeadline(e.target.value)}
                data-testid="sla-deadline-input"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSlaDialog(false);
                  setSlaDeadline("");
                }}
                data-testid="cancel-sla-button"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setSlaMutation.mutate(slaDeadline)}
                disabled={!slaDeadline || setSlaMutation.isPending}
                data-testid="save-sla-button"
              >
                {setSlaMutation.isPending ? "Setting..." : "Set Deadline"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Items Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent data-testid="link-items-dialog">
          <DialogHeader>
            <DialogTitle>Link Item to Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Item Type</label>
              <Select value={linkType} onValueChange={(value: any) => {
                setLinkType(value);
                setLinkedId("");
              }}>
                <SelectTrigger data-testid="link-type-select">
                  <SelectValue placeholder="Select item type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email" data-testid="link-type-email">Email</SelectItem>
                  <SelectItem value="order" data-testid="link-type-order">Order</SelectItem>
                  <SelectItem value="repair" data-testid="link-type-repair">Repair</SelectItem>
                  <SelectItem value="todo" data-testid="link-type-todo">Todo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {linkType && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Item</label>
                <Select value={linkedId} onValueChange={setLinkedId}>
                  <SelectTrigger data-testid="linked-item-select">
                    <SelectValue placeholder={`Select ${linkType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableItems().length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No available {linkType}s to link
                      </div>
                    ) : (
                      <>
                        {linkType === "email" && getAvailableItems().map((email: any) => (
                          <SelectItem key={email.id} value={email.id} data-testid={`link-email-${email.id}`}>
                            {email.subject}
                          </SelectItem>
                        ))}
                        {linkType === "order" && getAvailableItems().map((order: any) => (
                          <SelectItem key={order.id} value={order.id} data-testid={`link-order-${order.id}`}>
                            Order {order.orderNumber}
                          </SelectItem>
                        ))}
                        {linkType === "repair" && getAvailableItems().map((repair: any) => (
                          <SelectItem key={repair.id} value={repair.id} data-testid={`link-repair-${repair.id}`}>
                            {repair.title}
                          </SelectItem>
                        ))}
                        {linkType === "todo" && getAvailableItems().map((todo: any) => (
                          <SelectItem key={todo.id} value={todo.id} data-testid={`link-todo-${todo.id}`}>
                            {todo.title}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkType("");
                  setLinkedId("");
                }}
                data-testid="cancel-link-button"
              >
                Cancel
              </Button>
              <Button
                onClick={() => linkItemMutation.mutate({ type: linkType, id: linkedId })}
                disabled={!linkType || !linkedId || linkItemMutation.isPending}
                data-testid="save-link-button"
              >
                {linkItemMutation.isPending ? "Linking..." : "Link Item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <EmailCompose
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        to={caseData?.customerEmail || ""}
        subject={`Re: Case #${caseData?.caseNumber || caseId}`}
      />

      {/* Convert to Return Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent data-testid="convert-to-return-dialog">
          <DialogHeader>
            <DialogTitle>Convert Case to Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will create a new return linked to this case. The return will inherit the case's customer and priority.
            </p>
            <p className="text-sm text-muted-foreground">
              You can add return items and details on the return page after creation.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowConvertDialog(false)}
                data-testid="cancel-convert-button"
              >
                Cancel
              </Button>
              <Button
                onClick={() => convertToReturnMutation.mutate()}
                disabled={convertToReturnMutation.isPending}
                data-testid="confirm-convert-button"
              >
                {convertToReturnMutation.isPending ? "Converting..." : "Convert to Return"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}