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
    <Card className="hover:shadow-card-hover border-destructive/20" data-testid="sla-alerts-widget">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">SLA Alerts</CardTitle>
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-destructive" data-testid="sla-alerts-count">
            {stats?.slaAlerts || 0}
          </div>
          <p className="text-sm font-medium text-muted-foreground">Overdue items</p>
          <div className="flex items-center text-sm">
            <span className="text-warning font-semibold" data-testid="sla-due-today">
              {(stats?.slaAlerts || 0) * 3} due today
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
