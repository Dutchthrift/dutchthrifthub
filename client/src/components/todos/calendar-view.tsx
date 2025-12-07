import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Calendar as CalendarIcon, AlertTriangle, Clock } from "lucide-react";
import type { Todo } from "@/lib/types";
import { DayContentProps } from "react-day-picker";

interface CalendarViewProps {
  todos: Todo[];
  onTaskClick: (todo: Todo) => void;
  isLoading: boolean;
}

export function CalendarView({ todos, onTaskClick, isLoading }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Group todos by date
  const todosByDate = useMemo(() => {
    const grouped = new Map<string, Todo[]>();

    todos.forEach((todo) => {
      if (todo.dueDate) {
        const dateKey = format(new Date(todo.dueDate), "yyyy-MM-dd");
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(todo);
      }
    });

    return grouped;
  }, [todos]);

  // Get todos for selected date or current month
  const displayedTodos = useMemo(() => {
    if (selectedDate) {
      const dateKey = format(selectedDate, "yyyy-MM-dd");
      return todosByDate.get(dateKey) || [];
    } else {
      // Show current month's todos
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      return todos.filter((todo) => {
        if (!todo.dueDate) return false;
        const dueDate = new Date(todo.dueDate);
        return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
      });
    }
  }, [selectedDate, todos, todosByDate]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-destructive";
      case "high":
        return "bg-destructive";
      case "medium":
        return "bg-chart-4";
      case "low":
        return "bg-chart-2";
      default:
        return "bg-muted-foreground";
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive" as const;
      case "high":
        return "destructive" as const;
      case "medium":
        return "secondary" as const;
      case "low":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  const formatDueDate = (dueDate: string | Date | null) => {
    if (!dueDate) return null;
    const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const now = new Date();
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) return "Overdue";
    if (diffInDays === 0) return "Due today";
    if (diffInDays === 1) return "Due tomorrow";
    return `Due in ${diffInDays} days`;
  };

  const isOverdue = (dueDate: string | Date | null) => {
    if (!dueDate) return false;
    const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    return date < new Date();
  };

  // Custom day content to show task indicators
  const renderDayContent = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dateTodos = todosByDate.get(dateKey) || [];

    if (dateTodos.length === 0) {
      return null;
    }

    // Get priority distribution
    const priorityCounts = {
      urgent: dateTodos.filter(t => t.priority === "urgent").length,
      high: dateTodos.filter(t => t.priority === "high").length,
      medium: dateTodos.filter(t => t.priority === "medium").length,
      low: dateTodos.filter(t => t.priority === "low").length,
    };

    // Show highest priority dot
    let dotColor = "bg-muted-foreground";
    if (priorityCounts.urgent > 0) dotColor = "bg-destructive";
    else if (priorityCounts.high > 0) dotColor = "bg-chart-1";
    else if (priorityCounts.medium > 0) dotColor = "bg-chart-4";
    else if (priorityCounts.low > 0) dotColor = "bg-chart-2";

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
          {dateTodos.length > 1 && (
            <span className="text-[9px] font-semibold">{dateTodos.length}</span>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="calendar-loading">
        <Card>
          <CardContent className="p-6">
            <div className="h-80 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="calendar-view">
      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Task Calendar</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="relative">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{
                hasTasks: (date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  return todosByDate.has(dateKey);
                }
              }}
              modifiersStyles={{
                hasTasks: {
                  fontWeight: "bold"
                }
              }}
              components={{
                DayContent: ({ date }: DayContentProps) => (
                  <div className="relative w-full h-full">
                    <div>{format(date, "d")}</div>
                    {renderDayContent(date)}
                  </div>
                )
              }}
              data-testid="calendar-picker"
            />
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Tasks */}
      <Card data-testid="calendar-tasks-list">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">
              {selectedDate ? (
                <span data-testid="calendar-selected-date">
                  Tasks for {format(selectedDate, "MMMM d, yyyy")}
                </span>
              ) : (
                <span data-testid="calendar-current-month">
                  Tasks this Month
                </span>
              )}
            </CardTitle>
            <Badge variant="secondary" data-testid="calendar-tasks-count">
              {displayedTodos.length} {displayedTodos.length === 1 ? "task" : "tasks"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayedTodos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="calendar-no-tasks">
              <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No tasks {selectedDate ? "on this date" : "this month"}</p>
            </div>
          ) : (
            displayedTodos.map((todo) => (
              <Card
                key={todo.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${todo.status === "done" ? "opacity-60" : ""
                  } ${isOverdue(todo.dueDate) && todo.status !== "done"
                    ? "border-l-4 border-l-destructive"
                    : ""
                  }`}
                onClick={() => onTaskClick(todo)}
                data-testid={`calendar-task-card-${todo.id}`}
              >
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`text-sm font-medium ${todo.status === "done" ? "line-through" : ""
                            }`}
                          data-testid={`calendar-task-title-${todo.id}`}
                        >
                          {todo.title}
                        </h4>
                        {todo.description && (
                          <p
                            className="text-xs text-muted-foreground line-clamp-2 mt-1"
                            data-testid={`calendar-task-description-${todo.id}`}
                          >
                            {todo.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={getPriorityVariant(todo.priority || "medium")}
                        className="shrink-0"
                        data-testid={`calendar-task-priority-${todo.id}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(todo.priority || "medium")} mr-1`}></div>
                        {(todo.priority || "medium").charAt(0).toUpperCase() +
                          (todo.priority || "medium").slice(1)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        {/* Status */}
                        <div className="flex items-center gap-1" data-testid={`calendar-task-status-${todo.id}`}>
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {todo.status === "todo" && "To Do"}
                            {todo.status === "in_progress" && "In Progress"}
                            {todo.status === "done" && "Completed"}
                          </span>
                        </div>

                        {/* Due Date Status */}
                        {todo.dueDate && (
                          <div
                            className={`flex items-center gap-1 ${isOverdue(todo.dueDate) && todo.status !== "done"
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                              }`}
                            data-testid={`calendar-task-due-status-${todo.id}`}
                          >
                            <CalendarIcon className="h-3 w-3" />
                            <span>{formatDueDate(todo.dueDate)}</span>
                            {isOverdue(todo.dueDate) && todo.status !== "done" && (
                              <AlertTriangle className="h-3 w-3 ml-0.5" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Time */}
                      {todo.dueDate && (
                        <span className="text-muted-foreground" data-testid={`calendar-task-time-${todo.id}`}>
                          {format(new Date(todo.dueDate), "h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
