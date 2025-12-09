import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { NoteComposer } from "@/components/notes/NoteComposer";
import { NoteItem } from "@/components/notes/NoteItem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Package,
  Wrench,
  UserCircle,
  Folder,
  Check,
  X,
  User,
  MessageSquare,
  ExternalLink,
  ListTodo,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import type { Todo, User as UserType, Order, Case, Repair, Customer } from "@/lib/types";
import type { Note, NoteTag, User as NoteUser } from "@shared/schema";
import { TodoForm } from "@/components/forms/todo-form";
import { QuickActionsBar } from "@/components/todos/quick-actions-bar";
import { SubtasksSection } from "@/components/todos/subtasks-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TaskDetailModalProps {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function TaskDetailModal({ todo, open, onOpenChange, onUpdate }: TaskDetailModalProps) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const { toast } = useToast();

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users/list"],
    enabled: !!todo,
  });

  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error("Not authenticated");
      const data = await response.json();
      return data.user;
    },
  });

  const { data: linkedOrder } = useQuery<Order>({
    queryKey: ["/api/orders", todo?.orderId],
    enabled: !!todo?.orderId,
  });

  const { data: linkedCase } = useQuery<Case>({
    queryKey: ["/api/cases", todo?.caseId],
    enabled: !!todo?.caseId,
  });

  const { data: linkedRepair } = useQuery<Repair>({
    queryKey: ["/api/repairs", todo?.repairId],
    enabled: !!todo?.repairId,
  });

  const { data: linkedCustomer } = useQuery<Customer>({
    queryKey: ["/api/customers", todo?.customerId],
    enabled: !!todo?.customerId,
  });

  const { data: subtasks = [] } = useQuery({
    queryKey: ["/api/todos", todo?.id, "subtasks"],
    enabled: !!todo?.id,
    queryFn: async () => {
      const response = await fetch(`/api/todos/${todo!.id}/subtasks`);
      if (!response.ok) throw new Error("Failed to fetch subtasks");
      return response.json();
    },
  });

  // Notes query
  const { data: notes = [] } = useQuery<(Note & { author?: NoteUser; tags?: NoteTag[] })[]>({
    queryKey: ["/api/notes", "todo", todo?.id],
    enabled: !!todo?.id,
    queryFn: async () => {
      const response = await fetch(`/api/notes/todo/${todo!.id}`);
      if (!response.ok) throw new Error("Failed to fetch notes");
      return response.json();
    },
  });

  const { data: availableTags = [] } = useQuery<NoteTag[]>({
    queryKey: ["/api/note-tags"],
    enabled: !!todo?.id,
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
      onOpenChange(false);
      onUpdate?.();
    },
    onError: () => {
      toast({
        title: "Verwijderen mislukt",
        description: "Kon taak niet verwijderen",
        variant: "destructive",
      });
    }
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
      toast({ title: "Taak bijgewerkt" });
      onUpdate?.();
    },
    onError: () => {
      toast({
        title: "Bijwerken mislukt",
        description: "Kon taak niet bijwerken",
        variant: "destructive",
      });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: { content: string; plainText: string; tagIds: string[] }) => {
      const response = await apiRequest("POST", "/api/notes", {
        entityType: "todo",
        entityId: todo!.id,
        content: noteData.content,
        plainText: noteData.plainText,
        visibility: "internal",
        authorId: currentUser?.id,
      });
      const newNote = await response.json();

      if (noteData.tagIds.length > 0) {
        await Promise.all(
          noteData.tagIds.map((tagId) =>
            apiRequest("POST", `/api/notes/${newNote.id}/tags/${tagId}`)
          )
        );
      }

      return newNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", "todo", todo?.id] });
      toast({ title: "Notitie toegevoegd" });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon notitie niet toevoegen",
        variant: "destructive",
      });
    },
  });

  const pinNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("POST", `/api/notes/${noteId}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", "todo", todo?.id] });
    },
  });

  const unpinNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("DELETE", `/api/notes/${noteId}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", "todo", todo?.id] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const reason = window.prompt("Reden voor verwijderen?");
      if (!reason) throw new Error("Reden is verplicht");
      return apiRequest("DELETE", `/api/notes/${noteId}`, { deleteReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", "todo", todo?.id] });
      toast({ title: "Notitie verwijderd" });
    },
  });

  const reactToNoteMutation = useMutation({
    mutationFn: async ({ noteId, emoji }: { noteId: string; emoji: string }) => {
      return apiRequest("POST", `/api/notes/${noteId}/reactions`, {
        userId: currentUser?.id,
        emoji,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", "todo", todo?.id] });
    },
  });

  const handleDelete = () => {
    if (todo) {
      deleteTodoMutation.mutate(todo.id);
    }
  };

  const handleStartEditTitle = () => {
    if (todo) {
      setEditedTitle(todo.title);
      setIsEditingTitle(true);
    }
  };

  const handleStartEditDescription = () => {
    if (todo) {
      setEditedDescription(todo.description || "");
      setIsEditingDescription(true);
    }
  };

  const handleSaveTitle = () => {
    if (todo && editedTitle.trim()) {
      updateTodoMutation.mutate({
        id: todo.id,
        data: { title: editedTitle },
      });
      setIsEditingTitle(false);
    }
  };

  const handleSaveDescription = () => {
    if (todo) {
      updateTodoMutation.mutate({
        id: todo.id,
        data: { description: editedDescription },
      });
      setIsEditingDescription(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  };

  const getAssignedUser = () => {
    if (!todo || !users) return null;
    return users.find(u => u.id === todo.assignedUserId);
  };

  const getCreatedByUser = () => {
    if (!todo || !users) return null;
    return users.find(u => u.id === todo.createdBy);
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "urgent":
        return { color: "bg-red-500", bgLight: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", label: "Urgent" };
      case "high":
        return { color: "bg-orange-500", bgLight: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", label: "Hoog" };
      case "medium":
        return { color: "bg-amber-500", bgLight: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", label: "Normaal" };
      case "low":
        return { color: "bg-green-500", bgLight: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-300", label: "Laag" };
      default:
        return { color: "bg-slate-500", bgLight: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", label: "Normaal" };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "done":
        return { icon: <CheckCircle className="h-5 w-5 text-green-500" />, label: "Afgerond", color: "text-green-600" };
      case "in_progress":
        return { icon: <Clock className="h-5 w-5 text-blue-500" />, label: "Bezig", color: "text-blue-600" };
      case "todo":
        return { icon: <AlertCircle className="h-5 w-5 text-amber-500" />, label: "Te Doen", color: "text-amber-600" };
      default:
        return { icon: <AlertCircle className="h-5 w-5 text-slate-500" />, label: status, color: "text-slate-600" };
    }
  };

  const formatCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      orders: "Orders",
      purchasing: "Inkoop",
      marketing: "Marketing",
      admin: "Admin",
      other: "Overig",
    };
    return labels[category] || category;
  };

  if (showEditForm && todo) {
    return (
      <TodoForm
        open={showEditForm}
        onOpenChange={(open) => {
          setShowEditForm(open);
          if (!open) {
            onUpdate?.();
          }
        }}
        todo={todo}
      />
    );
  }

  const priorityConfig = getPriorityConfig(todo?.priority || 'medium');
  const statusConfig = getStatusConfig(todo?.status || 'todo');

  const pinnedNotes = notes.filter((note) => note.isPinned && !note.deletedAt);
  const unpinnedNotes = notes.filter((note) => !note.isPinned && !note.deletedAt);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 [&>button]:hidden"
          data-testid="task-detail-modal"
        >
          {/* Header with Title and Uniform Icon Buttons (like PO modal) */}
          {todo && (
            <div className={`${priorityConfig.bgLight} px-5 pt-4 pb-3 border-b`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="text-lg font-semibold bg-background"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={handleSaveTitle} className="h-8 w-8 shrink-0">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8 shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <DialogTitle
                          className="text-xl font-semibold cursor-pointer hover:opacity-70"
                          onClick={handleStartEditTitle}
                        >
                          {todo.title}
                        </DialogTitle>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={`${priorityConfig.color} text-white text-xs`}>
                          {priorityConfig.label}
                        </Badge>
                        <Badge variant="outline" className={statusConfig.color}>
                          {statusConfig.label}
                        </Badge>
                        {todo.category && (
                          <Badge variant="secondary" className="text-xs">
                            <Folder className="h-3 w-3 mr-1" />
                            {formatCategoryLabel(todo.category)}
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {/* Uniform Icon Buttons Group (matching PO modal) */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowEditForm(true)}
                    data-testid="edit-task-button"
                    title="Bewerken"
                    className="h-8 w-8 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleteTodoMutation.isPending}
                    data-testid="delete-task-button"
                    title="Verwijderen"
                    className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    title="Sluiten"
                    className="h-8 w-8 rounded-full text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!todo ? (
              <div className="flex items-center justify-center py-8" data-testid="task-loading">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                  <p className="text-sm text-muted-foreground">Laden...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                {users && (
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <QuickActionsBar
                      todo={todo}
                      users={users}
                      onStatusChange={(status) => {
                        updateTodoMutation.mutate({
                          id: todo.id,
                          data: {
                            status: status as any,
                            completedAt: status === 'done' ? new Date().toISOString() : null,
                          },
                        });
                      }}
                      onPriorityChange={(priority) => {
                        updateTodoMutation.mutate({
                          id: todo.id,
                          data: { priority: priority as any },
                        });
                      }}
                      onAssignUser={(userId) => {
                        updateTodoMutation.mutate({
                          id: todo.id,
                          data: { assignedUserId: userId },
                        });
                      }}
                      onDueDateChange={(date) => {
                        updateTodoMutation.mutate({
                          id: todo.id,
                          data: { dueDate: date },
                        });
                      }}
                      isUpdating={updateTodoMutation.isPending}
                    />
                  </div>
                )}

                {/* 2-Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Description, Subtasks, Note Composer */}
                  <div className="space-y-4">
                    {/* Description */}
                    <div className="border rounded-lg border-l-4 border-l-blue-500">
                      <div className="flex items-center gap-2 px-3 py-2 border-b bg-blue-50/50 dark:bg-blue-950/20">
                        <Folder className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Beschrijving</span>
                      </div>
                      <div className="p-3">
                        {isEditingDescription ? (
                          <div className="space-y-2">
                            <textarea
                              value={editedDescription}
                              onChange={(e) => setEditedDescription(e.target.value)}
                              className="w-full min-h-[80px] p-2 text-sm border rounded bg-background resize-none"
                              autoFocus
                              placeholder="Voeg een beschrijving toe..."
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveDescription}>
                                <Check className="h-3 w-3 mr-1" />
                                Opslaan
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                Annuleren
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="text-sm whitespace-pre-wrap cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors min-h-[40px]"
                            onClick={handleStartEditDescription}
                          >
                            {todo.description || <span className="text-muted-foreground italic">Klik om beschrijving toe te voegen...</span>}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Subtasks */}
                    <div className="border rounded-lg border-l-4 border-l-purple-500">
                      <div className="flex items-center gap-2 px-3 py-2 border-b bg-purple-50/50 dark:bg-purple-950/20">
                        <ListTodo className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Subtaken</span>
                      </div>
                      <div className="p-3">
                        <SubtasksSection todoId={todo.id} subtasks={subtasks} />
                      </div>
                    </div>

                    {/* Note Composer - Left Side */}
                    {currentUser && (
                      <div className="border rounded-lg border-l-4 border-l-rose-500">
                        <div className="flex items-center gap-2 px-3 py-2 border-b bg-rose-50/50 dark:bg-rose-950/20">
                          <MessageSquare className="h-3.5 w-3.5 text-rose-600" />
                          <span className="text-sm font-medium text-rose-900 dark:text-rose-100">Notitie Toevoegen</span>
                        </div>
                        <div className="p-3">
                          <NoteComposer
                            onSubmit={(noteData) => createNoteMutation.mutate(noteData)}
                            isPending={createNoteMutation.isPending}
                            availableTags={availableTags}
                            placeholder="Schrijf een notitie..."
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Details, Linked Entities, Notes List */}
                  <div className="space-y-4">
                    {/* Details */}
                    <div className="border rounded-lg border-l-4 border-l-emerald-500">
                      <div className="flex items-center gap-2 px-3 py-2 border-b bg-emerald-50/50 dark:bg-emerald-950/20">
                        <User className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Details</span>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Toegewezen aan
                            </div>
                            <div className="font-medium">
                              {getAssignedUser() ?
                                `${getAssignedUser()?.firstName} ${getAssignedUser()?.lastName}` :
                                <span className="text-muted-foreground">Niemand</span>}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Deadline
                            </div>
                            <div className="font-medium">
                              {todo.dueDate ? (
                                <span className={new Date(todo.dueDate) < new Date() && todo.status !== 'done' ? 'text-destructive' : ''}>
                                  {format(new Date(todo.dueDate), "d MMM yyyy", { locale: nl })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Geen</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                              <UserCircle className="h-3 w-3" />
                              Aangemaakt door
                            </div>
                            <div className="font-medium">
                              {getCreatedByUser() ?
                                `${getCreatedByUser()?.firstName}` :
                                <span className="text-muted-foreground">Onbekend</span>}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Voltooid op
                            </div>
                            <div className="font-medium">
                              {todo.completedAt ? (
                                <span className="text-green-600 dark:text-green-400">
                                  {format(new Date(todo.completedAt), "d MMM", { locale: nl })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Linked Entities */}
                    {(linkedOrder || linkedCase || linkedRepair || linkedCustomer) && (
                      <div className="border rounded-lg border-l-4 border-l-amber-500">
                        <div className="flex items-center gap-2 px-3 py-2 border-b bg-amber-50/50 dark:bg-amber-950/20">
                          <ExternalLink className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Gekoppeld aan</span>
                        </div>
                        <div className="p-3 space-y-1.5">
                          {linkedOrder && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-8 text-xs"
                              onClick={() => window.location.href = `/orders/${linkedOrder.id}`}
                            >
                              <Package className="h-3.5 w-3.5 mr-2 text-blue-500" />
                              Order {linkedOrder.orderNumber}
                            </Button>
                          )}
                          {linkedCase && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-8 text-xs"
                              onClick={() => window.location.href = `/cases/${linkedCase.id}`}
                            >
                              <Folder className="h-3.5 w-3.5 mr-2 text-purple-500" />
                              Case #{linkedCase.caseNumber}
                            </Button>
                          )}
                          {linkedRepair && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-8 text-xs"
                              onClick={() => window.location.href = `/repairs/${linkedRepair.id}`}
                            >
                              <Wrench className="h-3.5 w-3.5 mr-2 text-orange-500" />
                              Reparatie: {linkedRepair.title}
                            </Button>
                          )}
                          {linkedCustomer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-8 text-xs"
                              onClick={() => window.location.href = `/customers/${linkedCustomer.id}`}
                            >
                              <UserCircle className="h-3.5 w-3.5 mr-2 text-green-500" />
                              {linkedCustomer.firstName} {linkedCustomer.lastName}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes List - Right Side */}
                    <div className="border rounded-lg border-l-4 border-l-rose-500">
                      <div className="flex items-center gap-2 px-3 py-2 border-b bg-rose-50/50 dark:bg-rose-950/20">
                        <MessageSquare className="h-3.5 w-3.5 text-rose-600" />
                        <span className="text-sm font-medium text-rose-900 dark:text-rose-100">
                          Notities ({notes.filter(n => !n.deletedAt).length})
                        </span>
                      </div>
                      <div className="p-3 max-h-[250px] overflow-y-auto">
                        {notes.filter(n => !n.deletedAt).length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-40" />
                            <p>Nog geen notities</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pinnedNotes.map((note) => (
                              <NoteItem
                                key={note.id}
                                note={note}
                                currentUserId={currentUser?.id || ""}
                                onPin={(noteId) => pinNoteMutation.mutate(noteId)}
                                onUnpin={(noteId) => unpinNoteMutation.mutate(noteId)}
                                onDelete={(noteId) => deleteNoteMutation.mutate(noteId)}
                                onReact={(noteId, emoji) => reactToNoteMutation.mutate({ noteId, emoji })}
                              />
                            ))}
                            {unpinnedNotes.map((note) => (
                              <NoteItem
                                key={note.id}
                                note={note}
                                currentUserId={currentUser?.id || ""}
                                onPin={(noteId) => pinNoteMutation.mutate(noteId)}
                                onUnpin={(noteId) => unpinNoteMutation.mutate(noteId)}
                                onDelete={(noteId) => deleteNoteMutation.mutate(noteId)}
                                onReact={(noteId, emoji) => reactToNoteMutation.mutate({ noteId, emoji })}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. De taak "{todo?.title}" wordt permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-button"
            >
              {deleteTodoMutation.isPending ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
