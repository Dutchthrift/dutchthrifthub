import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@/lib/types";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400",
  processing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400",
  shipped: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400",
  delivered: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400",
  cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400",
  refunded: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "In afwachting",
  processing: "In behandeling",
  shipped: "Verzonden",
  delivered: "Bezorgd",
  paid: "Betaald",
  cancelled: "Geannuleerd",
  refunded: "Terugbetaald",
};

export function RecentOrdersWidget() {
  const [, setLocation] = useLocation();
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Recente Bestellingen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get last 5 orders, sorted by order date
  const recentOrders = [...orders]
    .sort((a, b) => {
      const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
      const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const getProductName = (orderData: any) => {
    if (orderData?.line_items?.[0]) {
      return orderData.line_items[0].title;
    }
    return "Bestelling";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-xl truncate">
            <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">Bestellingen</span>
          </CardTitle>
          <button
            onClick={() => setLocation('/orders')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0"
          >
            Bekijken →
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nog geen bestellingen</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => setLocation('/orders')}
                className="w-full h-[72px] flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium truncate text-primary">
                      {order.orderNumber || order.id.slice(0, 8)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${STATUS_COLORS[order.status] || ''} text-xs px-2 py-0`}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getProductName(order.orderData)}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    {order.orderDate
                      ? format(new Date(order.orderDate), "dd MMM yyyy")
                      : "Geen datum"}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-sm font-medium text-green-600 dark:text-green-500">
                    €{((order.totalAmount || 0) / 100).toFixed(2)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
