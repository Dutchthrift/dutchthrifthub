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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden !flex !flex-col p-0 gap-0">
          {/* Unified Header Section */}
          <div className="px-6 py-4 border-b bg-muted/20 relative">
            {/* Top Row: Title & Actions */}
            <div className="flex items-start justify-between mb-6">
              {/* Left: Title & PO */}
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-bold">{purchaseOrder.title}</DialogTitle>
                  <Badge className="font-mono text-xs bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                    {purchaseOrder.poNumber || "Geen PO nummer"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>{suppliers.find(s => s.id === purchaseOrder.supplierId)?.name || "Onbekende leverancier"}</span>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 pr-8"> {/* pr-8 to avoid overlap with close button */}
                {/* Primary Status Action */}
                {purchaseOrder.status === 'aangekocht' && (
                  <Button
                    onClick={() => updateStatusMutation.mutate('ontvangen')}
                    disabled={updateStatusMutation.isPending}
                    className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Markeer Ontvangen
                  </Button>
                )}

                {purchaseOrder.status === 'ontvangen' && (
                  <Button
                    onClick={() => updateStatusMutation.mutate('verwerkt')}
                    disabled={updateStatusMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Markeer Verwerkt
                  </Button>
                )}

                <div className="h-8 w-px bg-border mx-1" />

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-purchase-order"
                  title="Bewerken"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status Progression */}
            <div className="flex items-center gap-3 text-sm bg-white dark:bg-zinc-900 rounded-lg p-3 border">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${purchaseOrder.status === 'aangekocht'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium'
                : 'text-muted-foreground'}`}>
                <div className={`h-2.5 w-2.5 rounded-full ${purchaseOrder.status === 'aangekocht'
                  ? 'bg-blue-600 dark:bg-blue-400'
                  : 'bg-muted-foreground/30'}`} />
                Aangekocht
              </div>
              <ArrowRight className={`h-4 w-4 ${['ontvangen', 'verwerkt'].includes(purchaseOrder.status || '')
                ? 'text-orange-400'
                : 'text-muted-foreground/30'}`} />

              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${purchaseOrder.status === 'ontvangen'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-medium'
                : 'text-muted-foreground'}`}>
                <div className={`h-2.5 w-2.5 rounded-full ${purchaseOrder.status === 'ontvangen'
                  ? 'bg-orange-600 dark:bg-orange-400'
                  : 'bg-muted-foreground/30'}`} />
                Ontvangen
              </div>
              <ArrowRight className={`h-4 w-4 ${purchaseOrder.status === 'verwerkt'
                ? 'text-green-400'
                : 'text-muted-foreground/30'}`} />

              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${purchaseOrder.status === 'verwerkt'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium'
                : 'text-muted-foreground'}`}>
                <div className={`h-2.5 w-2.5 rounded-full ${purchaseOrder.status === 'verwerkt'
                  ? 'bg-green-600 dark:bg-green-400'
                  : 'bg-muted-foreground/30'}`} />
                Verwerkt
              </div>
            </div>
          </div>

          {/* Metrics Bar */}
          <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b bg-background">
            <div className="flex flex-col p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs mb-1">
                <Euro className="h-3.5 w-3.5" />
                <span className="font-medium">Totaal Bedrag</span>
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">€{totalAmount.toFixed(2)}</div>
            </div>
            <div className="flex flex-col p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs mb-1">
                <Package className="h-3.5 w-3.5" />
                <span className="font-medium">Aantal Items</span>
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalItems}</div>
            </div>
            <div className="flex flex-col p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs mb-1">
                <Calendar className="h-3.5 w-3.5" />
                <span className="font-medium">Besteldatum</span>
              </div>
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {purchaseOrder.orderDate
                  ? format(new Date(purchaseOrder.orderDate), "d MMM yyyy", { locale: nl })
                  : "-"
                }
              </div>
            </div>
          </div>

          {/* Main Content - Single Column */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 pb-4">

              {/* Order Details */}
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="border-b bg-blue-50/50 dark:bg-blue-900/10 p-4">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                      <Building2 className="h-4 w-4" />
                    </div>
                    Bestelgegevens
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Leverancier</div>
                        <div className="text-base font-semibold">{supplier?.name || "Onbekend"}</div>
                        {supplier?.email && (
                          <div className="text-sm text-muted-foreground">{supplier.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Besteldatum</div>
                        <div className="text-base font-semibold">
                          {purchaseOrder.orderDate
                            ? format(new Date(purchaseOrder.orderDate), "d MMMM yyyy", { locale: nl })
                            : "-"
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {purchaseOrder.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Notities</div>
                      <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                        {purchaseOrder.notes}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card className="shadow-sm border-l-4 border-l-indigo-500">
                <CardHeader className="border-b bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
                  <CardTitle className="text-base flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-md">
                      <Package className="h-4 w-4" />
                    </div>
                    Bestelde Items ({lineItems?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {lineItems && lineItems.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                              <TableHead className="w-[100px]">SKU</TableHead>
                              <TableHead>Omschrijving</TableHead>
                              <TableHead className="text-right w-[80px]">Aantal</TableHead>
                              <TableHead className="text-right w-[100px]">Prijs</TableHead>
                              <TableHead className="text-right w-[120px]">Subtotaal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow
                                key={item.id}
                                className={index % 2 === 0 ? 'bg-muted/20' : ''}
                              >
                                <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                                <TableCell className="text-sm">{item.productName}</TableCell>
                                <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                                <TableCell className="text-right text-muted-foreground text-sm">
                                  €{((item.unitPrice || 0) / 100).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">
                                  €{((item.subtotal || 0) / 100).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="border-t bg-indigo-50/50 dark:bg-indigo-900/10 px-4 py-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">
                            Totaal ({totalItems} items):
                          </span>
                          <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">€{totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Geen items</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Delivery Information */}
              <Card className="shadow-sm border-l-4 border-l-cyan-500">
                <CardHeader className="border-b bg-cyan-50/50 dark:bg-cyan-900/10 p-4">
                  <CardTitle className="text-base flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                    <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-md">
                      <Truck className="h-4 w-4" />
                    </div>
                    Leveringsinformatie
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">

                      {purchaseOrder.receivedDate && (
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Ontvangen op</div>
                            <div className="text-base font-semibold">
                              {format(new Date(purchaseOrder.receivedDate), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Collapsible open={showFiles} onOpenChange={setShowFiles}>
                <Card className="shadow-sm border-l-4 border-l-rose-500">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="border-b bg-rose-50/50 dark:bg-rose-900/10 cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-900/20 transition-colors p-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2 text-rose-700 dark:text-rose-300">
                          <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-md">
                            <FileText className="h-4 w-4" />
                          </div>
                          Bestanden ({files?.length || 0})
                        </CardTitle>
                        {showFiles ? (
                          <ChevronDown className="h-5 w-5 text-rose-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-rose-600" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4">
                      <div className="flex justify-end mb-3">
                        <label htmlFor="file-upload-po" className="cursor-pointer">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isUploading}
                            onClick={() => document.getElementById('file-upload-po')?.click()}
                            data-testid="button-upload-files"
                            className="h-9"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploading ? "Uploaden..." : "Upload Bestand"}
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
                        <div className="text-center py-6 border-2 border-dashed rounded-lg">
                          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Geen bestanden</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                              data-testid={`file-item-${file.id}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm truncate" title={file.fileName}>
                                    {file.fileName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {(file.fileSize / 1024).toFixed(1)} KB • {file.uploadedAt && format(new Date(file.uploadedAt), "d MMM yyyy", { locale: nl })}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <a
                                  href={`/api/purchase-order-files/${file.id}/download`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0" data-testid={`button-download-${file.id}`}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </a>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0"
                                  onClick={() => deleteMutation.mutate(file.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-${file.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Activity Section - Collapsible */}
              <Collapsible open={showActivity} onOpenChange={setShowActivity}>
                <Card className="shadow-sm border-l-4 border-l-orange-500">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="border-b bg-orange-50/50 dark:bg-orange-900/10 cursor-pointer hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors p-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-300">
                          <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-md">
                            <Activity className="h-4 w-4" />
                          </div>
                          Activiteit ({activities?.length || 0})
                        </CardTitle>
                        {showActivity ? (
                          <ChevronDown className="h-5 w-5 text-orange-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4">
                      {!activities || activities.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed rounded-lg">
                          <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Geen activiteiten</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activities.map((activity) => (
                            <div
                              key={activity.id}
                              className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                            >
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                                  <Activity className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium break-words">{activity.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {activity.createdAt && format(new Date(activity.createdAt), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Notes Section - Collapsible */}
              {user && (
                <Collapsible open={showNotes} onOpenChange={setShowNotes}>
                  <Card className="shadow-sm border-l-4 border-l-amber-500">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="border-b bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors p-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                              <FileText className="h-4 w-4" />
                            </div>
                            Notities
                          </CardTitle>
                          {showNotes ? (
                            <ChevronDown className="h-5 w-5 text-amber-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-amber-600" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="p-4">
                        <NotesPanel
                          entityType="purchaseOrder"
                          entityId={purchaseOrder.id}
                          currentUser={user}
                        />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
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
