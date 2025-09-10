import { TrendingUp, TrendingDown, DollarSign, Users, Calendar, Target } from "lucide-react";
import { createElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Order, Repair, Customer } from "@/lib/types";

interface BusinessMetrics {
  weeklyRevenue: number;
  weeklyRevenueChange: number;
  monthlyCustomers: number;
  monthlyCustomersChange: number;
  avgRepairTime: number;
  repairTimeChange: number;
  customerSatisfaction: number;
  satisfactionChange: number;
}

export function BusinessMetricsWidget() {
  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: repairs, isLoading: repairsLoading } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
  });

  const { data: customers, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const isLoading = ordersLoading || repairsLoading || customersLoading;

  if (isLoading) {
    return (
      <Card data-testid="business-metrics-widget">
        <CardContent className="p-6">
          <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-8 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate business metrics
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Weekly revenue
  const thisWeekOrders = orders?.filter(order => 
    order.createdAt && new Date(order.createdAt) >= weekAgo
  ) || [];
  const lastWeekOrders = orders?.filter(order => 
    order.createdAt && 
    new Date(order.createdAt) >= twoWeeksAgo && 
    new Date(order.createdAt) < weekAgo
  ) || [];

  const thisWeekRevenue = thisWeekOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0) / 100;
  const lastWeekRevenue = lastWeekOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0) / 100;
  const revenueChange = lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;

  // Monthly new customers
  const newCustomersThisMonth = customers?.filter(customer => 
    customer.createdAt && new Date(customer.createdAt) >= monthAgo
  ).length || 0;
  
  const newCustomersLastMonth = customers?.filter(customer => 
    customer.createdAt && 
    new Date(customer.createdAt) >= new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) && // 60 days ago
    new Date(customer.createdAt) < monthAgo
  ).length || 0;
  
  const customersChange = newCustomersLastMonth > 0 ? 
    ((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100 : 0;

  // Real average repair time calculation
  const closedRepairs = repairs?.filter(repair => 
    repair.status === 'closed' && repair.createdAt && repair.completedAt
  ) || [];
  
  let avgRepairDays = 0;
  let lastMonthAvgRepairDays = 0;
  
  if (closedRepairs.length > 0) {
    const recentClosedRepairs = closedRepairs.filter(repair => 
      repair.completedAt && new Date(repair.completedAt) >= monthAgo
    );
    
    const oldClosedRepairs = closedRepairs.filter(repair => 
      repair.completedAt && 
      new Date(repair.completedAt) >= new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) &&
      new Date(repair.completedAt) < monthAgo
    );
    
    if (recentClosedRepairs.length > 0) {
      const totalDays = recentClosedRepairs.reduce((sum, repair) => {
        const created = new Date(repair.createdAt!);
        const completed = new Date(repair.completedAt!);
        return sum + Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgRepairDays = totalDays / recentClosedRepairs.length;
    }
    
    if (oldClosedRepairs.length > 0) {
      const totalOldDays = oldClosedRepairs.reduce((sum, repair) => {
        const created = new Date(repair.createdAt!);
        const completed = new Date(repair.completedAt!);
        return sum + Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      lastMonthAvgRepairDays = totalOldDays / oldClosedRepairs.length;
    }
  }
  
  const repairTimeChange = lastMonthAvgRepairDays > 0 ? 
    ((avgRepairDays - lastMonthAvgRepairDays) / lastMonthAvgRepairDays) * 100 : 0;
  
  // Real customer satisfaction based on repair SLA performance
  const totalRepairs = repairs?.length || 0;
  const recentRepairs = repairs?.filter(repair => 
    repair.createdAt && new Date(repair.createdAt) >= monthAgo
  ) || [];
  
  const oldRepairs = repairs?.filter(repair => 
    repair.createdAt && 
    new Date(repair.createdAt) >= new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) &&
    new Date(repair.createdAt) < monthAgo
  ) || [];
  
  // Calculate satisfaction based on repairs closed within reasonable time (< 7 days)
  const satisfiedRecentRepairs = recentRepairs.filter(repair => {
    if (repair.status !== 'closed' || !repair.createdAt || !repair.completedAt) return false;
    const repairDays = Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return repairDays <= 7; // Satisfied if completed within a week
  }).length;
  
  const satisfiedOldRepairs = oldRepairs.filter(repair => {
    if (repair.status !== 'closed' || !repair.createdAt || !repair.completedAt) return false;
    const repairDays = Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return repairDays <= 7;
  }).length;
  
  const satisfactionRate = recentRepairs.length > 0 ? (satisfiedRecentRepairs / recentRepairs.length) * 100 : 0;
  const oldSatisfactionRate = oldRepairs.length > 0 ? (satisfiedOldRepairs / oldRepairs.length) * 100 : 0;
  
  const satisfactionChange = oldSatisfactionRate > 0 ? satisfactionRate - oldSatisfactionRate : 0;

  const metrics: BusinessMetrics = {
    weeklyRevenue: thisWeekRevenue,
    weeklyRevenueChange: revenueChange,
    monthlyCustomers: newCustomersThisMonth,
    monthlyCustomersChange: customersChange,
    avgRepairTime: avgRepairDays,
    repairTimeChange: repairTimeChange,
    customerSatisfaction: satisfactionRate,
    satisfactionChange: satisfactionChange,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (change: number) => {
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (change: number, inverse = false) => {
    const positive = inverse ? change < 0 : change > 0;
    return positive ? "text-chart-2" : "text-destructive";
  };

  return (
    <Card data-testid="business-metrics-widget">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Business Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Weekly Revenue */}
          <div className="space-y-2" data-testid="weekly-revenue-metric">
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Weekly Revenue</span>
            </div>
            <div className="text-xl font-bold">
              {formatCurrency(metrics.weeklyRevenue)}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {createElement(getTrendIcon(metrics.weeklyRevenueChange), {
                className: `h-3 w-3 ${getTrendColor(metrics.weeklyRevenueChange)}`
              })}
              <span className={getTrendColor(metrics.weeklyRevenueChange)}>
                {formatPercentage(metrics.weeklyRevenueChange)}
              </span>
              <span className="text-muted-foreground">vs last week</span>
            </div>
          </div>

          {/* Monthly Customers */}
          <div className="space-y-2" data-testid="monthly-customers-metric">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">New Customers</span>
            </div>
            <div className="text-xl font-bold">
              {metrics.monthlyCustomers}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {createElement(getTrendIcon(metrics.monthlyCustomersChange), {
                className: `h-3 w-3 ${getTrendColor(metrics.monthlyCustomersChange)}`
              })}
              <span className={getTrendColor(metrics.monthlyCustomersChange)}>
                {formatPercentage(metrics.monthlyCustomersChange)}
              </span>
              <span className="text-muted-foreground">this month</span>
            </div>
          </div>

          {/* Average Repair Time */}
          <div className="space-y-2" data-testid="repair-time-metric">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Avg Repair Time</span>
            </div>
            <div className="text-xl font-bold">
              {metrics.avgRepairTime.toFixed(1)} days
            </div>
            <div className="flex items-center gap-1 text-xs">
              {createElement(getTrendIcon(metrics.repairTimeChange), {
                className: `h-3 w-3 ${getTrendColor(metrics.repairTimeChange, true)}`
              })}
              <span className={getTrendColor(metrics.repairTimeChange, true)}>
                {formatPercentage(metrics.repairTimeChange)}
              </span>
              <span className="text-muted-foreground">improvement</span>
            </div>
          </div>

          {/* Customer Satisfaction */}
          <div className="space-y-2" data-testid="satisfaction-metric">
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Satisfaction</span>
            </div>
            <div className="text-xl font-bold">
              {metrics.customerSatisfaction.toFixed(0)}%
            </div>
            <div className="flex items-center gap-1 text-xs">
              {createElement(getTrendIcon(metrics.satisfactionChange), {
                className: `h-3 w-3 ${getTrendColor(metrics.satisfactionChange)}`
              })}
              <span className={getTrendColor(metrics.satisfactionChange)}>
                {formatPercentage(metrics.satisfactionChange)}
              </span>
              <span className="text-muted-foreground">rating</span>
            </div>
          </div>
        </div>

        {/* Performance Badges */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          {metrics.weeklyRevenueChange > 0 && (
            <Badge variant="default" className="text-xs">
              Revenue Growing
            </Badge>
          )}
          {metrics.monthlyCustomers > 5 && (
            <Badge variant="secondary" className="text-xs">
              Strong Acquisition
            </Badge>
          )}
          {metrics.avgRepairTime < 5 && (
            <Badge variant="outline" className="text-xs">
              Fast Turnaround
            </Badge>
          )}
          {metrics.customerSatisfaction > 90 && (
            <Badge variant="default" className="text-xs">
              High Satisfaction
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}