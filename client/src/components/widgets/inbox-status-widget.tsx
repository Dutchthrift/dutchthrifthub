import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

export function InboxStatusWidget() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <Card data-testid="inbox-status-widget">
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
    <Card className="hover:shadow-card-hover" data-testid="inbox-status-widget">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Inbox Status</CardTitle>
        <div className="h-10 w-10 rounded-full bg-gradient-inbox flex items-center justify-center">
          <Mail className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-inbox" data-testid="unread-emails-count">
            {stats?.unreadEmails || 0}
          </div>
          <p className="text-sm font-medium text-muted-foreground">Unread emails</p>
          <div className="flex items-center text-sm">
            <span className="text-destructive font-semibold" data-testid="require-reply-count">
              {Math.floor((stats?.unreadEmails || 0) / 3)} require reply
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
