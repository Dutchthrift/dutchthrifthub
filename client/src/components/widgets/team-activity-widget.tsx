import { Check, Mail, ShoppingCart, AlertTriangle, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@/lib/types";
import { Link } from "wouter";

export function TeamActivityWidget() {
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  if (isLoading) {
    return (
      <Card data-testid="team-activity-widget">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="h-8 w-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "repair_completed":
      case "todo_completed":
        return <Check className="h-4 w-4 text-white" />;
      case "email_replied":
      case "email_sent":
        return <Mail className="h-4 w-4 text-white" />;
      case "order_created":
      case "order_updated":
        return <ShoppingCart className="h-4 w-4 text-white" />;
      case "repair_created":
      case "repair_status_updated":
        return <Wrench className="h-4 w-4 text-white" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-white" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "repair_completed":
      case "todo_completed":
        return "bg-chart-2";
      case "email_replied":
      case "email_sent":
        return "bg-primary";
      case "order_created":
      case "order_updated":
        return "bg-chart-4";
      case "repair_created":
      case "repair_status_updated":
        return "bg-chart-2";
      default:
        return "bg-destructive";
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const activityDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  return (
    <Card data-testid="team-activity-widget">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">Team Activity</CardTitle>
        <Link href="/dashboard">
          <Button variant="link" className="text-sm text-primary hover:text-primary/80" data-testid="view-all-activities">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-3"
                data-testid={`activity-item-${activity.id}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm" data-testid={`activity-description-${activity.id}`}>
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`activity-timestamp-${activity.id}`}>
                    {formatTimeAgo(activity.createdAt || new Date().toISOString())}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
