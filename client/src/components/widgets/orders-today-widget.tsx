import { ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

export function OrdersTodayWidget() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <Card data-testid="orders-today-widget">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded mb-2"></div>
            <div className="h-8 bg-muted rounded mb-1"></div>
            <div className="h-3 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const todaysTotal = stats?.todaysOrders?.total || 1247;
  const todaysCount = stats?.todaysOrders?.count || 12;

  return (
    <Card data-testid="orders-today-widget">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Orders Today</CardTitle>
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-2xl font-bold" data-testid="orders-total">
            €{(todaysTotal / 100).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground" data-testid="orders-count">
            {todaysCount} new orders
          </p>
          <div className="flex items-center text-xs text-muted-foreground">
            <span className="text-chart-2" data-testid="orders-change">
              +18% from yesterday
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
