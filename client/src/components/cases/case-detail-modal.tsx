import { useState, useEffect } from "react";
import type { User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit,
  Save,
  X,
  Mail,
  Package,
  Wrench,
  CheckSquare,
  Link as LinkIcon,
  MessageSquare,
  Activity as ActivityIcon,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle,
  Circle,
  ArrowRight,
  Truck,
  CreditCard,
  AlertTriangle,
  HelpCircle,
  ShoppingCart,
  Pencil,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Case, CaseWithDetails, EmailThread, Order, Repair, Todo, Return } from "@/lib/types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useLocation } from "wouter";

const CASE_STATUS_OPTIONS = [
  { value: "new", label: "Nieuw", color: "text-emerald-500", emoji: "🆕" },
  { value: "in_progress", label: "In Behandeling", color: "text-blue-500", emoji: "🔄" },
  { value: "waiting_customer", label: "Wacht op Klant", color: "text-amber-500", emoji: "⏳" },
  { value: "resolved", label: "Opgelost", color: "text-green-500", emoji: "✅" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Laag", emoji: "🟢" },
  { value: "medium", label: "Normaal", emoji: "🟡" },
  { value: "high", label: "Hoog", emoji: "🟠" },
  { value: "urgent", label: "Urgent", emoji: "🔴" },
];

const getPriorityBadgeClass = (priority: string | null) => {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300";
    case "medium": return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300";
    case "low": return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/40 dark:text-slate-300";
    default: return "bg-gray-100 text-gray-600 border-gray-300";
  }
};

const CASE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  return_request: { label: "Retour", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Package },
  complaint: { label: "Klacht", color: "bg-red-100 text-red-700 border-red-300", icon: AlertTriangle },
  shipping_issue: { label: "Verzending", color: "bg-orange-100 text-orange-700 border-orange-300", icon: Truck },
  payment_issue: { label: "Betaling", color: "bg-purple-100 text-purple-700 border-purple-300", icon: CreditCard },
  general: { label: "Algemeen", color: "bg-gray-100 text-gray-700 border-gray-300", icon: FileText },
  other: { label: "Overig", color: "bg-slate-100 text-slate-700 border-slate-300", icon: HelpCircle },
};

const CASE_SOURCE_CONFIG: Record<string, { label: string; icon: any }> = {
  email: { label: "Email", icon: Mail },
  shopify: { label: "Shopify", icon: ShoppingCart },
  manual: { label: "Handmatig", icon: Pencil },
};

const getDaysOpen = (createdAt: string | Date | null): number => {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
};

const getDaysOpenColor = (days: number): string => {
  if (days > 7) return "text-red-600 bg-red-100";
  if (days > 3) return "text-orange-600 bg-orange-100";
  return "text-muted-foreground bg-muted";
};

interface CaseDetailModalProps {
  caseId: string;
  initialData?: CaseWithDetails;
  open: boolean;
  onClose: () => void;
}

export function CaseDetailModal({ caseId, initialData, open, onClose }: CaseDetailModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [showActivity, setShowActivity] = useState(false);
  const [showRelatedItems, setShowRelatedItems] = useState(true);
  const [linkType, setLinkType] = useState<"email" | "order" | "repair" | "todo" | "return" | "">("order");
  const [linkSearchTerm, setLinkSearchTerm] = useState("");
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);

  const { data: caseData, isLoading } = useQuery<CaseWithDetails>({
    queryKey: ["/api/cases", caseId],
    enabled: !!caseId && open,
    initialData: initialData,
    staleTime: 0,
  });

  const caseLinksData = caseData?.links || [];
  const caseEvents = caseData?.events || [];

  const { data: linkedEmails = [] } = useQuery<EmailThread[]>({
    queryKey: ["/api/email-threads", "caseId", caseId],
    queryFn: async () => {
      const response = await fetch(`/api/email-threads?caseId=${caseId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch related emails');
      return response.json();
    },
    enabled: !!caseId && open,
  });

  const { data: allEmailsData = [] } = useQuery<EmailThread[]>({
    queryKey: ["/api/email-threads"],
    queryFn: async () => {
      const response = await fetch(`/api/email-threads?limit=100`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch emails');
      const data = await response.json();
      return data.items || [];
    },
    enabled: !!caseId && open && linkType === "email",
  });

  // Always fetch orders when modal is open (for both displaying links and searching)
  // This avoids timing issues with caseData.links being undefined on first render
  const { data: allOrdersData } = useQuery<any>({
    queryKey: ["/api/orders", { page: 1, limit: 100 }],
    queryFn: async () => {
      const response = await fetch("/api/orders?page=1&limit=100");
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: !!caseId && open,
  });

  // Always fetch repairs and todos when modal is open
  const { data: allRepairsData } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
    enabled: !!caseId && open,
  });

  const { data: allTodosData } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
    enabled: !!caseId && open,
  });

  // Fetch returns for linking
  const { data: allReturnsData = [] } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
    enabled: !!caseId && open,
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

  // Extract linked entity IDs
  const linkedOrderIds = caseLinksData.filter((link: any) => link.linkType === "order").map((link: any) => link.linkedId);
  const linkedRepairIds = caseLinksData.filter((link: any) => link.linkType === "repair").map((link: any) => link.linkedId);
  const linkedTodoIds = caseLinksData.filter((link: any) => link.linkType === "todo").map((link: any) => link.linkedId);
  const linkedReturnIds = caseLinksData.filter((link: any) => link.linkType === "return").map((link: any) => link.linkedId);

  const { data: caseRelatedOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders", { caseId }],
    queryFn: async () => {
      if (!caseId) return [];
      const res = await fetch(`/api/orders?caseId=${caseId}`);
      if (!res.ok) throw new Error("Failed to fetch related orders");
      return res.json();
    },
    enabled: !!caseId && open,
  });

  const relatedOrders = caseRelatedOrders || [];

  const relatedRepairs = (allRepairsData || []).filter((repair: Repair) => linkedRepairIds.includes(repair.id));
  const relatedTodos = (allTodosData || []).filter((todo: Todo) => linkedTodoIds.includes(todo.id));
  const relatedReturns = (allReturnsData || []).filter((returnItem: Return) => linkedReturnIds.includes(returnItem.id));

  useEffect(() => {
    if (caseData) {
      setEditForm({
        title: caseData.title || "",
        description: caseData.description || "",
      });
    }
  }, [caseData]);

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Case> }) => {
      const response = await apiRequest("PATCH", `/api/cases/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setIsEditing(false);
      toast({ title: "Case bijgewerkt" });
    },
    onError: () => {
      toast({ title: "Bijwerken mislukt", variant: "destructive" });
    }
  });

  const linkItemMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/links`, {
        linkType: type,
        linkedId: id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", "caseId", caseId] });
      setLinkSearchTerm("");
      setLinkType("");
      toast({ title: "Item gekoppeld" });
    },
  });

  const unlinkEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await apiRequest("DELETE", `/api/cases/${caseId}/emails/${emailId}`, undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads", "caseId", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      toast({ title: "Email ontkoppeld" });
    },
  });

  const unlinkItemMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const response = await apiRequest("DELETE", `/api/cases/${caseId}/links/${linkId}`, undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      toast({ title: "Item ontkoppeld" });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/cases/${caseId}`, undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "Case verwijderd" });
      onClose();
    },
  });

  const handleSaveEdit = () => {
    updateCaseMutation.mutate({
      id: caseId,
      data: { title: editForm.title, description: editForm.description },
    });
  };

  const getFilteredSearchResults = () => {
    const search = linkSearchTerm.toLowerCase().trim();
    const linkedIds = caseLinksData.map((link: any) => link.linkedId);
    let results: any[] = [];

    if (linkType === "email") {
      results = (allEmailsData || []).filter((email: any) =>
        !linkedIds.includes(email.id) &&
        (!search || email.subject?.toLowerCase().includes(search) || email.customerEmail?.toLowerCase().includes(search))
      ).slice(0, 10);
    } else if (linkType === "order") {
      results = (allOrdersData?.orders || []).filter((order: any) =>
        !linkedIds.includes(order.id) &&
        (!search || order.orderNumber?.toString().includes(search) || order.customerEmail?.toLowerCase().includes(search))
      ).slice(0, 10);
    } else if (linkType === "repair") {
      results = (allRepairsData || []).filter((repair: any) =>
        !linkedIds.includes(repair.id) && (!search || repair.title?.toLowerCase().includes(search))
      ).slice(0, 10);
    } else if (linkType === "todo") {
      results = (allTodosData || []).filter((todo: any) =>
        !linkedIds.includes(todo.id) && (!search || todo.title?.toLowerCase().includes(search))
      ).slice(0, 10);
    } else if (linkType === "return") {
      results = (allReturnsData || []).filter((returnItem: any) =>
        !linkedIds.includes(returnItem.id) &&
        (!search || returnItem.returnNumber?.toLowerCase().includes(search) ||
          returnItem.shopifyReturnName?.toLowerCase().includes(search))
      ).slice(0, 10);
    }
    return results;
  };

  const searchResults = getFilteredSearchResults();

  const getStatusIndex = (status: string) => CASE_STATUS_OPTIONS.findIndex(s => s.value === status);

  if (isLoading || !caseData) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden !flex !flex-col p-0 gap-0 [&>button]:hidden">
          <DialogDescription className="sr-only">Details van case worden geladen</DialogDescription>
          <div className="px-5 pt-4 pb-3 border-b">
            <DialogTitle className="text-xl font-semibold">Laden...</DialogTitle>
          </div>
          <div className="flex-1 p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-20 bg-muted rounded"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentStatusIndex = getStatusIndex(caseData.status);
  const statusLabel = CASE_STATUS_OPTIONS.find(s => s.value === caseData.status)?.label || caseData.status;
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === caseData.priority)?.label || caseData.priority;
  const totalRelatedItems = linkedEmails.length + relatedOrders.length + relatedRepairs.length + relatedTodos.length + relatedReturns.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden !flex !flex-col p-0 gap-0 [&>button]:hidden">
          <DialogDescription className="sr-only">Details en acties voor case {caseData.title}</DialogDescription>
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-semibold">Case {caseData.caseNumber}</DialogTitle>
                  <Badge className={`font-mono text-xs shrink-0 ${getPriorityBadgeClass(caseData.priority)}`}>
                    {priorityLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                  {/* Case Type Badge */}
                  {(() => {
                    const caseType = (caseData as any).caseType || 'general';
                    const typeConfig = CASE_TYPE_CONFIG[caseType];
                    const TypeIcon = typeConfig?.icon || FileText;
                    return (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${typeConfig?.color || ''}`}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {caseType === 'other'
                          ? ((caseData as any).otherTypeDescription || 'Overig').slice(0, 15)
                          : typeConfig?.label}
                      </Badge>
                    );
                  })()}
                  {/* Source Icon */}
                  {(() => {
                    const source = (caseData as any).source || 'manual';
                    const sourceConfig = CASE_SOURCE_CONFIG[source];
                    const SourceIcon = sourceConfig?.icon || Pencil;
                    return (
                      <span className="flex items-center gap-1 text-xs" title={`Bron: ${sourceConfig?.label}`}>
                        <SourceIcon className="h-3.5 w-3.5" />
                      </span>
                    );
                  })()}
                  <span className="mx-0.5">•</span>
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[150px]">{caseData.customerEmail || "Geen klant"}</span>
                  {caseData.createdAt && (
                    <>
                      <span className="mx-0.5">•</span>
                      <span>{format(new Date(caseData.createdAt), "d MMM", { locale: nl })}</span>
                    </>
                  )}
                  {/* Days Open */}
                  {caseData.status !== 'resolved' && (
                    <>
                      <span className="mx-0.5">•</span>
                      {(() => {
                        const days = getDaysOpen(caseData.createdAt);
                        return (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getDaysOpenColor(days)}`}>
                            <Clock className="h-3 w-3 inline mr-0.5" />{days}d open
                          </span>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
              {/* Icon Buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                {isEditing ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      className="h-8 w-8 rounded-full text-slate-600 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateCaseMutation.isPending}
                      className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-full px-3"
                    >
                      <Save className="h-3 w-3 mr-1" />Opslaan
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsEditing(true)}
                      className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-100"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowNotes(!showNotes)}
                      className={`h-8 w-8 rounded-full ${showNotes ? 'text-purple-600 bg-purple-100' : 'text-purple-600 hover:bg-purple-100'}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowDeleteDialog(true)}
                      className="h-8 w-8 rounded-full text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={onClose}
                      className="h-8 w-8 rounded-full text-slate-600 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Timeline - Centered like todo modal */}
          <div className="px-5 py-3 border-b">
            <div className="flex items-center justify-center gap-0">
              {CASE_STATUS_OPTIONS.map((status, idx) => {
                const isCompleted = idx < currentStatusIndex;
                const isCurrent = idx === currentStatusIndex;
                return (
                  <div key={status.value} className="flex items-center">
                    <button
                      onClick={() => updateCaseMutation.mutate({ id: caseId, data: { status: status.value as any } })}
                      disabled={updateCaseMutation.isPending}
                      className={`flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-all px-3 py-1 rounded-lg ${isCurrent ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className={`h-6 w-6 ${status.color}`} />
                      ) : isCurrent ? (
                        <div className={`h-6 w-6 rounded-full border-2 ${status.color} border-current flex items-center justify-center`}>
                          <div className="h-2.5 w-2.5 rounded-full bg-current" />
                        </div>
                      ) : (
                        <Circle className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                      )}
                      <span className={`text-[10px] whitespace-nowrap ${isCurrent ? 'font-semibold ' + status.color : 'text-muted-foreground'}`}>
                        {status.emoji} {status.label}
                      </span>
                    </button>
                    {idx < CASE_STATUS_OPTIONS.length - 1 && (
                      <div className={`w-8 h-0.5 ${idx < currentStatusIndex ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="space-y-3">

              {/* Case Details */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Case Details</span>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Titel</label>
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="h-9 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Beschrijving</label>
                      <Textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="text-sm mt-1 min-h-[80px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Titel</div>
                      <div className="text-sm font-medium">{caseData.title}</div>
                    </div>
                    {caseData.description && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Beschrijving</div>
                        <div className="text-sm whitespace-pre-wrap bg-white/50 dark:bg-black/20 rounded p-2">{caseData.description}</div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-blue-200/50">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1.5">Status</div>
                        <Select
                          value={caseData.status}
                          onValueChange={(value) => updateCaseMutation.mutate({ id: caseId, data: { status: value as any } })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CASE_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.emoji} {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1.5">Prioriteit</div>
                        <Select
                          value={caseData.priority || "medium"}
                          onValueChange={(value) => updateCaseMutation.mutate({ id: caseId, data: { priority: value as any } })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.emoji} {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Related Items */}
              <Collapsible open={showRelatedItems} onOpenChange={setShowRelatedItems}>
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors rounded-t-lg">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          🔗 Gekoppelde Items ({totalRelatedItems})
                        </span>
                      </div>
                      {showRelatedItems ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-3">
                      {/* Link Search */}
                      <div className="text-xs text-muted-foreground mb-2">➕ Voeg koppeling toe:</div>
                      <div className="flex gap-2">
                        <Select value={linkType} onValueChange={(v: any) => { setLinkType(v); setLinkSearchTerm(""); }}>
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue placeholder="Type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="order">📦 Order</SelectItem>
                            <SelectItem value="return">↩️ Retour</SelectItem>
                            <SelectItem value="repair">🔧 Reparatie</SelectItem>
                            <SelectItem value="email">📧 Email</SelectItem>
                            <SelectItem value="todo">✅ Todo</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex-1 relative">
                          <Input
                            placeholder={linkType ? "Klik om te zoeken..." : "Selecteer type"}
                            value={linkSearchTerm}
                            onChange={(e) => setLinkSearchTerm(e.target.value)}
                            onFocus={() => setShowLinkDropdown(true)}
                            onBlur={() => setTimeout(() => setShowLinkDropdown(false), 200)}
                            disabled={!linkType}
                            className="h-8 text-xs"
                          />
                          {showLinkDropdown && linkType && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                              {searchResults.map((item: any) => {
                                let date = null;
                                if (linkType === "email") date = item.lastMessageDate || item.date;
                                else if (linkType === "order") date = item.orderDate || item.createdAt;
                                else if (linkType === "return") date = item.requestedAt || item.createdAt;
                                else if (linkType === "repair") date = item.createdAt;
                                else if (linkType === "todo") date = item.dueDate || item.createdAt;

                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => { linkItemMutation.mutate({ type: linkType, id: item.id }); setShowLinkDropdown(false); }}
                                    className="w-full p-2 text-left hover:bg-muted text-xs border-b last:border-0 group"
                                  >
                                    <div className="flex justify-between items-center w-full">
                                      <div className="font-medium truncate flex-1 pr-2">
                                        {linkType === "email" ? item.subject :
                                          linkType === "order" ? `Order ${item.orderNumber}` :
                                            linkType === "return" ? (item.orderNumber ? `Order ${item.orderNumber}` : `Retour ${item.returnNumber || item.shopifyReturnName}`) :
                                              item.title}
                                      </div>
                                      {date && (
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                          {format(new Date(date), "d MMM", { locale: nl })}
                                        </span>
                                      )}
                                    </div>
                                    {(linkType === "email" && item.customerEmail) && (
                                      <div className="text-[10px] text-muted-foreground truncate">{item.customerEmail}</div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Linked Emails */}
                      {linkedEmails.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>Emails ({linkedEmails.length})</span>
                          </div>
                          {linkedEmails.map((email) => (
                            <div key={email.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{email.subject}</div>
                                <div className="text-muted-foreground truncate">{email.customerEmail}</div>
                              </div>
                              <Button size="icon" variant="ghost" onClick={() => unlinkEmailMutation.mutate(email.id)} className="h-6 w-6 flex-shrink-0">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Linked Orders */}
                      {relatedOrders.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Package className="h-3 w-3" />
                            <span>Orders ({relatedOrders.length})</span>
                          </div>
                          {relatedOrders.map((order: Order) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === order.id && l.linkType === "order");
                            return (
                              <div key={order.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs group hover:bg-muted/50 transition-colors">
                                <button
                                  onClick={() => { onClose(); setLocation(`/orders?orderId=${order.id}`); }}
                                  className="min-w-0 flex-1 text-left hover:underline cursor-pointer"
                                >
                                  <div className="font-medium">Order {order.orderNumber}</div>
                                  <div className="text-muted-foreground">
                                    {((order.orderData as any)?.customer?.first_name || (order.orderData as any)?.customer?.last_name)
                                      ? `${(order.orderData as any)?.customer?.first_name || ''} ${(order.orderData as any)?.customer?.last_name || ''}`.trim()
                                      : (order.customerEmail || 'Onbekende klant')}
                                  </div>
                                </button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); link && unlinkItemMutation.mutate(link.id); }} className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Linked Repairs */}
                      {relatedRepairs.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Wrench className="h-3 w-3" />
                            <span>Reparaties ({relatedRepairs.length})</span>
                          </div>
                          {relatedRepairs.map((repair: Repair) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === repair.id && l.linkType === "repair");
                            return (
                              <div key={repair.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs group hover:bg-muted/50 transition-colors">
                                <button
                                  onClick={() => { onClose(); setLocation(`/repairs?repairId=${repair.id}`); }}
                                  className="font-medium truncate text-left hover:underline cursor-pointer flex-1"
                                >
                                  {repair.title}
                                </button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); link && unlinkItemMutation.mutate(link.id); }} className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Linked Returns */}
                      {relatedReturns.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <RotateCcw className="h-3 w-3" />
                            <span>Retouren ({relatedReturns.length})</span>
                          </div>
                          {relatedReturns.map((returnItem: Return) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === returnItem.id && l.linkType === "return");
                            return (
                              <div key={returnItem.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs group hover:bg-muted/50 transition-colors">
                                <button
                                  onClick={() => { onClose(); setLocation(`/returns/${returnItem.id}`); }}
                                  className="min-w-0 flex-1 text-left hover:underline cursor-pointer"
                                >
                                  <div className="font-medium truncate">{returnItem.shopifyReturnName || returnItem.returnNumber}</div>
                                  <div className="text-muted-foreground truncate">{returnItem.status}</div>
                                </button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); link && unlinkItemMutation.mutate(link.id); }} className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Linked Todos */}
                      {relatedTodos.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckSquare className="h-3 w-3" />
                            <span>Todos ({relatedTodos.length})</span>
                          </div>
                          {relatedTodos.map((todo: Todo) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === todo.id && l.linkType === "todo");
                            return (
                              <div key={todo.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs group hover:bg-muted/50 transition-colors">
                                <button
                                  onClick={() => { onClose(); setLocation(`/todos?todoId=${todo.id}`); }}
                                  className="font-medium truncate text-left hover:underline cursor-pointer flex-1"
                                >
                                  {todo.title}
                                </button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); link && unlinkItemMutation.mutate(link.id); }} className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {totalRelatedItems === 0 && (
                        <div className="text-center py-4 border border-dashed rounded">
                          <LinkIcon className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">Geen gekoppelde items</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Activity Timeline */}
              <Collapsible open={showActivity} onOpenChange={setShowActivity}>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors rounded-t-lg">
                      <div className="flex items-center gap-2">
                        <ActivityIcon className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          📊 Activiteit ({caseEvents.length})
                        </span>
                      </div>
                      {showActivity ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      {caseEvents.length === 0 ? (
                        <div className="text-center py-4 border border-dashed rounded">
                          <ActivityIcon className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">Geen activiteiten</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {caseEvents.map((event: any, idx: number) => (
                            <div key={event.id || idx} className="flex gap-2 pb-2 border-b last:border-0 last:pb-0">
                              <div className="flex-shrink-0">
                                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                  <ActivityIcon className="h-2.5 w-2.5 text-muted-foreground" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs">{event.message}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {event.createdAt && format(new Date(event.createdAt), "d MMM 'om' HH:mm", { locale: nl })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Notes */}
              {currentUser && (
                <Collapsible open={showNotes} onOpenChange={setShowNotes}>
                  <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-900/20 transition-colors rounded-t-lg">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-rose-600" />
                          <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">💬 Notities</span>
                        </div>
                        {showNotes ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 pt-0">
                        <NotesPanel
                          entityType="case"
                          entityId={caseId}
                          currentUser={currentUser}
                        />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Case verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert case {caseData?.caseNumber} permanent. Deze actie kan niet ongedaan worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCaseMutation.mutate()}
              disabled={deleteCaseMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCaseMutation.isPending ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
