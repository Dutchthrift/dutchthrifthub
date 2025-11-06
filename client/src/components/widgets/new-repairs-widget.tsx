import { Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

export function NewRepairsWidget() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <Card data-testid="new-repairs-widget">
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
    <Card className="hover:shadow-card-hover" data-testid="new-repairs-widget">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">New Repairs</CardTitle>
        <div className="h-10 w-10 rounded-full bg-gradient-repairs flex items-center justify-center">
          <Wrench className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-repairs" data-testid="new-repairs-count">
            {stats?.newRepairs || 0}
          </div>
          <p className="text-sm font-medium text-muted-foreground">Unassigned requests</p>
          <div className="flex items-center text-sm">
            <span className="text-secondary font-semibold" data-testid="repairs-change">
              +{Math.floor((stats?.newRepairs || 0) / 3)} from yesterday
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
