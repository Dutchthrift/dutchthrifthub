import { useState } from "react";
import { Navigation } from "@/components/layout/navigation";
import { InboxStatusWidget } from "@/components/widgets/inbox-status-widget";
import { NewRepairsWidget } from "@/components/widgets/new-repairs-widget";
import { SlaAlertsWidget } from "@/components/widgets/sla-alerts-widget";
import { OrdersTodayWidget } from "@/components/widgets/orders-today-widget";
import { PersonalTodosWidget } from "@/components/widgets/personal-todos-widget";
import { TeamActivityWidget } from "@/components/widgets/team-activity-widget";
import { QuickActionsWidget } from "@/components/widgets/quick-actions-widget";
import { RecentOrdersWidget } from "@/components/widgets/recent-orders-widget";
import { RepairStatusWidget } from "@/components/widgets/repair-status-widget";
import { BusinessMetricsWidget } from "@/components/widgets/business-metrics-widget";
import { TodoForm } from "@/components/forms/todo-form";
import { RepairForm } from "@/components/forms/repair-form";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";

export default function Home() {
  const [openTodoDialog, setOpenTodoDialog] = useState(false);
  const [openRepairDialog, setOpenRepairDialog] = useState(false);
  return (
    <div className="min-h-screen bg-background" data-testid="home-page">
      <Navigation />
      
      <main className="flex-1 space-y-4 p-8 pt-6">
        {/* Page Header */}
        <div className="flex items-center justify-between" data-testid="page-header">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, John</h2>
            <p className="text-muted-foreground">Here's what's happening at DutchThrift today.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" data-testid="export-data-button">
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
            <Button data-testid="quick-action-button">
              <Plus className="mr-2 h-4 w-4" />
              Quick Action
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="stats-grid">
          <InboxStatusWidget />
          <NewRepairsWidget />
          <SlaAlertsWidget />
          <OrdersTodayWidget />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 lg:grid-cols-7">
          {/* Personal Todos - Takes 4 columns */}
          <div className="col-span-4">
            <PersonalTodosWidget />
          </div>
          
          {/* Team Activity - Takes 3 columns */}
          <div className="col-span-3">
            <TeamActivityWidget />
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActionsWidget 
          onOpenTodo={() => setOpenTodoDialog(true)}
          onOpenRepair={() => setOpenRepairDialog(true)}
        />

        {/* Business Performance Metrics */}
        <BusinessMetricsWidget />

        {/* Recent Orders and Repairs */}
        <div className="grid gap-4 lg:grid-cols-2" data-testid="recent-content-grid">
          <RecentOrdersWidget />
          <RepairStatusWidget />
        </div>
      </main>

      {/* Dialog Components */}
      <TodoForm 
        open={openTodoDialog} 
        onOpenChange={setOpenTodoDialog}
      />
      <RepairForm 
        open={openRepairDialog} 
        onOpenChange={setOpenRepairDialog}
      />
    </div>
  );
}
