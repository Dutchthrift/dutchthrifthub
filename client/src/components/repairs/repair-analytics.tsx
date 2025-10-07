import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Clock, Users, CheckCircle, AlertTriangle } from "lucide-react";
import type { Repair, User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { isPast } from "date-fns";

interface RepairAnalyticsProps {
  repairs: Repair[];
  users: User[];
}

export function RepairAnalytics({ repairs, users }: RepairAnalyticsProps) {
  // Total repairs
  const totalRepairs = repairs.length;

  // Overdue repairs (active repairs past SLA deadline)
  const overdueRepairs = repairs.filter(r => {
    if (!r.slaDeadline) return false;
    const isActive = !['completed', 'returned', 'canceled'].includes(r.status);
    return isActive && isPast(new Date(r.slaDeadline));
  });

  // Average repair time (in days) for completed repairs only
  const completedRepairs = repairs.filter(r => 
    (r.status === 'completed' || r.status === 'returned') && r.createdAt && r.updatedAt
  );
  const avgRepairTime = completedRepairs.length > 0
    ? Math.round(
        completedRepairs.reduce((acc, r) => {
          const days = (new Date(r.updatedAt!).getTime() - new Date(r.createdAt!).getTime()) / (1000 * 60 * 60 * 24);
          return acc + Math.max(0, days); // Ensure non-negative
        }, 0) / completedRepairs.length
      )
    : 0;

  // Repairs per technician
  const repairsByTechnician = repairs.reduce((acc, repair) => {
    if (repair.assignedUserId) {
      acc[repair.assignedUserId] = (acc[repair.assignedUserId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topTechnicians = Object.entries(repairsByTechnician)
    .map(([userId, count]) => {
      const user = users.find(u => u.id === userId);
      return {
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Onbekend',
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Pending vs completed
  const pendingStatuses = ['new', 'diagnosing', 'waiting_parts', 'repair_in_progress', 'quality_check'];
  const pendingCount = repairs.filter(r => pendingStatuses.includes(r.status)).length;
  const completedCount = repairs.filter(r => r.status === 'completed' || r.status === 'returned').length;
  const canceledCount = repairs.filter(r => r.status === 'canceled').length;

  // Common issues
  const issueCategories = repairs.reduce((acc, repair) => {
    if (repair.issueCategory) {
      acc[repair.issueCategory] = (acc[repair.issueCategory] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topIssues = Object.entries(issueCategories)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxIssueCount = topIssues.length > 0 ? topIssues[0].count : 1;

  // Urgent repairs
  const urgentRepairsList = repairs.filter(r => 
    r.priority === 'urgent' && pendingStatuses.includes(r.status)
  );
  const urgentRepairs = urgentRepairsList.length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="repair-analytics">
      <Card data-testid="card-total-repairs">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Totaal Reparaties</CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-repairs">{totalRepairs}</div>
          <p className="text-xs text-muted-foreground">
            {pendingCount} in behandeling
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-avg-repair-time">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gem. Reparatietijd</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-avg-repair-time">
            {avgRepairTime} dagen
          </div>
          <p className="text-xs text-muted-foreground">
            Gebaseerd op {completedRepairs.length} voltooide reparaties
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-status-distribution">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status Verdeling</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">In behandeling</span>
              <Badge variant="outline" data-testid="badge-pending-count">{pendingCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Voltooid</span>
              <Badge variant="outline" className="bg-green-100 text-green-800" data-testid="badge-completed-count">
                {completedCount}
              </Badge>
            </div>
            {canceledCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Geannuleerd</span>
                <Badge variant="outline" data-testid="badge-canceled-count">{canceledCount}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-overdue-repairs">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Te Laat</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-count">
            {overdueRepairs.length}
          </div>
          {overdueRepairs.length > 0 ? (
            <div className="mt-2 space-y-1">
              {overdueRepairs.slice(0, 3).map((repair) => (
                <div key={repair.id} className="text-xs truncate" data-testid={`overdue-repair-${repair.id}`}>
                  #{repair.id.slice(0, 8)} - {repair.title}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">Geen te late reparaties</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-urgent-repairs">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Urgent</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500" data-testid="text-urgent-count">
            {urgentRepairs}
          </div>
          {urgentRepairsList.length > 0 ? (
            <div className="mt-2 space-y-1">
              {urgentRepairsList.slice(0, 3).map((repair) => (
                <div key={repair.id} className="text-xs truncate" data-testid={`urgent-repair-${repair.id}`}>
                  #{repair.id.slice(0, 8)} - {repair.title}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Vereisen directe aandacht
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2" data-testid="card-top-technicians">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Technici
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topTechnicians.length > 0 ? (
            <div className="space-y-3">
              {topTechnicians.map((tech, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <span className="text-sm font-medium">{tech.name}</span>
                  </div>
                  <Badge variant="secondary" data-testid={`badge-tech-count-${index}`}>
                    {tech.count} reparaties
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Geen reparaties toegewezen aan technici
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2" data-testid="card-common-issues">
        <CardHeader>
          <CardTitle className="text-base">Meest Voorkomende Problemen</CardTitle>
        </CardHeader>
        <CardContent>
          {topIssues.length > 0 ? (
            <div className="space-y-3">
              {topIssues.map((issue, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{issue.category}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2"
                        style={{ width: `${Math.min(100, (issue.count / maxIssueCount) * 100)}%` }}
                      />
                    </div>
                    <Badge variant="outline" data-testid={`badge-issue-count-${index}`}>
                      {issue.count}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Geen probleemcategorieën geregistreerd
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
