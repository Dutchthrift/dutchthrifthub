import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus } from "lucide-react";
import { format } from "date-fns";
import type { Todo } from "@/lib/types";
import { useLocation } from "wouter";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400",
  high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400",
  low: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "Hoog",
  medium: "Gemiddeld",
  low: "Laag",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Te doen",
  in_progress: "Bezig",
  done: "Klaar",
};

export function PersonalTodosWidget() {
  const [, setLocation] = useLocation();
  const { data: todos = [], isLoading } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Mijn Taken
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get top 5 todos, prioritizing incomplete ones first, then by priority
  const topTodos = [...todos]
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2);
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-xl truncate">
            <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">Taken</span>
          </CardTitle>
          <button
            onClick={() => setLocation('/todos')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0"
          >
            Bekijken →
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Action Card */}
        <button
          onClick={() => setLocation('/todos')}
          className="w-full mb-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border border-green-200 dark:border-green-800 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300 group-hover:text-green-800 dark:group-hover:text-green-200">
              Nieuwe Taak
            </span>
          </div>
        </button>

        {topTodos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Geen openstaande taken</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topTodos.map((todo) => (
              <button
                key={todo.id}
                onClick={() => setLocation('/todos')}
                className="w-full h-[72px] flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">
                      {todo.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${PRIORITY_COLORS[todo.priority || 'medium'] || ''} text-xs px-2 py-0`}
                    >
                      {PRIORITY_LABELS[todo.priority || 'medium'] || todo.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    {todo.dueDate
                      ? `Deadline: ${format(new Date(todo.dueDate), "dd MMM yyyy")}`
                      : "Geen deadline"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
