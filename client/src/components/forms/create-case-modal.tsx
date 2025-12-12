import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle,
  Package,
  ShoppingBag,
  Briefcase,
  Mail,
  Truck,
  CreditCard,
  AlertTriangle,
  HelpCircle,
  FileText,
  ShoppingCart,
  Pencil,
  User,
  CalendarIcon,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface CreateCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailThread?: any;
}

interface SelectedItemData {
  quantity: number;
  itemNotes: string;
}

const CASE_TYPES = [
  { value: "return_request", label: "Retour", icon: Package, color: "text-blue-600" },
  { value: "complaint", label: "Klacht", icon: AlertTriangle, color: "text-red-600" },
  { value: "shipping_issue", label: "Verzending", icon: Truck, color: "text-orange-600" },
  { value: "payment_issue", label: "Betaling", icon: CreditCard, color: "text-purple-600" },
  { value: "general", label: "Algemeen", icon: FileText, color: "text-gray-600" },
  { value: "other", label: "Overig", icon: HelpCircle, color: "text-slate-600" },
];

const CASE_SOURCES = [
  { value: "email", label: "Email", icon: Mail },
  { value: "shopify", label: "Shopify", icon: ShoppingCart },
  { value: "manual", label: "Handmatig", icon: Pencil },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Laag", color: "bg-emerald-100 text-emerald-700" },
  { value: "medium", label: "Normaal", color: "bg-gray-100 text-gray-700" },
  { value: "high", label: "Hoog", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
];

const STEP_ICONS = [FileText, ShoppingBag, CheckCircle];
const STEP_LABELS = ["Type", "Details", "Bevestig"];

export function CreateCaseModal({ open, onOpenChange, emailThread }: CreateCaseModalProps) {
  const [step, setStep] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItemData>>(new Map());
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    title: emailThread?.subject || "",
    description: emailThread ? `Case vanuit email: ${emailThread.subject}` : "",
    caseType: "general",
    otherTypeDescription: "",
    source: emailThread ? "email" : "manual",
    priority: "medium",
    assignedUserId: "",
    customerEmail: emailThread?.customerEmail || "",
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  const { data: ordersData } = useQuery<{ orders: any[]; total: number }>({
    queryKey: ["/api/orders", 1, 50, orderSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (orderSearch) params.append("search", orderSearch);
      const response = await fetch(`/api/orders?${params}`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: open && step === 2,
  });

  const orders = ordersData?.orders || [];

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/cases", data);
      return await response.json();
    },
    onSuccess: async (newCase) => {
      if (emailThread?.id) {
        try {
          await apiRequest("POST", `/api/mail/threads/${emailThread.id}/link`, {
            type: 'case',
            entityId: newCase.id
          });
        } catch (error) {
          console.error("Failed to link email thread to case:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });

      toast({
        title: "✅ Case aangemaakt",
        description: `Case "${newCase.title}" (${newCase.caseNumber}) is aangemaakt.`,
      });

      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij aanmaken case",
        description: error.message || "Er is een fout opgetreden.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setStep(1);
    setSelectedOrder(null);
    setSelectedItems(new Map());
    setOrderSearch("");
    setFormData({
      title: "",
      description: "",
      caseType: "general",
      otherTypeDescription: "",
      source: "manual",
      priority: "medium",
      assignedUserId: "",
      customerEmail: "",
    });
    onOpenChange(false);
  };

  const handleNext = () => {
    if (step === 1 && !formData.caseType) {
      toast({ title: "Selecteer een type", variant: "destructive" });
      return;
    }
    if (step === 2 && !formData.title.trim()) {
      toast({ title: "Voer een titel in", variant: "destructive" });
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = () => {
    const caseData = {
      ...formData,
      orderId: selectedOrder?.id || null,
      customerId: selectedOrder?.customerId || null,
      assignedUserId: formData.assignedUserId || null,
      items: selectedItems.size > 0 ? Array.from(selectedItems.entries()).map(([itemId, data]) => {
        const lineItems = selectedOrder?.orderData?.line_items || [];
        const lineItem = lineItems.find((li: any) => (li.id?.toString() || li.sku) === itemId);
        return {
          sku: lineItem?.sku || "",
          productName: lineItem?.title || lineItem?.name || "",
          quantity: data.quantity,
          itemNotes: data.itemNotes,
        };
      }) : [],
    };

    createCaseMutation.mutate(caseData);
  };

  const lineItems = selectedOrder?.orderData?.line_items || [];

  const toggleItem = (itemId: string, checked: boolean) => {
    const newItems = new Map(selectedItems);
    if (checked) {
      newItems.set(itemId, { quantity: 1, itemNotes: "" });
    } else {
      newItems.delete(itemId);
    }
    setSelectedItems(newItems);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      processing: "bg-blue-100 text-blue-700",
      fulfilled: "bg-emerald-100 text-emerald-700",
      pending: "bg-amber-100 text-amber-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-500" />
            Nieuwe Case
          </DialogTitle>
        </DialogHeader>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-between mb-4 px-2">
          {STEP_LABELS.map((label, idx) => {
            const StepIcon = STEP_ICONS[idx];
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;

            return (
              <div key={idx} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                    ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                    ${isActive ? 'bg-blue-500 text-white ring-2 ring-blue-200' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : ''}
                  `}>
                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span className={`text-[10px] mt-1 ${isActive ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
                {idx < 2 && (
                  <div className={`w-8 h-0.5 mx-1 ${step > stepNum ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Select Type & Source */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Case Type Selection */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Type case</Label>
              <div className="grid grid-cols-3 gap-2">
                {CASE_TYPES.map((type) => {
                  const TypeIcon = type.icon;
                  const isSelected = formData.caseType === type.value;
                  return (
                    <div
                      key={type.value}
                      className={`p-3 border rounded-lg cursor-pointer transition-all text-center hover:bg-muted/50 ${isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-500" : ""
                        }`}
                      onClick={() => setFormData({ ...formData, caseType: type.value })}
                    >
                      <TypeIcon className={`h-5 w-5 mx-auto mb-1 ${type.color}`} />
                      <span className="text-xs font-medium">{type.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Other Type Description */}
            {formData.caseType === "other" && (
              <div>
                <Label className="text-xs">Type omschrijving</Label>
                <Input
                  placeholder="Bijv. Garantievraag"
                  value={formData.otherTypeDescription}
                  onChange={(e) => setFormData({ ...formData, otherTypeDescription: e.target.value })}
                  className="h-8 text-sm mt-1"
                />
              </div>
            )}

            {/* Source Selection */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Bron</Label>
              <div className="flex gap-2">
                {CASE_SOURCES.map((source) => {
                  const SourceIcon = source.icon;
                  const isSelected = formData.source === source.value;
                  return (
                    <div
                      key={source.value}
                      className={`flex-1 p-2.5 border rounded-lg cursor-pointer transition-all text-center hover:bg-muted/50 ${isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : ""
                        }`}
                      onClick={() => setFormData({ ...formData, source: source.value })}
                    >
                      <SourceIcon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <span className="text-[10px]">{source.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Email info if from email */}
            {emailThread && (
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Email Thread</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{emailThread.subject}</p>
                <p className="text-[10px] text-muted-foreground">{emailThread.customerEmail}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details & Order */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <Label className="text-xs">Titel</Label>
              <Input
                placeholder="Korte omschrijving van de case"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-9 text-sm mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs">Beschrijving</Label>
              <Textarea
                placeholder="Gedetailleerde beschrijving..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-sm min-h-[60px] mt-1"
              />
            </div>

            {/* Priority & Assignee */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prioriteit</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${opt.value === 'urgent' ? 'bg-red-500' : opt.value === 'high' ? 'bg-orange-500' : opt.value === 'medium' ? 'bg-gray-400' : 'bg-emerald-500'}`} />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Toewijzen aan</Label>
                <Select
                  value={formData.assignedUserId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, assignedUserId: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Niet toegewezen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Niet toegewezen</SelectItem>
                    {users?.map((user: any) => (
                      <SelectItem key={user.id} value={user.id} className="text-xs">
                        {user.firstName || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Customer Email for manual cases */}
            {!selectedOrder && (
              <div>
                <Label className="text-xs">Klant email (optioneel)</Label>
                <Input
                  type="email"
                  placeholder="klant@email.com"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="h-8 text-sm mt-1"
                />
              </div>
            )}

            {/* Order Search (Optional) */}
            <div>
              <Label className="text-xs">Bestelling koppelen (optioneel)</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Zoek op ordernummer..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {orderSearch && orders.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-[150px] overflow-y-auto">
                  {orders.slice(0, 5).map((order: any) => (
                    <div
                      key={order.id}
                      className={`p-2 border rounded-lg cursor-pointer text-xs hover:bg-muted/50 ${selectedOrder?.id === order.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : ""
                        }`}
                      onClick={() => {
                        setSelectedOrder(order);
                        setFormData({ ...formData, customerEmail: order.customerEmail || formData.customerEmail });
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{order.orderNumber}</span>
                        <Badge className={`text-[9px] px-1 py-0 ${getStatusBadge(order.status)}`}>{order.status}</Badge>
                      </div>
                      <p className="text-muted-foreground text-[10px] truncate">{order.customerEmail}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedOrder && (
                <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    ✓ Order {selectedOrder.orderNumber} gekoppeld
                  </p>
                </div>
              )}
            </div>

            {/* Item Selection if order is selected */}
            {selectedOrder && lineItems.length > 0 && (
              <div>
                <Label className="text-xs">Artikelen selecteren (optioneel)</Label>
                <div className="mt-1 space-y-1.5 max-h-[120px] overflow-y-auto">
                  {lineItems.map((item: any, idx: number) => {
                    const itemId = item.id?.toString() || item.sku || `item-${idx}`;
                    const isSelected = selectedItems.has(itemId);
                    return (
                      <div
                        key={itemId}
                        className={`p-2 border rounded flex items-center gap-2 cursor-pointer hover:bg-muted/30 text-xs ${isSelected ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : ""
                          }`}
                        onClick={() => toggleItem(itemId, !isSelected)}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={(c) => toggleItem(itemId, c as boolean)} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.title || item.name}</p>
                          <p className="text-muted-foreground text-[10px]">SKU: {item.sku || "N/B"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-3">
            {/* Type & Source */}
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Case Type</span>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const type = CASE_TYPES.find(t => t.value === formData.caseType);
                  const TypeIcon = type?.icon || FileText;
                  return (
                    <>
                      <TypeIcon className={`h-4 w-4 ${type?.color}`} />
                      <span className="text-sm font-medium">
                        {formData.caseType === 'other' ? formData.otherTypeDescription || 'Overig' : type?.label}
                      </span>
                    </>
                  );
                })()}
                <span className="text-xs text-muted-foreground ml-auto">
                  via {CASE_SOURCES.find(s => s.value === formData.source)?.label}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Details</span>
              </div>
              <p className="text-sm font-medium">{formData.title || "Geen titel"}</p>
              {formData.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{formData.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs">
                <Badge className={PRIORITY_OPTIONS.find(p => p.value === formData.priority)?.color}>
                  {PRIORITY_OPTIONS.find(p => p.value === formData.priority)?.label}
                </Badge>
                {formData.assignedUserId && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {users?.find((u: any) => u.id === formData.assignedUserId)?.firstName || "Toegewezen"}
                  </span>
                )}
              </div>
            </div>

            {/* Order (if selected) */}
            {selectedOrder && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Gekoppelde Order</span>
                </div>
                <p className="text-sm font-medium">{selectedOrder.orderNumber}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.customerEmail}</p>
                {selectedItems.size > 0 && (
                  <p className="text-xs text-amber-600 mt-1">{selectedItems.size} artikel(en) geselecteerd</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (step === 1 ? handleClose() : handleBack())}
            disabled={createCaseMutation.isPending}
            className="h-8 text-sm"
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            {step === 1 ? "Annuleren" : "Terug"}
          </Button>

          {step < 3 ? (
            <Button onClick={handleNext} size="sm" className="h-8 text-sm bg-blue-500 hover:bg-blue-600">
              Volgende
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createCaseMutation.isPending}
              size="sm"
              className="h-8 text-sm bg-emerald-500 hover:bg-emerald-600"
            >
              {createCaseMutation.isPending ? "Aanmaken..." : "✓ Case Aanmaken"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
