import { Navigation } from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Download,
  Filter,
  Calendar
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats, Activity } from "@/lib/types";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const kpiCards = [
    {
      title: "Open Threads",
      value: stats?.unreadEmails || 0,
      change: "+12%",
      changeType: "increase" as const,
      icon: BarChart3,
    },
    {
      title: "First Response Time", 
      value: "2.4h",
      change: "-8%",
      changeType: "decrease" as const,
      icon: Clock,
    },
    {
      title: "Avg. Resolution",
      value: "1.2 days",
      change: "+5%", 
      changeType: "increase" as const,
      icon: TrendingUp,
    },
    {
      title: "SLA Hits",
      value: "94%",
      change: "+2%",
      changeType: "increase" as const,
      icon: Users,
    },
  ];

  const repairStatusData = [
    { status: "New", count: 7, color: "bg-chart-4" },
    { status: "In Progress", count: 12, color: "bg-primary" },
    { status: "Waiting", count: 5, color: "bg-chart-1" },
    { status: "Ready", count: 3, color: "bg-chart-2" },
    { status: "Closed", count: 28, color: "bg-muted-foreground" },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6">
        <div className="bg-card rounded-lg p-6 mb-6 border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-testid="dashboard-header">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">Analytics and team performance insights</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" data-testid="filter-dashboard">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <Button variant="outline" data-testid="date-range-picker">
                <Calendar className="mr-2 h-4 w-4" />
                Last 30 days
              </Button>
              <Button data-testid="export-report">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {kpiCards.map((kpi, index) => (
            <Card key={index} data-testid={`kpi-card-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className={`text-xs ${
                  kpi.changeType === 'increase' ? 'text-chart-2' : 'text-chart-1'
                }`}>
                  {kpi.change} from last month
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Performance Chart */}
          <div className="col-span-4">
            <Card data-testid="performance-chart">
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  {/* Placeholder for chart component */}
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                    <p>Performance chart will be displayed here</p>
                    <p className="text-sm">Integration with chart library needed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Repair Status Breakdown */}
          <div className="col-span-3">
            <Card data-testid="repair-status-breakdown">
              <CardHeader>
                <CardTitle>Repairs by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {repairStatusData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`h-3 w-3 rounded-full ${item.color}`}></div>
                        <span className="text-sm font-medium">{item.status}</span>
                      </div>
                      <span className="text-sm font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Active</span>
                    <span className="font-medium">
                      {repairStatusData.slice(0, -1).reduce((sum, item) => sum + item.count, 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Team Activity and Response Times */}
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <Card data-testid="team-activity-detailed">
            <CardHeader>
              <CardTitle>Recent Team Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 animate-pulse">
                      <div className="h-8 w-8 bg-muted rounded-full"></div>
                      <div className="flex-1 space-y-1">
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2"></div>
                      <div className="flex-1">
                        <p>{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.createdAt || '').toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="response-times">
            <CardHeader>
              <CardTitle>Response Time Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">First Response</span>
                  <div className="text-right">
                    <div className="text-lg font-bold">2.4h</div>
                    <div className="text-xs text-chart-2">↓ 8% improvement</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Resolution Time</span>
                  <div className="text-right">
                    <div className="text-lg font-bold">1.2 days</div>
                    <div className="text-xs text-chart-1">↑ 5% slower</div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">SLA Compliance</span>
                  <div className="text-right">
                    <div className="text-lg font-bold">94%</div>
                    <div className="text-xs text-chart-2">↑ 2% improvement</div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Tabs defaultValue="daily" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="daily">Daily</TabsTrigger>
                      <TabsTrigger value="weekly">Weekly</TabsTrigger>
                      <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    </TabsList>
                    <TabsContent value="daily" className="mt-4">
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Daily response time chart
                      </div>
                    </TabsContent>
                    <TabsContent value="weekly" className="mt-4">
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Weekly response time chart
                      </div>
                    </TabsContent>
                    <TabsContent value="monthly" className="mt-4">
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Monthly response time chart
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SLA Performance */}
        <Card className="mt-6" data-testid="sla-performance">
          <CardHeader>
            <CardTitle>SLA Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-chart-2">94%</div>
                <div className="text-sm text-muted-foreground">On-time Resolution</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-destructive">4</div>
                <div className="text-sm text-muted-foreground">Breached SLAs</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-chart-4">12</div>
                <div className="text-sm text-muted-foreground">At Risk</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
