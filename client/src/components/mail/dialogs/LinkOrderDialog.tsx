import { LinkEntityDialog } from "./LinkEntityDialog";
import { Badge } from "@/components/ui/badge";

interface Order {
    id: string;
    orderNumber: string;
    customerEmail: string;
    totalAmount: number;
    status: string;
    orderDate: string;
}

interface LinkOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLink: (order: Order) => Promise<void>;
}

export function LinkOrderDialog({ open, onOpenChange, onLink }: LinkOrderDialogProps) {
    const searchOrders = async (query: string): Promise<Order[]> => {
        // If no query, fetch latest 20 orders
        const searchParam = query ? `search=${encodeURIComponent(query)}&` : '';
        const res = await fetch(`/api/orders?${searchParam}limit=20`);
        if (!res.ok) throw new Error("Failed to search orders");
        const data = await res.json();
        return data.orders || data.data || data; // Handle different response formats
    };

    return (
        <LinkEntityDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Bestelling Koppelen"
            description="Zoek een bestelling om te koppelen aan deze email."
            searchPlaceholder="Zoek op bestelnummer of email..."
            onLink={onLink}
            searchFn={searchOrders}
            renderItem={(order, isSelected) => (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">{order.orderNumber}</span>
                        <Badge variant="outline">{order.status}</Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{order.customerEmail}</span>
                        <span>€{(order.totalAmount / 100).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {new Date(order.orderDate).toLocaleDateString()}
                    </div>
                </div>
            )}
        />
    );
}
