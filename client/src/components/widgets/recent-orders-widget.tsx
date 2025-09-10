import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Order } from "@/lib/types";
import { Link } from "wouter";

export function RecentOrdersWidget() {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  if (isLoading) {
    return (
      <Card data-testid="recent-orders-widget">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-muted rounded-md"></div>
                  <div className="space-y-1">
                    <div className="h-4 bg-muted rounded w-32"></div>
                    <div className="h-3 bg-muted rounded w-24"></div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-3 bg-muted rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentOrders = orders?.slice(0, 3) || [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
      case "delivered":
        return "default";
      case "processing":
      case "shipped":
        return "secondary";
      case "pending":
        return "outline";
      case "cancelled":
      case "refunded":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getProductImage = (orderData: any) => {
    // Fallback camera image from Unsplash
    return "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?ixlib=rb-4.0.3&auto=format&fit=crop&w=48&h=48";
  };

  const getProductName = (orderData: any) => {
    if (orderData?.line_items?.[0]) {
      return orderData.line_items[0].title;
    }
    return "Camera Equipment";
  };

  return (
    <Card data-testid="recent-orders-widget">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">Recent Orders</CardTitle>
        <Link href="/orders">
          <Button variant="link" className="text-sm text-primary hover:text-primary/80" data-testid="view-all-orders">
            View all orders
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent orders found
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent transition-colors"
                data-testid={`order-item-${order.id}`}
              >
                <div className="flex items-center space-x-3">
                  <img 
                    src={getProductImage(order.orderData)} 
                    alt={getProductName(order.orderData)}
                    className="w-12 h-12 rounded-md object-cover"
                    data-testid={`order-image-${order.id}`}
                  />
                  <div>
                    <p className="text-sm font-medium" data-testid={`order-product-${order.id}`}>
                      {getProductName(order.orderData)}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`order-customer-${order.id}`}>
                      {order.customerEmail}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium" data-testid={`order-amount-${order.id}`}>
                    €{((order.totalAmount || 0) / 100).toFixed(2)}
                  </p>
                  <Badge 
                    variant={getStatusVariant(order.status)} 
                    className="text-xs"
                    data-testid={`order-status-${order.id}`}
                  >
                    {order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
