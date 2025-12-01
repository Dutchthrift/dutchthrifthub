import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, ShoppingCart, FileText } from "lucide-react";
import { useLocation } from "wouter";

interface QuickActionsWidgetProps {
  onOpenReturn?: () => void;
}

export function QuickActionsWidget({ onOpenReturn }: QuickActionsWidgetProps) {
  const [, setLocation] = useLocation();

  const actions = [
    {
      label: "Create Return",
      icon: Package,
      color: "bg-blue-500 hover:bg-blue-600",
      onClick: () => setLocation('/returns'),
    },
    {
      label: "View All Returns",
      icon: FileText,
      color: "bg-purple-500 hover:bg-purple-600",
      onClick: () => setLocation('/returns'),
    },
    {
      label: "View Orders",
      icon: ShoppingCart,
      color: "bg-green-500 hover:bg-green-600",
      onClick: () => setLocation('/orders'),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              className={`${action.color} text-white h-auto py-4 flex flex-col items-center gap-2`}
            >
              <action.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
