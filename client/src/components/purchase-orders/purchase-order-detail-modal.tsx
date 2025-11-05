import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Trash2
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

interface PurchaseOrderDetailModalProps {
  purchaseOrder: PurchaseOrder;
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
}

export function PurchaseOrderDetailModal({
  purchaseOrder,
  open,
  onClose,
  suppliers,
}: PurchaseOrderDetailModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{purchaseOrder.title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {purchaseOrder.poNumber || "Geen PO nummer"}
              </p>
            </div>
            <Badge variant="secondary" className={getStatusColor(purchaseOrder.status)}>
              {getStatusLabel(purchaseOrder.status)}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items">
              Items ({lineItems?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="delivery" data-testid="tab-delivery">Levering</TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">Bestanden</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activiteit</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Leverancier Informatie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm font-medium">Naam</div>
                  <div className="text-sm text-muted-foreground">
                    {supplier?.name || "Onbekend"}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Order Datum</div>
                    <div className="text-sm text-muted-foreground">
                      {purchaseOrder.orderDate 
                        ? format(new Date(purchaseOrder.orderDate), "d MMMM yyyy", { locale: nl })
                        : "-"
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Bedrag</div>
                    <div className="text-sm text-muted-foreground">
                      €{totalAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                {purchaseOrder.notes && (
                  <div>
                    <div className="text-sm font-medium">Notities</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {purchaseOrder.notes}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                {purchaseOrder.status === 'draft' && (
                  <Button 
                    onClick={() => updateStatusMutation.mutate('sent')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-mark-sent"
                  >
                    Markeer als Verzonden
                  </Button>
                )}
                {purchaseOrder.status === 'sent' && (
                  <Button 
                    onClick={() => updateStatusMutation.mutate('awaiting_delivery')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-mark-awaiting"
                  >
                    Markeer als Onderweg
                  </Button>
                )}
                {purchaseOrder.status === 'awaiting_delivery' && (
                  <Button 
                    onClick={() => updateStatusMutation.mutate('fully_received')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-mark-received"
                  >
                    Markeer als Ontvangen
                  </Button>
                )}
              </div>
              <Button 
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-po"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Verwijderen
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            {lineItems && lineItems.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
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
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">Totaal:</TableCell>
                      <TableCell className="text-right font-bold">
                        €{totalAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Geen items toegevoegd</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Levering Informatie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Bestandsbeheer komt binnenkort</p>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Activiteitenlog komt binnenkort</p>
            </div>
          </TabsContent>
        </Tabs>
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
  );
}
