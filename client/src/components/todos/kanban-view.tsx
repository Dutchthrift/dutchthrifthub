import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, User, AlertTriangle } from "lucide-react";
import type { Todo } from "@/lib/types";

interface KanbanViewProps {
  todos: Todo[];
  onUpdateStatus: (todoId: string, newStatus: "todo" | "in_progress" | "done") => void;
  isLoading: boolean;
  onTaskClick: (todo: Todo) => void;
}

export function KanbanView({ todos, onUpdateStatus, isLoading, onTaskClick }: KanbanViewProps) {
  const columns = [
    {
      id: "todo" as const,
      title: "To Do",
      color: "bg-chart-4",
      todos: todos.filter((t) => t.status === "todo"),
    },
    {
      id: "in_progress" as const,
      title: "In Progress",
      color: "bg-primary",
      todos: todos.filter((t) => t.status === "in_progress"),
    },
    {
      id: "done" as const,
      title: "Done",
      color: "bg-chart-2",
      todos: todos.filter((t) => t.status === "done"),
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-destructive";
      case "high":
        return "text-destructive";
      case "medium":
        return "text-chart-4";
      case "low":
        return "text-chart-2";
      default:
        return "text-muted-foreground";
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

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as "todo" | "in_progress" | "done";
    onUpdateStatus(draggableId, newStatus);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="kanban-loading">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="h-96">
            <CardHeader>
              <div className="h-4 bg-muted rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-24 bg-muted rounded animate-pulse"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="kanban-view">
        {columns.map((column) => (
          <Card
            key={column.id}
            className="flex flex-col h-[calc(100vh-300px)]"
            data-testid={`kanban-column-${column.id}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                  <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {column.todos.length}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <CardContent
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-y-auto space-y-3 pb-3 ${
                    snapshot.isDraggingOver ? "bg-muted/50" : ""
                  }`}
                >
                  {column.todos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No tasks
                    </div>
                  ) : (
                    column.todos.map((todo, index) => (
                      <Draggable key={todo.id} draggableId={todo.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`cursor-pointer hover:shadow-md transition-all ${
                              snapshot.isDragging ? "shadow-lg" : ""
                            } ${
                              isOverdue(todo.dueDate) && todo.status !== "done"
                                ? "border-destructive"
                                : ""
                            }`}
                            onClick={() => onTaskClick(todo)}
                            data-testid={`kanban-todo-card-${todo.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <h4
                                    className={`text-sm font-medium flex-1 ${
                                      todo.status === "done" ? "line-through opacity-60" : ""
                                    }`}
                                    data-testid={`kanban-todo-title-${todo.id}`}
                                  >
                                    {todo.title}
                                  </h4>
                                </div>

                                {todo.description && (
                                  <p
                                    className="text-xs text-muted-foreground line-clamp-2"
                                    data-testid={`kanban-todo-description-${todo.id}`}
                                  >
                                    {todo.description}
                                  </p>
                                )}

                                <div className="flex items-center justify-between">
                                  <Badge
                                    variant={getPriorityVariant(todo.priority || "medium")}
                                    className={getPriorityColor(todo.priority || "medium")}
                                    data-testid={`kanban-todo-priority-${todo.id}`}
                                  >
                                    {(todo.priority || "medium").charAt(0).toUpperCase() +
                                      (todo.priority || "medium").slice(1)}
                                  </Badge>
                                </div>

                                {todo.dueDate && (
                                  <div
                                    className={`flex items-center space-x-1 text-xs ${
                                      isOverdue(todo.dueDate) && todo.status !== "done"
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                    }`}
                                    data-testid={`kanban-todo-due-date-${todo.id}`}
                                  >
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDueDate(todo.dueDate)}</span>
                                    {isOverdue(todo.dueDate) && todo.status !== "done" && (
                                      <AlertTriangle className="h-3 w-3 ml-1" />
                                    )}
                                  </div>
                                )}

                                {todo.assignedUserId && (
                                  <div
                                    className="flex items-center space-x-1"
                                    data-testid={`kanban-todo-assigned-${todo.id}`}
                                  >
                                    <Avatar className="h-4 w-4">
                                      <AvatarFallback className="text-xs">
                                        {todo.assignedUserId.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Assigned</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </CardContent>
              )}
            </Droppable>
          </Card>
        ))}
      </div>
    </DragDropContext>
  );
}
