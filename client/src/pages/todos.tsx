import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/layout/navigation";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
  CheckSquare,
  Calendar,
  ExternalLink,
  MoreHorizontal,
  X,
  LayoutGrid,
  List,
  CalendarDays
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Todos() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState<string>("all"); // "all", "my", or a userId
  const [showNewTodo, setShowNewTodo] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("kanban");
  const { toast } = useToast();
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canSeeAllTasks = user?.role === "ADMIN" || user?.role === "SUPPORT";
  const isTechnicus = user?.role === "TECHNICUS";

  // Helper function to get the userId for filtering
  function getFilterUserId(): string | undefined {
    if (isTechnicus && user?.id) return user.id; // Technicians always see only their tasks
    if (userFilter === "all") return undefined; // Show all tasks
    if (userFilter === "my" && user?.id) return user.id; // Show my tasks
    return userFilter; // Show specific user's tasks
  }

  const { data: todos, isLoading } = useQuery<Todo[]>({
    queryKey: ["/api/todos", { userId: getFilterUserId() }],
    queryFn: async () => {
      const params = new URLSearchParams();
      const filterUserId = getFilterUserId();
      if (filterUserId) {
        params.append("userId", filterUserId);
      }
      const url = `/api/todos${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch todos");
      return response.json();
    },
  });

  // Fetch users list for the user filter dropdown
  const { data: users } = useQuery<{ id: string; name: string; email: string; role: string }[]>({
    queryKey: ["/api/users/list"],
    enabled: canSeeAllTasks,
  });

  // Check for todoId in URL and open detail modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const todoId = params.get('todoId');

    if (todoId && todos && todos.length > 0) {
      const todo = todos.find(t => t.id === todoId);
      if (todo) {
        setSelectedTask(todo);
        setShowDetailModal(true);
        setLocation('/todos');
      }
    }
  }, [location, todos, setLocation]);

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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/todos"] });
      const previousTodos = queryClient.getQueryData<Todo[]>(["/api/todos", { userId: getFilterUserId() }]);
      queryClient.setQueryData<Todo[]>(
        ["/api/todos", { userId: getFilterUserId() }],
        (old) => old?.map((todo) => (todo.id === id ? { ...todo, ...data } : todo)) || []
      );
      return { previousTodos };
    },
    onError: (err, variables, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(
          ["/api/todos", { userId: getFilterUserId() }],
          context.previousTodos
        );
      }
      toast({
        title: "Bijwerken mislukt",
        description: "Kon taak niet bijwerken",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Taak bijgewerkt",
        description: "Taakstatus is succesvol bijgewerkt",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete todo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      toast({
        title: "Taak verwijderd",
        description: "Taak is succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        title: "Verwijderen mislukt",
        description: "Kon taak niet verwijderen",
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

  // Status counts
  const statusCounts = {
    all: todos?.length || 0,
    todo: todos?.filter(t => t.status === 'todo').length || 0,
    in_progress: todos?.filter(t => t.status === 'in_progress').length || 0,
    done: todos?.filter(t => t.status === 'done').length || 0,
  };

  // Overdue count
  const overdueTasks = todos?.filter(t => {
    if (!t.dueDate || t.status === 'done') return false;
    return new Date(t.dueDate) < new Date();
  }).length || 0;

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
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return "Geen deadline";
    const date = new Date(dueDate);
    const now = new Date();
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays < 0) return "Verlopen";
    if (diffInDays === 0) return "Vandaag";
    if (diffInDays === 1) return "Morgen";
    return `Over ${diffInDays} dagen`;
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.key === 'n' || e.key === 'N') && !isTyping) {
        e.preventDefault();
        setShowNewTodo(true);
      }
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (showNewTodo) setShowNewTodo(false);
        else if (editingTodo) setEditingTodo(null);
        else if (showDetailModal) setShowDetailModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewTodo, editingTodo, showDetailModal]);

  return (
    <div className="min-h-screen bg-background" data-testid="todos-page">
      <Navigation />

      <main className="container mx-auto px-4 py-6">
        {/* Header Card - Matching Returns/Purchase Orders style */}
        <div className="bg-card rounded-lg p-6 mb-6 border" data-testid="todos-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <CheckSquare className="h-8 w-8" />
                To-do's
              </h1>
              <p className="text-muted-foreground">Beheer persoonlijke en teamtaken</p>
            </div>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "kanban" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="h-8 w-8 p-0"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "calendar" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("calendar")}
                  className="h-8 w-8 p-0"
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => setShowNewTodo(true)} size="sm" data-testid="new-todo-button">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nieuwe Taak</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Compact Stats Strip */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 px-4 py-3 bg-card rounded-lg border mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-700 dark:text-slate-300">{statusCounts.all}</span>
            <span className="text-sm text-muted-foreground">Totaal</span>
          </div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{statusCounts.todo}</span>
            <span className="text-sm text-muted-foreground">Te Doen</span>
          </div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{statusCounts.in_progress}</span>
            <span className="text-sm text-muted-foreground">Bezig</span>
          </div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-600 dark:text-green-400">{statusCounts.done}</span>
            <span className="text-sm text-muted-foreground">Afgerond</span>
          </div>
          {overdueTasks > 0 && (
            <>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-red-600 dark:text-red-400">{overdueTasks}</span>
                <span className="text-sm text-muted-foreground">Verlopen</span>
              </div>
            </>
          )}
        </div>

        {/* Simplified Filters - No card wrapper */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Search - Full width on mobile */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Zoek taken... (druk / om te focussen)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="todos-search-input"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Status & Priority Filters - inline on mobile */}
          <div className="flex flex-wrap gap-2">
            {/* User Filter (for Admin/Support) */}
            {canSeeAllTasks && (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[160px] sm:w-[180px]">
                  <SelectValue placeholder="Gebruiker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Taken</SelectItem>
                  <SelectItem value="my">Mijn Taken</SelectItem>
                  {users && users.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                        Gebruikers
                      </div>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="todo">Te Doen</SelectItem>
                <SelectItem value="in_progress">Bezig</SelectItem>
                <SelectItem value="done">Afgerond</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[120px] sm:w-[140px]">
                <SelectValue placeholder="Prioriteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioriteit</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">Hoog</SelectItem>
                <SelectItem value="medium">Normaal</SelectItem>
                <SelectItem value="low">Laag</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
          <div data-testid="todos-list">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 bg-card rounded-lg border animate-pulse">
                    <div className="h-4 w-4 bg-muted rounded"></div>
                    <div className="flex-1 space-y-1">
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-lg border">
                <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Geen taken gevonden</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Maak een nieuwe taak aan om te beginnen
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 p-3 bg-card rounded-lg border cursor-pointer transition-all hover:shadow-sm hover:bg-accent/30 border-l-4 ${todo.priority === "urgent" || todo.priority === "high"
                      ? "border-l-destructive"
                      : todo.priority === "medium"
                        ? "border-l-amber-500"
                        : "border-l-green-500"
                      } ${todo.status === 'done' ? 'opacity-50' : ''}`}
                    data-testid={`todo-item-${todo.id}`}
                    onClick={() => {
                      setSelectedTask(todo);
                      setShowDetailModal(true);
                    }}
                  >
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

                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium text-sm truncate ${todo.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={getPriorityVariant(todo.priority || 'medium')} className="text-[10px] px-1.5 py-0">
                        {todo.priority ? todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1) : 'Medium'}
                      </Badge>

                      {todo.dueDate && (
                        <span className={`text-[10px] ${isOverdue(todo.dueDate) && todo.status !== 'done' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {formatDueDate(todo.dueDate)}
                        </span>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
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
                            Bewerken
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTodoMutation.mutate(todo.id);
                            }}
                            disabled={deleteTodoMutation.isPending}
                          >
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
