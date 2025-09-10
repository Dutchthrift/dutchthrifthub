import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

export function SlaAlertsWidget() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <Card data-testid="sla-alerts-widget">
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

  return (
    <Card data-testid="sla-alerts-widget">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">SLA Alerts</CardTitle>
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-2xl font-bold text-destructive" data-testid="sla-alerts-count">
            {stats?.slaAlerts || 0}
          </div>
          <p className="text-xs text-muted-foreground">Overdue items</p>
          <div className="flex items-center text-xs text-muted-foreground">
            <span className="text-chart-4" data-testid="sla-due-today">
              {(stats?.slaAlerts || 0) * 3} due today
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
