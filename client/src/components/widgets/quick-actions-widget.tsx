import { Wrench, Plus, Search, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickActionsWidgetProps {
  onOpenTodo?: () => void;
  onOpenRepair?: () => void;
}

export function QuickActionsWidget({ onOpenTodo, onOpenRepair }: QuickActionsWidgetProps) {
  const quickActions = [
    {
      id: "new-repair",
      title: "Start New Repair",
      description: "Create repair request",
      icon: Wrench,
      color: "bg-primary/10 text-primary",
      action: () => {
        onOpenRepair?.();
      }
    },
    {
      id: "new-todo",
      title: "Create To-do",
      description: "Add new task",
      icon: Plus,
      color: "bg-chart-2/10 text-chart-2",
      action: () => {
        onOpenTodo?.();
      }
    },
    {
      id: "search-orders",
      title: "Search Orders",
      description: "Find customer orders",
      icon: Search,
      color: "bg-chart-4/10 text-chart-4",
      action: () => {
        // TODO: Navigate to orders with search focus
        console.log("Navigating to orders search");
      }
    },
    {
      id: "compose-email",
      title: "Compose Email",
      description: "Send customer email",
      icon: Mail,
      color: "bg-chart-1/10 text-chart-1",
      action: () => {
        // TODO: Open email composer
        console.log("Opening email composer");
      }
    }
  ];

  return (
    <Card data-testid="quick-actions-widget">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className="h-auto p-4 justify-start text-left"
              onClick={action.action}
              data-testid={`quick-action-${action.id}`}
            >
              <div className="flex items-center space-x-3 w-full">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{action.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
