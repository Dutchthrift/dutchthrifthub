import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PurchaseOrder, Supplier } from "@shared/schema";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Building2, Calendar, Euro, Truck, CheckCircle } from "lucide-react";
import { PurchaseOrderContextMenu } from "./purchase-order-context-menu";

interface PurchaseOrdersCardsProps {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  onPOClick: (po: PurchaseOrder) => void;
  getStatusColor: (status: string) => string;
  onPOOpen: (id: string) => void;
  onPOArchive: (id: string) => void;
  onPOUnarchive: (id: string) => void;
  onPODelete: (id: string) => void;
}

export function PurchaseOrdersCards({
  purchaseOrders,
  suppliers,
  onPOClick,
  getStatusColor,
  onPOOpen,
  onPOArchive,
  onPOUnarchive,
  onPODelete,
}: PurchaseOrdersCardsProps) {
  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "-";
    return suppliers.find(s => s.id === supplierId)?.name || "Onbekend";
  };

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {purchaseOrders.map((po) => (
        <PurchaseOrderContextMenu
          key={po.id}
          purchaseOrderId={po.id}
          isArchived={po.archived || false}
          onOpen={onPOOpen}
          onArchive={onPOArchive}
          onUnarchive={onPOUnarchive}
          onDelete={onPODelete}
        >
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onPOClick(po)}
            data-testid={`card-po-${po.id}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{po.title || "Geen titel"}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {po.poNumber || "Geen PO nummer"}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={getStatusColor(po.status)}
                >
                  {getStatusLabel(po.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{getSupplierName(po.supplierId)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {po.orderDate
                    ? format(new Date(po.orderDate), "d MMM yyyy", { locale: nl })
                    : "-"
                  }
                </span>
              </div>

              {po.expectedDeliveryDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className={
                    new Date(po.expectedDeliveryDate) < new Date() && po.status !== 'verwerkt'
                      ? "text-red-600 font-medium"
                      : ""
                  }>
                    {format(new Date(po.expectedDeliveryDate), "d MMM yyyy", { locale: nl })}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="text-sm font-medium">
                  €{((po.totalAmount || 0) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </div>
                {po.isPaid && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
              </div>
            </CardContent>
          </Card>
        </PurchaseOrderContextMenu>
      ))}
    </div>
  );
}