import { useState, useEffect } from "react";
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
  Circle,
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
  Flag,
  Sparkles,
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

const STATUSES = [
  { value: 'todo', label: 'Te Doen', color: 'text-amber-500', emoji: '📋' },
  { value: 'in_progress', label: 'Bezig', color: 'text-blue-500', emoji: '🔄' },
  { value: 'done', label: 'Afgerond', color: 'text-emerald-500', emoji: '✅' },
];

const PRIORITY_CONFIG = {
  urgent: { color: 'bg-red-500', bgLight: 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30', borderColor: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', label: '🔴 Urgent' },
  high: { color: 'bg-orange-500', bgLight: 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30', borderColor: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', label: '🟠 Hoog' },
  medium: { color: 'bg-amber-500', bgLight: 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30', borderColor: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', label: '🟡 Normaal' },
  low: { color: 'bg-green-500', bgLight: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30', borderColor: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', label: '🟢 Laag' },
};

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  orders: { emoji: '📦', label: 'Orders', color: 'text-blue-600' },
  purchasing: { emoji: '🛒', label: 'Inkoop', color: 'text-purple-600' },
  marketing: { emoji: '📣', label: 'Marketing', color: 'text-pink-600' },
  admin: { emoji: '⚙️', label: 'Admin', color: 'text-slate-600' },
  other: { emoji: '📌', label: 'Overig', color: 'text-gray-600' },
};

export function TaskDetailModal({ todo, open, onOpenChange, onUpdate }: TaskDetailModalProps) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>(todo?.status || 'todo');
  const { toast } = useToast();

  // Sync local status with todo prop when it changes
  useEffect(() => {
    if (todo?.status) {
      setLocalStatus(todo.status);
    }
  }, [todo?.status]);

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
        title: "✅ Taak verwijderd",
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
      toast({ title: "✅ Taak bijgewerkt" });
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
      toast({ title: "✅ Notitie toegevoegd" });
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

  const handleStatusChange = (newStatus: string) => {
    if (todo) {
      // Optimistic update - update local state immediately
      setLocalStatus(newStatus);

      updateTodoMutation.mutate({
        id: todo.id,
        data: {
          status: newStatus as any,
          completedAt: newStatus === 'done' ? new Date().toISOString() : null,
        },
      });
    }
  };

  const getAssignedUser = () => {
    if (!todo || !users) return null;
    return users.find(u => u.id === todo.assignedUserId);
  };

  const getCreatedByUser = () => {
    if (!todo || !users) return null;
    return users.find(u => u.id === todo.createdBy);
  };

  const getStatusIndex = (status: string) => STATUSES.findIndex(s => s.value === status);

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

  const priorityConfig = PRIORITY_CONFIG[todo?.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const categoryConfig = CATEGORY_CONFIG[todo?.category || 'other'];
  const currentStatusIndex = getStatusIndex(localStatus);
  const pinnedNotes = notes.filter((note) => note.isPinned && !note.deletedAt);
  const unpinnedNotes = notes.filter((note) => !note.isPinned && !note.deletedAt);
  const hasLinkedEntities = linkedOrder || linkedCase || linkedRepair || linkedCustomer;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 [&>button]:hidden"
          data-testid="task-detail-modal"
        >
          {/* Header with gradient based on priority */}
          {todo && (
            <div className={`${priorityConfig.bgLight} ${priorityConfig.borderColor} px-5 pt-4 pb-3 border-b`}>
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
                        <Sparkles className="h-5 w-5 text-primary" />
                        <DialogTitle
                          className="text-xl font-semibold cursor-pointer hover:opacity-70"
                          onClick={handleStartEditTitle}
                        >
                          {todo.title}
                        </DialogTitle>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={`${priorityConfig.color} text-white text-xs`}>
                          <Flag className="h-3 w-3 mr-1" />
                          {priorityConfig.label.split(' ')[1]}
                        </Badge>
                        {categoryConfig && (
                          <Badge variant="secondary" className="text-xs">
                            <span className="mr-1">{categoryConfig.emoji}</span>
                            {categoryConfig.label}
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {/* Icon Buttons Group */}
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
                    onClick={() => setShowNotes(!showNotes)}
                    title="Notities"
                    className={`h-8 w-8 rounded-full ${showNotes ? 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' : 'text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
                  >
                    <MessageSquare className="h-4 w-4" />
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
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
            {!todo ? (
              <div className="flex items-center justify-center py-8" data-testid="task-loading">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                  <p className="text-sm text-muted-foreground">Laden...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Horizontal Status Timeline */}
                <div className="py-3 px-2">
                  <div className="flex items-center justify-center gap-0">
                    {STATUSES.map((status, idx) => {
                      const isCompleted = idx < currentStatusIndex;
                      const isCurrent = idx === currentStatusIndex;
                      return (
                        <div key={status.value} className="flex items-center">
                          <button
                            onClick={() => handleStatusChange(status.value)}
                            disabled={updateTodoMutation.isPending}
                            className={`flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-all px-4 py-1 rounded-lg ${isCurrent ? 'bg-muted/50' : 'hover:bg-muted/30'}`}
                          >
                            {isCompleted ? (
                              <CheckCircle className={`h-7 w-7 ${status.color}`} />
                            ) : isCurrent ? (
                              <div className={`h-7 w-7 rounded-full border-2 ${status.color} border-current flex items-center justify-center`}>
                                <div className={`h-3 w-3 rounded-full bg-current`} />
                              </div>
                            ) : (
                              <Circle className="h-7 w-7 text-gray-300 dark:text-gray-600" />
                            )}
                            <span className={`text-xs whitespace-nowrap ${isCurrent ? 'font-semibold ' + status.color : 'text-muted-foreground'}`}>
                              {status.emoji} {status.label}
                            </span>
                          </button>
                          {idx < STATUSES.length - 1 && (
                            <div className={`w-12 h-0.5 ${idx < currentStatusIndex ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Actions */}
                {users && (
                  <div className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-lg border">
                    <QuickActionsBar
                      todo={todo}
                      users={users}
                      onStatusChange={handleStatusChange}
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
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Description */}
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Folder className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Beschrijving</span>
                      </div>
                      {isEditingDescription ? (
                        <div className="space-y-2">
                          <textarea
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            className="w-full min-h-[60px] p-2 text-sm border rounded bg-background resize-none"
                            autoFocus
                            placeholder="Voeg een beschrijving toe..."
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveDescription} className="h-7 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Opslaan
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-7 text-xs">
                              Annuleren
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className="text-xs whitespace-pre-wrap cursor-pointer hover:bg-white/50 dark:hover:bg-black/20 rounded p-1.5 -m-1 transition-colors min-h-[40px]"
                          onClick={handleStartEditDescription}
                        >
                          {todo.description || <span className="text-muted-foreground italic">Klik om beschrijving toe te voegen...</span>}
                        </p>
                      )}
                    </div>

                    {/* Subtasks */}
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <ListTodo className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Subtaken</span>
                      </div>
                      <SubtasksSection todoId={todo.id} subtasks={subtasks} />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Details */}
                    <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Details</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Toegewezen aan
                          </span>
                          <span className="text-sm font-medium">
                            {getAssignedUser() ? `${getAssignedUser()?.firstName} ${getAssignedUser()?.lastName || ''}`.trim() : <span className="text-muted-foreground">Niemand</span>}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Deadline
                          </span>
                          <span className={`text-sm font-medium ${todo.dueDate && new Date(todo.dueDate) < new Date() && todo.status !== 'done' ? 'text-red-500' : ''}`}>
                            {todo.dueDate ? format(new Date(todo.dueDate), "d MMMM yyyy", { locale: nl }) : <span className="text-muted-foreground">Geen deadline</span>}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <UserCircle className="h-4 w-4" />
                            Aangemaakt door
                          </span>
                          <span className="text-sm font-medium">
                            {getCreatedByUser() ? `${getCreatedByUser()?.firstName} ${getCreatedByUser()?.lastName || ''}`.trim() : <span className="text-muted-foreground">Onbekend</span>}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Voltooid op
                          </span>
                          <span className="text-sm font-medium">
                            {todo.completedAt ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {format(new Date(todo.completedAt), "d MMMM yyyy", { locale: nl })}
                              </span>
                            ) : <span className="text-muted-foreground">Nog niet voltooid</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Linked Entities */}
                    {hasLinkedEntities && (
                      <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-2">
                          <ExternalLink className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Gekoppeld aan</span>
                        </div>
                        <div className="space-y-1.5">
                          {linkedOrder && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-7 text-xs"
                              onClick={() => window.location.href = `/orders/${linkedOrder.id}`}
                            >
                              <Package className="h-3.5 w-3.5 mr-2 text-blue-500" />
                              📦 Order {linkedOrder.orderNumber}
                            </Button>
                          )}
                          {linkedCase && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-7 text-xs"
                              onClick={() => window.location.href = `/cases/${linkedCase.id}`}
                            >
                              <Folder className="h-3.5 w-3.5 mr-2 text-purple-500" />
                              📁 Case #{linkedCase.caseNumber}
                            </Button>
                          )}
                          {linkedRepair && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-7 text-xs"
                              onClick={() => window.location.href = `/repairs/${linkedRepair.id}`}
                            >
                              <Wrench className="h-3.5 w-3.5 mr-2 text-orange-500" />
                              🔧 {linkedRepair.title}
                            </Button>
                          )}
                          {linkedCustomer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-7 text-xs"
                              onClick={() => window.location.href = `/customers/${linkedCustomer.id}`}
                            >
                              <UserCircle className="h-3.5 w-3.5 mr-2 text-green-500" />
                              👤 {linkedCustomer.firstName} {linkedCustomer.lastName}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Notes Section */}
                {showNotes && currentUser && (
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 rounded-lg border border-rose-200 dark:border-rose-800 space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-rose-600" />
                      <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                        Notities ({notes.filter(n => !n.deletedAt).length})
                      </span>
                    </div>

                    {/* Note Composer */}
                    <NoteComposer
                      onSubmit={(noteData) => createNoteMutation.mutate(noteData)}
                      isPending={createNoteMutation.isPending}
                      availableTags={availableTags}
                      placeholder="Schrijf een notitie..."
                    />

                    {/* Notes List */}
                    {notes.filter(n => !n.deletedAt).length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-40" />
                        <p>Nog geen notities</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
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
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Taak verwijderen?</AlertDialogTitle>
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
