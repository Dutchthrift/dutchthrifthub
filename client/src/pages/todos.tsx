import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Filter, 
  Plus,
  CheckSquare,
  Calendar,
  User,
  ExternalLink,
  MoreHorizontal,
  Clock,
  AlertCircle,
  FolderKanban,
  UserCheck,
  Zap
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Todo } from "@/lib/types";
import { TodoForm } from "@/components/forms/todo-form";
import { KanbanView } from "@/components/todos/kanban-view";
import { CalendarView } from "@/components/todos/calendar-view";
import { TaskDetailModal } from "@/components/todos/task-detail-modal";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Todos() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [taskScope, setTaskScope] = useState<"all" | "my">("all");
  const [showNewTodo, setShowNewTodo] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("list");
  const { toast } = useToast();
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canSeeAllTasks = user?.role === "ADMIN" || user?.role === "SUPPORT";
  const isTechnicus = user?.role === "TECHNICUS";

  const { data: todos, isLoading } = useQuery<Todo[]>({
    queryKey: ["/api/todos", { userId: (isTechnicus || (canSeeAllTasks && taskScope === "my")) && user?.id ? user.id : undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      // TECHNICUS always sees only their tasks, ADMIN/SUPPORT see all unless "My Tasks" is selected
      if ((isTechnicus || (canSeeAllTasks && taskScope === "my")) && user?.id) {
        params.append("userId", user.id);
      }
      const url = `/api/todos${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch todos");
      return response.json();
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Todo> }) => {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update todo");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      toast({
        title: "Todo updated",
        description: "Todo status has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update todo",
        variant: "destructive",
      });
    }
  });

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete todo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      toast({
        title: "Todo deleted",
        description: "Todo has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete todo",
        variant: "destructive",
      });
    }
  });

  const filteredTodos = todos?.filter(todo => {
    if (statusFilter !== "all" && todo.status !== statusFilter) return false;
    if (priorityFilter !== "all" && todo.priority !== priorityFilter) return false;
    if (searchQuery && 
        !todo.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !todo.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const todoStatusCount = {
    all: todos?.length || 0,
    todo: todos?.filter(t => t.status === 'todo').length || 0,
    in_progress: todos?.filter(t => t.status === 'in_progress').length || 0,
    done: todos?.filter(t => t.status === 'done').length || 0,
  };

  // Additional analytics metrics
  const overdueTasks = todos?.filter(t => {
    if (!t.dueDate || t.status === 'done') return false;
    return new Date(t.dueDate) < new Date();
  }).length || 0;

  const myTasks = todos?.filter(t => t.assignedUserId === user?.id).length || 0;

  const highPriorityTasks = todos?.filter(t => 
    t.priority === 'urgent' || t.priority === 'high'
  ).length || 0;

  // Get category breakdown - find top category
  const categoryCount = todos?.reduce((acc, todo) => {
    const category = todo.category || 'other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
  const topCategoryName = topCategory ? topCategory[0].charAt(0).toUpperCase() + topCategory[0].slice(1) : 'Other';
  const topCategoryCount = topCategory ? topCategory[1] : 0;

  const handleToggleTodo = (todo: Todo) => {
    const newStatus = todo.status === 'done' ? 'todo' : 'done';
    const updateData: Partial<Todo> = {
      status: newStatus as any,
      completedAt: newStatus === 'done' ? new Date().toISOString() : null,
    };
    updateTodoMutation.mutate({ id: todo.id, data: updateData });
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

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

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    const date = new Date(dueDate);
    const now = new Date();
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays < 0) return "Overdue";
    if (diffInDays === 0) return "Due today";
    if (diffInDays === 1) return "Due tomorrow";
    return `Due in ${diffInDays} days`;
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // "n" or "N" key opens new task form (when not typing)
      if ((e.key === 'n' || e.key === 'N') && !isTyping) {
        e.preventDefault();
        setShowNewTodo(true);
      }

      // "/" key focuses the search input
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // "Escape" key closes modals/forms
      if (e.key === 'Escape') {
        if (showNewTodo) {
          setShowNewTodo(false);
        } else if (editingTodo) {
          setEditingTodo(null);
        } else if (showDetailModal) {
          setShowDetailModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewTodo, editingTodo, showDetailModal]);

  return (
    <div className="min-h-screen bg-background" data-testid="todos-page">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6" data-testid="todos-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">To-do's</h1>
            <p className="text-muted-foreground">Manage personal and team tasks</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline"
              onClick={() => setViewMode(viewMode === "list" ? "kanban" : viewMode === "kanban" ? "calendar" : "list")}
              data-testid="toggle-view-mode"
            >
              {viewMode === "list" && <CheckSquare className="mr-2 h-4 w-4" />}
              {viewMode === "kanban" && <Calendar className="mr-2 h-4 w-4" />}
              {viewMode === "calendar" && <CheckSquare className="mr-2 h-4 w-4" />}
              {viewMode === "list" ? "Kanban View" : viewMode === "kanban" ? "Calendar View" : "List View"}
            </Button>
            <Button onClick={() => setShowNewTodo(true)} data-testid="new-todo-button">
              <Plus className="mr-2 h-4 w-4" />
              New To-do
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card data-testid="todos-stats-total">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todoStatusCount.all}</div>
            </CardContent>
          </Card>
          
          <Card data-testid="todos-stats-pending">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">To Do</CardTitle>
              <Clock className="h-4 w-4 text-chart-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todoStatusCount.todo}</div>
            </CardContent>
          </Card>

          <Card data-testid="todos-stats-progress">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todoStatusCount.in_progress}</div>
            </CardContent>
          </Card>

          <Card data-testid="todos-stats-done">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckSquare className="h-4 w-4 text-chart-2" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todoStatusCount.done}</div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Analytics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card data-testid="todos-stats-overdue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overdueTasks}</div>
            </CardContent>
          </Card>

          <Card data-testid="todos-stats-category">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Category</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{topCategoryCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{topCategoryName}</p>
            </CardContent>
          </Card>

          <Card data-testid="todos-stats-mine">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myTasks}</div>
            </CardContent>
          </Card>

          <Card data-testid="todos-stats-high-priority">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <Zap className="h-4 w-4 text-chart-1" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{highPriorityTasks}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search todos... (Press / to focus)"
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="todos-search-input"
                  />
                </div>
                
                {canSeeAllTasks && (
                  <Tabs value={taskScope} onValueChange={(value) => setTaskScope(value as "all" | "my")}>
                    <TabsList>
                      <TabsTrigger value="all" data-testid="filter-all-tasks">All Tasks</TabsTrigger>
                      <TabsTrigger value="my" data-testid="filter-my-tasks">My Tasks</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
                
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList>
                    <TabsTrigger value="all" data-testid="filter-all-status">All</TabsTrigger>
                    <TabsTrigger value="todo" data-testid="filter-todo-status">To Do</TabsTrigger>
                    <TabsTrigger value="in_progress" data-testid="filter-progress-status">In Progress</TabsTrigger>
                    <TabsTrigger value="done" data-testid="filter-done-status">Done</TabsTrigger>
                  </TabsList>
                </Tabs>

                <Tabs value={priorityFilter} onValueChange={setPriorityFilter}>
                  <TabsList>
                    <TabsTrigger value="all" data-testid="filter-all-priority">All Priority</TabsTrigger>
                    <TabsTrigger value="urgent" data-testid="filter-urgent-priority">Urgent</TabsTrigger>
                    <TabsTrigger value="high" data-testid="filter-high-priority">High</TabsTrigger>
                    <TabsTrigger value="medium" data-testid="filter-medium-priority">Medium</TabsTrigger>
                    <TabsTrigger value="low" data-testid="filter-low-priority">Low</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <Button variant="outline" size="icon" data-testid="advanced-filters-button">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* View Modes */}
        {viewMode === "calendar" ? (
          <CalendarView 
            todos={filteredTodos}
            onTaskClick={(todo) => {
              setSelectedTask(todo);
              setShowDetailModal(true);
            }}
            isLoading={isLoading}
          />
        ) : viewMode === "kanban" ? (
          <KanbanView
            todos={filteredTodos}
            onUpdateStatus={(todoId, newStatus) => {
              updateTodoMutation.mutate({
                id: todoId,
                data: {
                  status: newStatus,
                  completedAt: newStatus === 'done' ? new Date().toISOString() : null,
                },
              });
            }}
            onTaskClick={(todo) => {
              setSelectedTask(todo);
              setShowDetailModal(true);
            }}
            isLoading={isLoading}
          />
        ) : (
          <Card data-testid="todos-list">
            <CardContent className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 animate-pulse">
                      <div className="h-4 w-4 bg-muted rounded"></div>
                      <div className="flex-1 space-y-1">
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded w-3/4"></div>
                      </div>
                      <div className="h-4 w-4 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              ) : filteredTodos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No todos found. Create one to get started!
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTodos.map((todo) => (
                    <Card
                      key={todo.id}
                      className={`transition-all hover:shadow-md cursor-pointer ${
                        todo.status === 'done' ? 'opacity-60' : ''
                      } ${isOverdue(todo.dueDate) && todo.status !== 'done' ? 'border-destructive' : ''}`}
                      data-testid={`todo-item-${todo.id}`}
                      onClick={() => {
                        setSelectedTask(todo);
                        setShowDetailModal(true);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <Checkbox 
                            checked={todo.status === 'done'}
                            onCheckedChange={(e) => {
                              e.stopPropagation?.();
                              handleToggleTodo(todo);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={updateTodoMutation.isPending}
                            data-testid={`todo-checkbox-${todo.id}`}
                          />
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <h3 className={`font-medium ${todo.status === 'done' ? 'line-through' : ''}`}>
                                {todo.title}
                              </h3>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    data-testid={`todo-actions-${todo.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTodo(todo);
                                  }}>
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View Links
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteTodoMutation.mutate(todo.id);
                                    }}
                                    disabled={deleteTodoMutation.isPending}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            {todo.description && (
                              <p className="text-sm text-muted-foreground">{todo.description}</p>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Badge variant={getPriorityVariant(todo.priority || 'medium')}>
                                  {todo.priority ? todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1) : 'Medium'}
                                </Badge>
                                
                                {todo.status === 'in_progress' && (
                                  <Badge variant="outline" className="bg-primary/10 text-primary">
                                    In Progress
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                {todo.dueDate && (
                                  <div className={`flex items-center space-x-1 ${
                                    isOverdue(todo.dueDate) && todo.status !== 'done' ? 'text-destructive' : ''
                                  }`}>
                                    <Calendar className="h-3 w-3" />
                                    <span data-testid={`todo-due-date-${todo.id}`}>
                                      {formatDueDate(todo.dueDate)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <TodoForm 
        open={showNewTodo} 
        onOpenChange={setShowNewTodo}
      />
      
      <TodoForm 
        open={!!editingTodo} 
        onOpenChange={(open) => !open && setEditingTodo(null)}
        todo={editingTodo}
      />

      <TaskDetailModal
        todo={selectedTask}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
        }}
      />
    </div>
  );
}
