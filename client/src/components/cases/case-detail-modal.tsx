import { useState } from "react";
import type { User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  Save,
  X,
  Mail,
  Package,
  Wrench,
  CheckSquare,
  User as UserIcon,
  Clock,
  Link as LinkIcon,
  MessageSquare,
  Activity as ActivityIcon,
  MoreVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  ExternalLink,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Case, CaseWithDetails, EmailThread, Order, Repair, Todo } from "@/lib/types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { EmailCompose } from "@/components/email/email-compose";

const CASE_STATUS_OPTIONS = [
  { value: "new", label: "Nieuw" },
  { value: "in_progress", label: "In Behandeling" },
  { value: "waiting_customer", label: "Wachtend op Klant" },
  { value: "resolved", label: "Opgelost" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface CaseDetailModalProps {
  caseId: string;
  initialData?: CaseWithDetails;
  open: boolean;
  onClose: () => void;
}

export function CaseDetailModal({ caseId, initialData, open, onClose }: CaseDetailModalProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState("");
  const [linkType, setLinkType] = useState<"email" | "order" | "repair" | "todo" | "">("");
  const [showLinkedEmails, setShowLinkedEmails] = useState(true);
  const [showLinkedOrders, setShowLinkedOrders] = useState(true);
  const [showLinkedRepairs, setShowLinkedRepairs] = useState(true);
  const [showLinkedTodos, setShowLinkedTodos] = useState(true);

  const { data: caseData, isLoading } = useQuery<CaseWithDetails>({
    queryKey: ["/api/cases", caseId],
    enabled: !!caseId && open,
    initialData: initialData,
    staleTime: 0, // Always refetch in background
  });

  // All data now comes from the main case endpoint
  const caseItems = caseData?.items || [];
  const caseLinksData = caseData?.links || [];
  const caseEvents = caseData?.events || [];

  // Fetch the directly linked order (from case.orderId)
  const { data: linkedOrder } = useQuery<any>({
    queryKey: ["/api/orders", caseData?.orderId],
    enabled: !!caseData?.orderId && open,
  });

  // Extract linked entity IDs by type
  const linkedEmailIds = caseLinksData.filter((link: any) => link.linkType === "email").map((link: any) => link.linkedId);
  const linkedOrderIds = caseLinksData.filter((link: any) => link.linkType === "order").map((link: any) => link.linkedId);
  const linkedRepairIds = caseLinksData.filter((link: any) => link.linkType === "repair").map((link: any) => link.linkedId);
  const linkedTodoIds = caseLinksData.filter((link: any) => link.linkType === "todo").map((link: any) => link.linkedId);

  // Only fetch these lists when user is actively trying to link items
  const { data: allEmailsData = [] } = useQuery<EmailThread[]>({
    queryKey: ["/api/email-threads"],
    enabled: !!caseId && open && linkType === "email",
  });

  const { data: allOrdersData } = useQuery<any>({
    queryKey: ["/api/orders", { page: 1, limit: 100 }],
    queryFn: async () => {
      const response = await fetch("/api/orders?page=1&limit=100");
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: !!caseId && open && linkType === "order",
  });

  const { data: allRepairsData } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
    enabled: !!caseId && open && linkType === "repair",
  });

  const { data: allTodosData } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
    enabled: !!caseId && open && linkType === "todo",
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users/list"],
    enabled: open,
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

  // Filter to get only linked items
  const relatedEmails = allEmailsData.filter((email: EmailThread) => linkedEmailIds.includes(email.id));
  const relatedOrders = (allOrdersData?.orders || []).filter((order: Order) => linkedOrderIds.includes(order.id));
  const relatedRepairs = (allRepairsData || []).filter((repair: Repair) => linkedRepairIds.includes(repair.id));
  const relatedTodos = (allTodosData || []).filter((todo: Todo) => linkedTodoIds.includes(todo.id));

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Case> }) => {
      const response = await apiRequest("PATCH", `/api/cases/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
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

  const linkItemMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/links`, {
        linkType: type,
        linkedId: id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      setLinkSearchTerm("");
      setLinkType("");
      toast({
        title: "Item linked",
        description: "Item has been linked to the case",
      });
    },
    onError: () => {
      toast({
        title: "Link failed",
        description: "Failed to link item",
        variant: "destructive",
      });
    }
  });

  const unlinkItemMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const response = await apiRequest("DELETE", `/api/cases/${caseId}/links/${linkId}`, undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      toast({
        title: "Item unlinked",
        description: "Item has been unlinked from the case",
      });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/cases/${caseId}`, undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case deleted",
        description: "Case has been deleted successfully",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete case",
        variant: "destructive",
      });
    }
  });

  const handleStartEdit = () => {
    setEditTitle(caseData?.title || "");
    setEditDescription(caseData?.description || "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateCaseMutation.mutate({
      id: caseId,
      data: { title: editTitle, description: editDescription },
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
    setEditDescription("");
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'Not available';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString();
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "new": return "default";
      case "in_progress": return "secondary";
      case "waiting_customer": return "outline";
      case "resolved": return "success";
      default: return "default";
    }
  };

  const getPriorityVariant = (priority: string | null) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  // Filter available items for linking
  const getFilteredSearchResults = () => {
    if (!linkSearchTerm.trim()) return [];
    
    const search = linkSearchTerm.toLowerCase();
    const linkedIds = caseLinksData.map((link: any) => link.linkedId);
    
    let results: any[] = [];
    
    if (linkType === "email") {
      results = allEmailsData.filter((email: any) => 
        !linkedIds.includes(email.id) &&
        (email.subject?.toLowerCase().includes(search) || email.customerEmail?.toLowerCase().includes(search))
      ).slice(0, 5);
    } else if (linkType === "order") {
      results = (allOrdersData?.orders || []).filter((order: any) =>
        !linkedIds.includes(order.id) &&
        (order.orderNumber?.toString().includes(search) ||
         order.customerEmail?.toLowerCase().includes(search) ||
         order.customerName?.toLowerCase().includes(search))
      ).slice(0, 5);
    } else if (linkType === "repair") {
      results = (allRepairsData || []).filter((repair: any) =>
        !linkedIds.includes(repair.id) &&
        (repair.title?.toLowerCase().includes(search) || repair.description?.toLowerCase().includes(search))
      ).slice(0, 5);
    } else if (linkType === "todo") {
      results = (allTodosData || []).filter((todo: any) =>
        !linkedIds.includes(todo.id) &&
        (todo.title?.toLowerCase().includes(search) || todo.description?.toLowerCase().includes(search))
      ).slice(0, 5);
    }
    
    return results;
  };

  const searchResults = getFilteredSearchResults();

  if (isLoading || !caseData) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Loading Case...</DialogTitle>
          </DialogHeader>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusLabel = CASE_STATUS_OPTIONS.find(s => s.value === caseData.status)?.label || caseData.status;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Sticky Header */}
          <div className="border-b bg-background p-6 sticky top-0 z-10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <DialogTitle className="text-2xl">Case #{caseData.caseNumber}</DialogTitle>
                  <Badge variant={getStatusVariant(caseData.status)} data-testid="case-status-badge">
                    {statusLabel}
                  </Badge>
                  <Badge variant={getPriorityVariant(caseData.priority)} data-testid="case-priority-badge">
                    {caseData.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Created {formatDateTime(caseData.createdAt)} • Customer: {caseData.customerEmail}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowEmailDialog(true)}
                  data-testid="send-email-button"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="delete-case-button"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>

          {/* Two-column scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Left Column: Case Details & Linked Items */}
              <div className="space-y-6">
                {/* Case Info Card */}
                <Card>
                  <CardHeader className="bg-card-header border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Case Details</CardTitle>
                      {!isEditing && (
                        <Button variant="ghost" size="sm" onClick={handleStartEdit} data-testid="edit-case-button">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {isEditing ? (
                      <>
                        <div>
                          <label className="text-sm font-medium">Title</label>
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="mt-1"
                            data-testid="edit-title-input"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Description</label>
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={4}
                            className="mt-1"
                            data-testid="edit-description-input"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveEdit} size="sm" data-testid="save-edit-button">
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button onClick={handleCancelEdit} variant="outline" size="sm" data-testid="cancel-edit-button">
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Title</label>
                          <p className="mt-1" data-testid="case-title">{caseData.title}</p>
                        </div>
                        {caseData.description && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Description</label>
                            <p className="mt-1 whitespace-pre-wrap" data-testid="case-description">{caseData.description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Status</label>
                            <Select
                              value={caseData.status}
                              onValueChange={(value) => updateCaseMutation.mutate({ id: caseId, data: { status: value as any } })}
                            >
                              <SelectTrigger className="mt-1" data-testid="status-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CASE_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Priority</label>
                            <Select
                              value={caseData.priority || "medium"}
                              onValueChange={(value) => updateCaseMutation.mutate({ id: caseId, data: { priority: value as any } })}
                            >
                              <SelectTrigger className="mt-1" data-testid="priority-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRIORITY_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Order Information Card */}
                {linkedOrder && (
                  <Card>
                    <CardHeader className="bg-card-header border-b">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Order Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Order Number</label>
                          <p className="mt-1 font-medium" data-testid="order-number">#{linkedOrder.orderNumber}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Order Date</label>
                          <p className="mt-1" data-testid="order-date">{formatDateTime(linkedOrder.orderDate)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Customer</label>
                          <p className="mt-1" data-testid="order-customer">{linkedOrder.customerName || linkedOrder.customerEmail}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
                          <p className="mt-1 font-medium" data-testid="order-total">€{((linkedOrder.totalAmount || 0) / 100).toFixed(2)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Status</label>
                          <Badge variant="secondary" className="mt-1" data-testid="order-status">{linkedOrder.status}</Badge>
                        </div>
                      </div>

                      {/* Shipping Address */}
                      {linkedOrder.orderData?.shipping_address && (
                        <div className="pt-4 border-t">
                          <label className="text-sm font-medium text-muted-foreground">Shipping Address</label>
                          <div className="mt-2 text-sm" data-testid="shipping-address">
                            <p>{linkedOrder.orderData.shipping_address.name}</p>
                            <p>{linkedOrder.orderData.shipping_address.address1}</p>
                            {linkedOrder.orderData.shipping_address.address2 && (
                              <p>{linkedOrder.orderData.shipping_address.address2}</p>
                            )}
                            <p>
                              {linkedOrder.orderData.shipping_address.zip} {linkedOrder.orderData.shipping_address.city}
                            </p>
                            <p>{linkedOrder.orderData.shipping_address.country}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Case Items Card */}
                {caseItems.length > 0 && (
                  <Card>
                    <CardHeader className="bg-card-header border-b">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Case Items ({caseItems.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        {caseItems.map((item: any, index: number) => (
                          <div 
                            key={item.id || index} 
                            className="p-3 border rounded-md space-y-2"
                            data-testid={`case-item-${index}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium" data-testid={`item-product-${index}`}>{item.productName}</p>
                                <p className="text-sm text-muted-foreground" data-testid={`item-sku-${index}`}>SKU: {item.sku}</p>
                              </div>
                              <Badge variant="outline" data-testid={`item-quantity-${index}`}>
                                Qty: {item.quantity}
                              </Badge>
                            </div>
                            {item.itemNotes && (
                              <div className="pt-2 border-t">
                                <label className="text-xs font-medium text-muted-foreground">Notes:</label>
                                <p className="text-sm mt-1 whitespace-pre-wrap" data-testid={`item-notes-${index}`}>
                                  {item.itemNotes}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Linked Items Card */}
                <Card>
                  <CardHeader className="bg-card-header border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LinkIcon className="h-5 w-5" />
                      Related Items ({relatedEmails.length + relatedOrders.length + relatedRepairs.length + relatedTodos.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {/* Quick Link Section */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Link New Item</label>
                      <div className="flex gap-2">
                        <Select value={linkType} onValueChange={(value: any) => {
                          setLinkType(value);
                          setLinkSearchTerm("");
                        }}>
                          <SelectTrigger className="w-32" data-testid="link-type-select">
                            <SelectValue placeholder="Type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="order">Order</SelectItem>
                            <SelectItem value="repair">Repair</SelectItem>
                            <SelectItem value="todo">Todo</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex-1 relative">
                          <Input
                            placeholder={
                              linkType === "order" ? "Search order number or customer..." :
                              linkType === "email" ? "Search subject or email..." :
                              linkType === "repair" ? "Search repair title..." :
                              linkType === "todo" ? "Search todo title..." :
                              "Select type first..."
                            }
                            value={linkSearchTerm}
                            onChange={(e) => setLinkSearchTerm(e.target.value)}
                            disabled={!linkType}
                            data-testid="link-search-input"
                          />
                          {linkSearchTerm.trim() && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {linkType === "email" && searchResults.map((email: any) => (
                                <button
                                  key={email.id}
                                  onClick={() => linkItemMutation.mutate({ type: linkType, id: email.id })}
                                  className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-0"
                                  data-testid={`link-result-${email.id}`}
                                >
                                  <div className="font-medium text-sm">{email.subject}</div>
                                  <div className="text-xs text-muted-foreground">{email.customerEmail}</div>
                                </button>
                              ))}
                              {linkType === "order" && searchResults.map((order: any) => (
                                <button
                                  key={order.id}
                                  onClick={() => linkItemMutation.mutate({ type: linkType, id: order.id })}
                                  className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-0"
                                  data-testid={`link-result-${order.id}`}
                                >
                                  <div className="font-medium text-sm">Order #{order.orderNumber}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {order.customerEmail || order.customerName} • €{((order.totalAmount || 0) / 100).toFixed(2)}
                                  </div>
                                </button>
                              ))}
                              {linkType === "repair" && searchResults.map((repair: any) => (
                                <button
                                  key={repair.id}
                                  onClick={() => linkItemMutation.mutate({ type: linkType, id: repair.id })}
                                  className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-0"
                                  data-testid={`link-result-${repair.id}`}
                                >
                                  <div className="font-medium text-sm">{repair.title}</div>
                                  <div className="text-xs text-muted-foreground">{repair.description}</div>
                                </button>
                              ))}
                              {linkType === "todo" && searchResults.map((todo: any) => (
                                <button
                                  key={todo.id}
                                  onClick={() => linkItemMutation.mutate({ type: linkType, id: todo.id })}
                                  className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-0"
                                  data-testid={`link-result-${todo.id}`}
                                >
                                  <div className="font-medium text-sm">{todo.title}</div>
                                  <div className="text-xs text-muted-foreground">{todo.description}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Linked Emails */}
                    {relatedEmails.length > 0 && (
                      <Collapsible open={showLinkedEmails} onOpenChange={setShowLinkedEmails}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                          <div className="flex items-center gap-2">
                            {showLinkedEmails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Mail className="h-4 w-4" />
                            <span className="font-medium">Emails ({relatedEmails.length})</span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {relatedEmails.map((email) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === email.id && l.linkType === "email");
                            return (
                              <div key={email.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{email.subject}</div>
                                  <div className="text-xs text-muted-foreground">{email.customerEmail}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => link && unlinkItemMutation.mutate(link.id)}
                                  data-testid={`unlink-email-${email.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Linked Orders */}
                    {relatedOrders.length > 0 && (
                      <Collapsible open={showLinkedOrders} onOpenChange={setShowLinkedOrders}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                          <div className="flex items-center gap-2">
                            {showLinkedOrders ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Package className="h-4 w-4" />
                            <span className="font-medium">Orders ({relatedOrders.length})</span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {relatedOrders.map((order: Order) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === order.id && l.linkType === "order");
                            return (
                              <div key={order.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">Order #{order.orderNumber}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {order.customerEmail} • €{((order.totalAmount || 0) / 100).toFixed(2)}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => link && unlinkItemMutation.mutate(link.id)}
                                  data-testid={`unlink-order-${order.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Linked Repairs */}
                    {relatedRepairs.length > 0 && (
                      <Collapsible open={showLinkedRepairs} onOpenChange={setShowLinkedRepairs}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                          <div className="flex items-center gap-2">
                            {showLinkedRepairs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Wrench className="h-4 w-4" />
                            <span className="font-medium">Repairs ({relatedRepairs.length})</span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {relatedRepairs.map((repair: Repair) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === repair.id && l.linkType === "repair");
                            return (
                              <div key={repair.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">{repair.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">{repair.description}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => link && unlinkItemMutation.mutate(link.id)}
                                  data-testid={`unlink-repair-${repair.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Linked Todos */}
                    {relatedTodos.length > 0 && (
                      <Collapsible open={showLinkedTodos} onOpenChange={setShowLinkedTodos}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md">
                          <div className="flex items-center gap-2">
                            {showLinkedTodos ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <CheckSquare className="h-4 w-4" />
                            <span className="font-medium">Todos ({relatedTodos.length})</span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {relatedTodos.map((todo: Todo) => {
                            const link = caseLinksData.find((l: any) => l.linkedId === todo.id && l.linkType === "todo");
                            return (
                              <div key={todo.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">{todo.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">{todo.description}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => link && unlinkItemMutation.mutate(link.id)}
                                  data-testid={`unlink-todo-${todo.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {relatedEmails.length === 0 && relatedOrders.length === 0 && relatedRepairs.length === 0 && relatedTodos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No linked items. Use the search above to link emails, orders, repairs, or todos.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card>
                  <CardHeader className="bg-card-header border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ActivityIcon className="h-5 w-5" />
                      Activity Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {caseEvents.length > 0 ? (
                        caseEvents.map((event: any, index: number) => (
                          <div key={event.id || index} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                              {index < caseEvents.length - 1 && (
                                <div className="w-0.5 flex-1 bg-border mt-1" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <p className="text-sm font-medium">{event.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(event.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Notes */}
              <div className="space-y-6">
                <Card className="h-full">
                  <CardHeader className="bg-card-header border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Notes & Communication
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[600px]">
                      {currentUser && (
                        <NotesPanel
                          entityType="case"
                          entityId={caseId}
                          currentUser={currentUser}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete case #{caseData?.caseNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCaseMutation.mutate()}
              disabled={deleteCaseMutation.isPending}
              data-testid="confirm-delete-button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCaseMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Email Dialog */}
      <EmailCompose
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        to={caseData?.customerEmail || ""}
        subject={`Re: Case #${caseData?.caseNumber || caseId}`}
      />
    </>
  );
}
