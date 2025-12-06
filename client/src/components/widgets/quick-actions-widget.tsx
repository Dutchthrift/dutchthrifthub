import { Card, CardContent } from "@/components/ui/card";
import { Package, Wrench, ShoppingCart, CheckSquare, Plus } from "lucide-react";
import { useLocation } from "wouter";

interface QuickActionsWidgetProps {
  onOpenReturn?: () => void;
}

export function QuickActionsWidget({ onOpenReturn }: QuickActionsWidgetProps) {
  const [, setLocation] = useLocation();

  const actions = [
    {
      label: "Nieuwe Retour",
      icon: Package,
      gradient: "from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50",
      border: "border-blue-200 dark:border-blue-800",
      textColor: "text-blue-600 dark:text-blue-400",
      titleColor: "text-blue-900 dark:text-blue-100",
      iconColor: "text-blue-500 dark:text-blue-400",
      onClick: () => setLocation('/returns'),
    },
    {
      label: "Nieuwe Reparatie",
      icon: Wrench,
      gradient: "from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50",
      border: "border-purple-200 dark:border-purple-800",
      textColor: "text-purple-600 dark:text-purple-400",
      titleColor: "text-purple-900 dark:text-purple-100",
      iconColor: "text-purple-500 dark:text-purple-400",
      onClick: () => setLocation('/repairs'),
    },
    {
      label: "Nieuwe Inkoop Order",
      icon: ShoppingCart,
      gradient: "from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50",
      border: "border-orange-200 dark:border-orange-800",
      textColor: "text-orange-600 dark:text-orange-400",
      titleColor: "text-orange-900 dark:text-orange-100",
      iconColor: "text-orange-500 dark:text-orange-400",
      onClick: () => setLocation('/purchase-orders'),
    },
    {
      label: "Nieuwe To-do",
      icon: CheckSquare,
      gradient: "from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50",
      border: "border-green-200 dark:border-green-800",
      textColor: "text-green-600 dark:text-green-400",
      titleColor: "text-green-900 dark:text-green-100",
      iconColor: "text-green-500 dark:text-green-400",
      onClick: () => setLocation('/todos'),
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <Card
          key={action.label}
          onClick={action.onClick}
          className={`bg-gradient-to-br ${action.gradient} ${action.border} hover:shadow-lg transition-all cursor-pointer group`}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className={`text-sm font-medium ${action.textColor}`}>Snelle Actie</p>
                <h3 className={`text-lg font-bold ${action.titleColor} group-hover:scale-105 transition-transform`}>
                  {action.label}
                </h3>
                <p className={`text-xs ${action.textColor} flex items-center gap-1`}>
                  <Plus className="h-3 w-3" /> Klik om te starten
                </p>
              </div>
              <action.icon className={`h-12 w-12 ${action.iconColor} opacity-20 group-hover:opacity-40 transition-opacity`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
