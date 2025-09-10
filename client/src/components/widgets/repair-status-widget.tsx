import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Repair } from "@/lib/types";
import { Link } from "wouter";

export function RepairStatusWidget() {
  const { data: repairs, isLoading } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
  });

  if (isLoading) {
    return (
      <Card data-testid="repair-status-widget">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-muted rounded-full"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
                <div className="h-4 bg-muted rounded w-4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const repairStatusCount = {
    new: repairs?.filter(r => r.status === 'new').length || 0,
    in_progress: repairs?.filter(r => r.status === 'in_progress').length || 0,
    waiting_customer: repairs?.filter(r => r.status === 'waiting_customer').length || 0,
    waiting_part: repairs?.filter(r => r.status === 'waiting_part').length || 0,
    ready: repairs?.filter(r => r.status === 'ready').length || 0,
    closed: repairs?.filter(r => r.status === 'closed').length || 0,
  };

  const waitingCount = repairStatusCount.waiting_customer + repairStatusCount.waiting_part;

  const statusConfig = [
    { status: 'new', label: 'New', color: 'bg-chart-4', count: repairStatusCount.new },
    { status: 'in_progress', label: 'In Progress', color: 'bg-primary', count: repairStatusCount.in_progress },
    { status: 'waiting', label: 'Waiting', color: 'bg-chart-1', count: waitingCount },
    { status: 'ready', label: 'Ready', color: 'bg-chart-2', count: repairStatusCount.ready },
    { status: 'closed', label: 'Closed', color: 'bg-muted-foreground', count: repairStatusCount.closed },
  ];

  const urgentRepairs = repairs?.filter(r => 
    r.status === 'in_progress' && r.priority === 'high'
  ).slice(0, 2) || [];

  return (
    <Card data-testid="repair-status-widget">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">Repair Status Overview</CardTitle>
        <Link href="/repairs">
          <Button variant="link" className="text-sm text-primary hover:text-primary/80" data-testid="view-repair-board">
            View repair board
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statusConfig.map((config) => (
            <div 
              key={config.status}
              className="flex items-center justify-between"
              data-testid={`repair-status-${config.status}`}
            >
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${config.color}`}></div>
                <span className="text-sm font-medium">{config.label}</span>
              </div>
              <span className="text-sm font-bold" data-testid={`repair-count-${config.status}`}>
                {config.count}
              </span>
            </div>
          ))}
        </div>

        {urgentRepairs.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Urgent Repairs</h4>
            {urgentRepairs.map((repair) => (
              <div 
                key={repair.id}
                className="p-3 rounded-md bg-muted"
                data-testid={`urgent-repair-${repair.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{repair.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {repair.slaDeadline ? 
                      new Date(repair.slaDeadline) > new Date() ? 
                        `${Math.ceil((new Date(repair.slaDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left` :
                        'Overdue'
                      : 'No deadline'
                    }
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Assigned to {repair.assignedUserId ? 'Team Member' : 'Unassigned'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
