import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseOrder, Supplier } from "@shared/schema";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CheckCircle } from "lucide-react";
import { PurchaseOrderContextMenu } from "./purchase-order-context-menu";

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  onPOClick: (po: PurchaseOrder) => void;
  getStatusColor: (status: string) => string;
  onPOOpen: (id: string) => void;
  onPOArchive: (id: string) => void;
  onPOUnarchive: (id: string) => void;
  onPODelete: (id: string) => void;
}

export function PurchaseOrdersTable({
  purchaseOrders,
  suppliers,
  onPOClick,
  getStatusColor,
  onPOOpen,
  onPOArchive,
  onPOUnarchive,
  onPODelete,
}: PurchaseOrdersTableProps) {
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
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO Nummer</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Leverancier</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead>Verwachte Levering</TableHead>
            <TableHead>Bedrag</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onPOClick(po)}
                data-testid={`row-po-${po.id}`}
              >
                <TableCell className="font-medium" data-testid={`text-po-number-${po.id}`}>
                  {po.poNumber || "-"}
                </TableCell>
                <TableCell>{po.title || "-"}</TableCell>
                <TableCell>{getSupplierName(po.supplierId)}</TableCell>
                <TableCell>
                  {po.orderDate 
                    ? format(new Date(po.orderDate), "d MMM yyyy", { locale: nl })
                    : "-"
                  }
                </TableCell>
                <TableCell>
                  {po.expectedDeliveryDate ? (
                    <span className={
                      new Date(po.expectedDeliveryDate) < new Date() && po.status !== 'fully_received'
                        ? "text-red-600 font-medium"
                        : ""
                    }>
                      {format(new Date(po.expectedDeliveryDate), "d MMM yyyy", { locale: nl })}
                    </span>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    €{((po.totalAmount || 0) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    {po.isPaid && (
                      <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={getStatusColor(po.status)}
                    data-testid={`badge-status-${po.id}`}
                  >
                    {getStatusLabel(po.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            </PurchaseOrderContextMenu>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
