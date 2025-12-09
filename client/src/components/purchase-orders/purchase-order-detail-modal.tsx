import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PurchaseOrder, Supplier, PurchaseOrderItem } from "@shared/schema";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Building2,
  Calendar,
  Euro,
  Truck,
  FileText,
  Activity,
  Package,
  Edit,
  Trash2,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  Clock,
  X,
  ArrowRight,
  Check
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { useAuth } from "@/lib/auth";
import { PurchaseOrderForm } from "./purchase-order-form";

interface PurchaseOrderDetailModalProps {
  purchaseOrder: PurchaseOrder;
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
}

export function PurchaseOrderDetailModal({
  purchaseOrder,
  open,
  onClose,
  suppliers,
  purchaseOrders,
}: PurchaseOrderDetailModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const supplier = suppliers.find(s => s.id === purchaseOrder.supplierId);

  const { data: lineItems } = useQuery<PurchaseOrderItem[]>({
    queryKey: ["/api/purchase-order-items", purchaseOrder.id],
    queryFn: async () => {
      const response = await fetch(`/api/purchase-order-items/${purchaseOrder.id}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
    enabled: open,
  });

  const { data: files } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders", purchaseOrder.id, "files"],
    queryFn: async () => {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/files`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch files");
      return response.json();
    },
    enabled: open,
  });

  const { data: activities } = useQuery<any[]>({
    queryKey: ["/api/activities", "purchase_order", purchaseOrder.id],
    queryFn: async () => {
      const response = await fetch(`/api/activities`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch activities");
      const allActivities = await response.json();
      return allActivities.filter((activity: any) =>
        activity.metadata?.purchaseOrderId === purchaseOrder.id
      );
    },
    enabled: open,
  });

  // Auto-expand Notes if user is logged in (notes will be present)
  useEffect(() => {
    if (user) {
      setShowNotes(true);
    }
  }, [user]);

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest("PATCH", `/api/purchase-orders/${purchaseOrder.id}`, {
        status: newStatus,
        ...(newStatus === 'ontvangen' && { receivedDate: new Date().toISOString() }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", purchaseOrder.id] });
      toast({ title: "Status bijgewerkt" });
      // Close dialog so user sees the updated list
      onClose();
    },
    onError: (error: any) => {
      console.error("Status update failed:", error);
      toast({ title: "Fout bij bijwerken", description: error?.message || "Er is een onbekende fout opgetreden", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId?: number) => {
      if (fileId) {
        await apiRequest("DELETE", `/api/purchase-order-files/${fileId}`);
      } else {
        await apiRequest("DELETE", `/api/purchase-orders/${purchaseOrder.id}`);
      }
    },
    onSuccess: (_, fileId) => {
      if (fileId) {
        queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", purchaseOrder.id, "files"] });
        toast({ title: "Bestand verwijderd" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
        toast({
          title: "Inkoop order verwijderd",
          description: "De inkoop order is succesvol verwijderd."
        });
        onClose();
      }
    },
    onError: () => {
      toast({
        title: "Verwijderen mislukt",
        description: "Er is een fout opgetreden.",
        variant: "destructive"
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/files`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", purchaseOrder.id, "files"] });
      toast({ title: "Bestanden geüpload" });
      setShowFiles(true);
    } catch (error) {
      toast({
        title: "Upload mislukt",
        description: "Er is een fout opgetreden bij het uploaden.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "aangekocht": return "Aangekocht";
      case "ontvangen": return "Ontvangen";
      case "verwerkt": return "Verwerkt";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aangekocht": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300";
      case "ontvangen": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300";
      case "verwerkt": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const totalItems = lineItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  const totalAmount = lineItems?.reduce((sum, item) => sum + ((item.subtotal || 0) / 100), 0) || (purchaseOrder.totalAmount || 0) / 100;

  // Show edit form if editing
  if (isEditing) {
    return (
      <PurchaseOrderForm
        open={isEditing}
        onClose={() => setIsEditing(false)}
        suppliers={suppliers}
        purchaseOrders={purchaseOrders}
        editPurchaseOrder={purchaseOrder}
      />
    );
  }
  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden !flex !flex-col p-0 gap-0 [&>button]:hidden">
          {/* Header with Title and Uniform Icon Buttons */}
          <div className="px-5 pt-4 pb-3 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-semibold">{purchaseOrder.title}</DialogTitle>
                  <Badge className="font-mono text-xs shrink-0 bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-600">
                    {purchaseOrder.poNumber || "—"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{suppliers.find(s => s.id === purchaseOrder.supplierId)?.name || "Onbekend"}</span>
                </div>
              </div>
              {/* Uniform Icon Buttons Group */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-purchase-order"
                  title="Bewerken"
                  className="h-8 w-8 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-po"
                  title="Verwijderen"
                  className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onClose()}
                  title="Sluiten"
                  className="h-8 w-8 rounded-full text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Status Bar - Centered */}
          <div className="px-5 py-2.5 border-b bg-muted/20 flex items-center justify-center gap-3 text-xs">
            <button
              onClick={() => updateStatusMutation.mutate('aangekocht')}
              disabled={updateStatusMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all ${purchaseOrder.status === 'aangekocht'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium border border-blue-300 dark:border-blue-600'
                : 'text-muted-foreground/60 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20'}`}
            >
              <div className={`h-2 w-2 rounded-full ${purchaseOrder.status === 'aangekocht'
                ? 'bg-blue-600'
                : ['ontvangen', 'verwerkt'].includes(purchaseOrder.status || '') ? 'bg-blue-400' : 'bg-muted-foreground/30'}`} />
              Aangekocht
            </button>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            <button
              onClick={() => updateStatusMutation.mutate('ontvangen')}
              disabled={updateStatusMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all ${purchaseOrder.status === 'ontvangen'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-medium border border-orange-300 dark:border-orange-600'
                : 'text-muted-foreground/60 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20'}`}
            >
              <div className={`h-2 w-2 rounded-full ${purchaseOrder.status === 'ontvangen'
                ? 'bg-orange-600'
                : purchaseOrder.status === 'verwerkt' ? 'bg-orange-400' : 'bg-muted-foreground/30'}`} />
              Ontvangen
            </button>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            <button
              onClick={() => updateStatusMutation.mutate('verwerkt')}
              disabled={updateStatusMutation.isPending}
              title="Markeer als verwerkt en archiveer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all ${purchaseOrder.status === 'verwerkt'
                ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-medium border border-gray-400 dark:border-gray-500'
                : 'text-muted-foreground/60 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800'}`}
            >
              <div className={`h-2 w-2 rounded-full ${purchaseOrder.status === 'verwerkt'
                ? 'bg-gray-600'
                : 'bg-muted-foreground/30'}`} />
              Verwerkt
            </button>
          </div>

          {/* Metrics Strip - Centered */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 px-4 py-2 border-b bg-muted/5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <Euro className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600" />
              <span className="text-muted-foreground">Totaal:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">€{totalAmount.toFixed(2)}</span>
            </div>
            <div className="h-3.5 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600" />
              <span className="text-muted-foreground">Items:</span>
              <span className="font-semibold text-blue-700 dark:text-blue-400">{totalItems}</span>
            </div>
            <div className="h-3.5 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-600" />
              <span className="text-muted-foreground">Besteld:</span>
              <span className="font-semibold text-purple-700 dark:text-purple-400">
                {purchaseOrder.orderDate
                  ? format(new Date(purchaseOrder.orderDate), "d MMM yyyy", { locale: nl })
                  : "—"
                }
              </span>
            </div>
          </div>

          {/* Main Content - Single Column */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="space-y-3 pb-3">

              {/* Order Details - Compact Card */}
              <div className="border rounded-lg border-l-4 border-l-blue-500">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-blue-50/50 dark:bg-blue-950/20">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Bestelgegevens</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Leverancier</div>
                      <div className="font-medium">{supplier?.name || "Onbekend"}</div>
                      {supplier?.email && (
                        <div className="text-xs text-muted-foreground">{supplier.email}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Besteldatum</div>
                      <div className="font-medium">
                        {purchaseOrder.orderDate
                          ? format(new Date(purchaseOrder.orderDate), "d MMMM yyyy", { locale: nl })
                          : "—"
                        }
                      </div>
                    </div>
                  </div>
                  {purchaseOrder.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground mb-1">Notities</div>
                      <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-2">
                        {purchaseOrder.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items - Compact Table */}
              <div className="border rounded-lg border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-emerald-50/50 dark:bg-emerald-950/20">
                  <Package className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Bestelde Items ({lineItems?.length || 0})</span>
                </div>
                {lineItems && lineItems.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-8 w-[80px]">SKU</TableHead>
                            <TableHead className="h-8">Omschrijving</TableHead>
                            <TableHead className="h-8 text-right w-[60px]">Aantal</TableHead>
                            <TableHead className="h-8 text-right w-[80px]">Prijs</TableHead>
                            <TableHead className="h-8 text-right w-[90px]">Subtotaal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item, index) => (
                            <TableRow
                              key={item.id}
                              className={`text-sm ${index % 2 === 0 ? 'bg-muted/10' : ''}`}
                            >
                              <TableCell className="py-2 font-mono text-xs">{item.sku}</TableCell>
                              <TableCell className="py-2">{item.productName}</TableCell>
                              <TableCell className="py-2 text-right">{item.quantity}</TableCell>
                              <TableCell className="py-2 text-right text-muted-foreground">
                                €{((item.unitPrice || 0) / 100).toFixed(2)}
                              </TableCell>
                              <TableCell className="py-2 text-right font-medium">
                                €{((item.subtotal || 0) / 100).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="border-t bg-muted/20 px-3 py-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Totaal ({totalItems} items):</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">€{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Geen items</p>
                  </div>
                )}
              </div>

              {purchaseOrder.receivedDate && (
                <div className="border rounded-lg border-l-4 border-l-orange-500">
                  <div className="flex items-center gap-2 px-3 py-2 border-b bg-orange-50/50 dark:bg-orange-950/20">
                    <Truck className="h-3.5 w-3.5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Leveringsinformatie</span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Ontvangen op:</span>
                      <span className="font-medium">
                        {format(new Date(purchaseOrder.receivedDate), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Collapsible open={showFiles} onOpenChange={setShowFiles}>
                <div className="border rounded-lg border-l-4 border-l-purple-500">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-purple-50/50 dark:bg-purple-950/20 cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Bestanden ({files?.length || 0})</span>
                      </div>
                      {showFiles ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3">
                      <div className="flex justify-end mb-2">
                        <label htmlFor="file-upload-po" className="cursor-pointer">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isUploading}
                            onClick={() => document.getElementById('file-upload-po')?.click()}
                            data-testid="button-upload-files"
                            className="h-7 text-xs"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            {isUploading ? "Uploaden..." : "Upload"}
                          </Button>
                          <input
                            type="file"
                            id="file-upload-po"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                          />
                        </label>
                      </div>

                      {!files || files.length === 0 ? (
                        <div className="text-center py-4 border border-dashed rounded">
                          <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">Geen bestanden</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-2 border rounded hover:bg-muted/30 transition-colors"
                              data-testid={`file-item-${file.id}`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm truncate" title={file.fileName}>
                                    {file.fileName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {(file.fileSize / 1024).toFixed(1)} KB
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-0.5 flex-shrink-0">
                                <a
                                  href={`/api/purchase-order-files/${file.id}/download`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-download-${file.id}`}>
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => deleteMutation.mutate(file.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-${file.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Activity - Collapsible */}
              <Collapsible open={showActivity} onOpenChange={setShowActivity}>
                <div className="border rounded-lg border-l-4 border-l-amber-500">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Activiteit ({activities?.length || 0})</span>
                      </div>
                      {showActivity ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3">
                      {!activities || activities.length === 0 ? (
                        <div className="text-center py-4 border border-dashed rounded">
                          <Activity className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">Geen activiteiten</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activities.map((activity) => (
                            <div
                              key={activity.id}
                              className="flex gap-2 pb-2 border-b last:border-b-0 last:pb-0"
                            >
                              <div className="flex-shrink-0">
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                  <Activity className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm break-words">{activity.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {activity.createdAt && format(new Date(activity.createdAt), "d MMM 'om' HH:mm", { locale: nl })}
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

              {/* Notes - Collapsible */}
              {user && (
                <Collapsible open={showNotes} onOpenChange={setShowNotes}>
                  <div className="border rounded-lg border-l-4 border-l-rose-500">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-rose-50/50 dark:bg-rose-950/20 cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-900/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-rose-600" />
                          <span className="text-sm font-medium text-rose-900 dark:text-rose-100">Notities</span>
                        </div>
                        {showNotes ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3">
                        <NotesPanel
                          entityType="purchaseOrder"
                          entityId={purchaseOrder.id}
                          currentUser={user}
                        />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}
            </div>
          </div>
        </DialogContent >
      </Dialog >

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. De inkoop order en alle bijbehorende gegevens worden permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(undefined)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
