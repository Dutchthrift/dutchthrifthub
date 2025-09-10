import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Todo } from "@/lib/types";
import { Link } from "wouter";

export function PersonalTodosWidget() {
  const { data: todos, isLoading } = useQuery<Todo[]>({
    queryKey: ["/api/todos"],
  });

  if (isLoading) {
    return (
      <Card data-testid="personal-todos-widget">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-3">
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const topTodos = todos?.slice(0, 5) || [];

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high":
      case "urgent":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "High Priority";
      case "urgent":
        return "Urgent";
      case "medium":
        return "Medium";
      case "low":
        return "Low";
      default:
        return "Medium";
    }
  };

  return (
    <Card data-testid="personal-todos-widget">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-medium">Personal To-do's</CardTitle>
        <Link href="/todos">
          <Button variant="link" className="text-sm text-primary hover:text-primary/80" data-testid="view-all-todos">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {topTodos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No todos found. Create one to get started!
          </div>
        ) : (
          <div className="space-y-3">
            {topTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center space-x-3 p-3 rounded-md border border-border hover:bg-accent transition-colors"
                data-testid={`todo-item-${todo.id}`}
              >
                <Checkbox 
                  checked={todo.status === 'done'}
                  data-testid={`todo-checkbox-${todo.id}`}
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{todo.title}</p>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span data-testid={`todo-due-date-${todo.id}`}>
                      Due: {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : 'No due date'}
                    </span>
                    <Badge 
                      variant={getPriorityVariant(todo.priority || 'medium')}
                      className="text-xs"
                      data-testid={`todo-priority-${todo.id}`}
                    >
                      {getPriorityLabel(todo.priority || 'medium')}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" data-testid={`todo-link-${todo.id}`}>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
