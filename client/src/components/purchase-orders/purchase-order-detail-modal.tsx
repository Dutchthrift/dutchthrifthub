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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Clock,
  ChevronDown,
  ChevronRight
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

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
      const response = await fetch(`/api/activities?purchaseOrderId=${purchaseOrder.id}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch activities");
      return response.json();
    },
    enabled: open,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest("PATCH", `/api/purchase-orders/${purchaseOrder.id}`, {
        status: newStatus,
        ...(newStatus === 'fully_received' && { receivedDate: new Date().toISOString() }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Status bijgewerkt" });
    },
    onError: () => {
      toast({ title: "Fout bij bijwerken", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/purchase-orders/${purchaseOrder.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ 
        title: "Inkoop order verwijderd", 
        description: "De inkoop order is succesvol verwijderd." 
      });
      onClose();
    },
    onError: () => {
      toast({ 
        title: "Verwijderen mislukt", 
        description: "Er is een fout opgetreden bij het verwijderen van de inkoop order.",
        variant: "destructive" 
      });
    },
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft": return "Concept";
      case "sent": return "Verzonden";
      case "awaiting_delivery": return "Onderweg";
      case "partially_received": return "Deels Ontvangen";
      case "fully_received": return "Volledig Ontvangen";
      case "cancelled": return "Geannuleerd";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "text-gray-600 bg-gray-100 dark:bg-gray-800";
      case "sent": return "text-blue-600 bg-blue-100 dark:bg-blue-900";
      case "awaiting_delivery": return "text-orange-600 bg-orange-100 dark:bg-orange-900";
      case "partially_received": return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900";
      case "fully_received": return "text-green-600 bg-green-100 dark:bg-green-900";
      case "cancelled": return "text-red-600 bg-red-100 dark:bg-red-900";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const totalItems = lineItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  const totalAmount = lineItems?.reduce((sum, item) => sum + ((item.subtotal || 0) / 100), 0) || (purchaseOrder.totalAmount || 0) / 100;

  // Auto-expand collapsible sections when data is available
  useEffect(() => {
    if (files && files.length > 0) {
      setShowFiles(true);
    }
  }, [files]);

  useEffect(() => {
    if (activities && activities.length > 0) {
      setShowActivity(true);
    }
  }, [activities]);

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{purchaseOrder.title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {purchaseOrder.poNumber || "Geen PO nummer"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                data-testid="button-edit-purchase-order"
              >
                <Edit className="h-4 w-4 mr-2" />
                Bewerken
              </Button>
              <Badge variant="secondary" className={getStatusColor(purchaseOrder.status)}>
                {getStatusLabel(purchaseOrder.status)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="grid lg:grid-cols-[1.75fr_1fr] gap-6 pb-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Supplier & Order Details */}
              <Card>
                <CardHeader className="bg-muted/50 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Leverancier & Order Informatie
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium">Leverancier</div>
                      <div className="text-sm text-muted-foreground">
                        {supplier?.name || "Onbekend"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Order Datum</div>
                      <div className="text-sm text-muted-foreground">
                        {purchaseOrder.orderDate 
                          ? format(new Date(purchaseOrder.orderDate), "d MMMM yyyy", { locale: nl })
                          : "-"
                        }
                      </div>
                    </div>
                    {supplier?.email && (
                      <div>
                        <div className="text-sm font-medium">Email</div>
                        <div className="text-sm text-muted-foreground">{supplier.email}</div>
                      </div>
                    )}
                    {supplier?.phone && (
                      <div>
                        <div className="text-sm font-medium">Telefoon</div>
                        <div className="text-sm text-muted-foreground">{supplier.phone}</div>
                      </div>
                    )}
                  </div>
                  
                  {purchaseOrder.notes && (
                    <div>
                      <div className="text-sm font-medium">Notities</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {purchaseOrder.notes}
                      </div>
                    </div>
                  )}

                  {/* Status Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    {purchaseOrder.status === 'draft' && (
                      <Button 
                        onClick={() => updateStatusMutation.mutate('sent')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-mark-sent"
                        size="sm"
                      >
                        Markeer als Verzonden
                      </Button>
                    )}
                    {purchaseOrder.status === 'sent' && (
                      <Button 
                        onClick={() => updateStatusMutation.mutate('awaiting_delivery')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-mark-awaiting"
                        size="sm"
                      >
                        Markeer als Onderweg
                      </Button>
                    )}
                    {purchaseOrder.status === 'awaiting_delivery' && (
                      <Button 
                        onClick={() => updateStatusMutation.mutate('fully_received')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-mark-received"
                        size="sm"
                      >
                        Markeer als Ontvangen
                      </Button>
                    )}
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-po"
                      className="ml-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Verwijderen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="bg-muted/50 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Order Items ({lineItems?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {lineItems && lineItems.length > 0 ? (
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Omschrijving</TableHead>
                            <TableHead className="text-right">Aantal</TableHead>
                            <TableHead className="text-right">Prijs</TableHead>
                            <TableHead className="text-right">Subtotaal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.sku}</TableCell>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                €{((item.unitPrice || 0) / 100).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                €{((item.subtotal || 0) / 100).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Geen items toegevoegd</p>
                    </div>
                  )}
                  {lineItems && lineItems.length > 0 && (
                    <div className="border-t bg-muted/30 px-6 py-3">
                      <div className="flex justify-between items-center font-medium">
                        <span>Totaal ({totalItems} items):</span>
                        <span className="text-lg">€{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Delivery Information */}
              <Card>
                <CardHeader className="bg-muted/50 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Levering
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div>
                    <div className="text-sm font-medium">Verwachte Leverdatum</div>
                    <div className="text-sm text-muted-foreground">
                      {purchaseOrder.expectedDeliveryDate 
                        ? format(new Date(purchaseOrder.expectedDeliveryDate), "d MMMM yyyy", { locale: nl })
                        : "Niet ingesteld"
                      }
                    </div>
                  </div>
                  {purchaseOrder.receivedDate && (
                    <div>
                      <div className="text-sm font-medium">Ontvangen Datum</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(purchaseOrder.receivedDate), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
                      </div>
                    </div>
                  )}
                  {purchaseOrder.receivedBy && (
                    <div>
                      <div className="text-sm font-medium">Ontvangen Door</div>
                      <div className="text-sm text-muted-foreground">{purchaseOrder.receivedBy}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Files Section - Collapsible */}
              <Collapsible open={showFiles} onOpenChange={setShowFiles}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="bg-muted/50 border-b cursor-pointer hover:bg-muted/70">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Bestanden ({files?.length || 0})
                        </CardTitle>
                        {showFiles ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-4">
                      <PurchaseOrderFiles purchaseOrderId={purchaseOrder.id} />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Activity Section - Collapsible */}
              <Collapsible open={showActivity} onOpenChange={setShowActivity}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="bg-muted/50 border-b cursor-pointer hover:bg-muted/70">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Activiteit ({activities?.length || 0})
                        </CardTitle>
                        {showActivity ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-4">
                      <PurchaseOrderActivities purchaseOrderId={purchaseOrder.id} />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. Dit zal de inkoop order permanent verwijderen.
              <br /><br />
              <strong>PO Nummer:</strong> {purchaseOrder.poNumber}
              <br />
              <strong>Titel:</strong> {purchaseOrder.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate();
                setShowDeleteDialog(false);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
    
    <PurchaseOrderForm
      open={isEditing}
      onClose={() => setIsEditing(false)}
      suppliers={suppliers}
      purchaseOrders={purchaseOrders}
      editPurchaseOrder={purchaseOrder}
    />
    </>
  );
}

// Files component for purchase order
function PurchaseOrderFiles({ purchaseOrderId }: { purchaseOrderId: string }) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const { data: files, isLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders", purchaseOrderId, "files"],
    queryFn: async () => {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/files`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch files");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/purchase-order-files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", purchaseOrderId, "files"] });
      toast({ title: "Bestand verwijderd" });
    },
    onError: () => {
      toast({ title: "Fout bij verwijderen", variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", purchaseOrderId, "files"] });
      toast({ title: "Bestanden geüpload" });
    } catch (error) {
      toast({ title: "Upload mislukt", variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <label htmlFor="file-upload-po" className="cursor-pointer">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isUploading}
            onClick={() => document.getElementById('file-upload-po')?.click()}
            data-testid="button-upload-files"
          >
            <Upload className="h-4 w-4 mr-2" />
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
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Geen bestanden</p>
          <p className="text-xs text-muted-foreground mt-1">Upload facturen, pakbonnen of andere documenten</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              data-testid={`file-item-${file.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{file.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.fileSize / 1024).toFixed(1)} KB • {file.uploadedAt && format(new Date(file.uploadedAt), "d MMM yyyy HH:mm", { locale: nl })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href={`/api/purchase-order-files/${file.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="ghost" data-testid={`button-download-${file.id}`}>
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
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
    </div>
  );
}

// Activities component for purchase order
function PurchaseOrderActivities({ purchaseOrderId }: { purchaseOrderId: string }) {
  const { data: activities, isLoading } = useQuery<any[]>({
    queryKey: ["/api/activities", "purchase_order", purchaseOrderId],
    queryFn: async () => {
      const response = await fetch(`/api/activities`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch activities");
      const allActivities = await response.json();
      // Filter activities related to this purchase order
      return allActivities.filter((activity: any) => 
        activity.metadata?.purchaseOrderId === purchaseOrderId
      );
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Laden...</div>;
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed rounded-lg">
        <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Geen activiteiten</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0"
        >
          <div className="flex-shrink-0 mt-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{activity.description}</p>
            <p className="text-xs text-muted-foreground">
              {activity.createdAt && format(new Date(activity.createdAt), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
