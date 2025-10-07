import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { InternalNotes } from "@/components/notes/internal-notes";
import {
  Edit,
  Trash2,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  MessageSquare,
  Activity,
  Paperclip,
  Package,
  Wrench,
  Mail,
  UserCircle,
  Folder,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Todo, User as UserType, Order, Case, Repair, Customer } from "@/lib/types";
import { TodoForm } from "@/components/forms/todo-form";
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
  const { toast } = useToast();

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users/list"],
    enabled: !!todo,
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

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete todo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully",
      });
      onOpenChange(false);
      onUpdate?.();
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  });

  const handleDelete = () => {
    if (todo) {
      deleteTodoMutation.mutate(todo.id);
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "done":
        return "default";
      case "in_progress":
        return "secondary";
      case "todo":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "todo":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      orders: "Orders",
      purchasing: "Purchasing",
      marketing: "Marketing",
      admin: "Admin",
      other: "Other",
    };
    return labels[category] || category;
  };

  // Generate simple activity timeline from todo data
  const getActivityTimeline = () => {
    if (!todo) return [];

    const timeline = [];

    // Task created
    if (todo.createdAt) {
      timeline.push({
        icon: <FileText className="h-4 w-4" />,
        title: "Task created",
        description: `Task was created${getCreatedByUser() ? ` by ${getCreatedByUser()?.firstName} ${getCreatedByUser()?.lastName}` : ""}`,
        timestamp: todo.createdAt,
      });
    }

    // Task completed
    if (todo.completedAt) {
      timeline.push({
        icon: <CheckCircle className="h-4 w-4" />,
        title: "Task completed",
        description: "Task was marked as complete",
        timestamp: todo.completedAt,
      });
    }

    // Sort by timestamp descending (most recent first)
    return timeline.sort((a, b) => 
      new Date(b.timestamp as unknown as string).getTime() - new Date(a.timestamp as unknown as string).getTime()
    );
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="task-detail-modal">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl flex items-center gap-2" data-testid="task-title">
                  {todo ? (
                    <>
                      {getStatusIcon(todo.status || 'todo')}
                      {todo.title}
                    </>
                  ) : (
                    "Loading..."
                  )}
                </DialogTitle>
                {todo && (
                  <DialogDescription className="mt-2" data-testid="task-meta">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getStatusVariant(todo.status || 'todo')} data-testid="task-status-badge">
                        {(todo.status || 'todo').replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge variant={getPriorityVariant(todo.priority || 'medium')} data-testid="task-priority-badge">
                        {(todo.priority || 'medium').toUpperCase()}
                      </Badge>
                      {todo.category && (
                        <Badge variant="outline" data-testid="task-category-badge">
                          <Folder className="h-3 w-3 mr-1" />
                          {formatCategoryLabel(todo.category)}
                        </Badge>
                      )}
                    </div>
                  </DialogDescription>
                )}
              </div>
              {todo && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditForm(true)}
                    data-testid="edit-task-button"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    data-testid="delete-task-button"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {!todo ? (
            <div className="flex items-center justify-center py-12" data-testid="task-loading">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Loading task details...</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="details" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-4" data-testid="task-tabs">
                <TabsTrigger value="details" data-testid="details-tab">
                  <FileText className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="comments" data-testid="comments-tab">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Comments
                </TabsTrigger>
                <TabsTrigger value="activity" data-testid="activity-tab">
                  <Activity className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="attachments" data-testid="attachments-tab">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attachments
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4" data-testid="details-content">
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    {/* Description */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p className="mt-2 text-sm whitespace-pre-wrap" data-testid="task-description">
                        {todo.description || "No description provided"}
                      </p>
                    </div>

                    <Separator />

                    {/* Task Info Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Assigned To
                        </label>
                        <p className="mt-2 text-sm" data-testid="task-assigned-user">
                          {getAssignedUser() ? (
                            `${getAssignedUser()?.firstName} ${getAssignedUser()?.lastName}`
                          ) : (
                            "Unassigned"
                          )}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <UserCircle className="h-4 w-4" />
                          Created By
                        </label>
                        <p className="mt-2 text-sm" data-testid="task-created-by">
                          {getCreatedByUser() ? (
                            `${getCreatedByUser()?.firstName} ${getCreatedByUser()?.lastName}`
                          ) : (
                            "Unknown"
                          )}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Due Date
                        </label>
                        <p className="mt-2 text-sm" data-testid="task-due-date">
                          {todo.dueDate ? (
                            <>
                              {format(new Date(todo.dueDate), "PPP")}
                              <span className="text-muted-foreground ml-2">
                                ({formatDistanceToNow(new Date(todo.dueDate), { addSuffix: true })})
                              </span>
                            </>
                          ) : (
                            "No due date"
                          )}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Completion Date
                        </label>
                        <p className="mt-2 text-sm" data-testid="task-completed-at">
                          {todo.completedAt ? (
                            format(new Date(todo.completedAt), "PPP 'at' p")
                          ) : (
                            "Not completed"
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Linked Entities */}
                    {(linkedOrder || linkedCase || linkedRepair || linkedCustomer) && (
                      <>
                        <Separator />
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-3 block">
                            Linked Entities
                          </label>
                          <div className="space-y-2">
                            {linkedOrder && (
                              <div className="flex items-center gap-2 p-3 border rounded-lg" data-testid="linked-order">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">Order #{linkedOrder.orderNumber}</p>
                                  <p className="text-xs text-muted-foreground">{linkedOrder.customerEmail}</p>
                                </div>
                                <Badge variant="outline">{linkedOrder.status}</Badge>
                              </div>
                            )}

                            {linkedCase && (
                              <div className="flex items-center gap-2 p-3 border rounded-lg" data-testid="linked-case">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{linkedCase.title}</p>
                                  <p className="text-xs text-muted-foreground">Case #{linkedCase.caseNumber}</p>
                                </div>
                                <Badge variant="outline">{linkedCase.status}</Badge>
                              </div>
                            )}

                            {linkedRepair && (
                              <div className="flex items-center gap-2 p-3 border rounded-lg" data-testid="linked-repair">
                                <Wrench className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{linkedRepair.title}</p>
                                  <p className="text-xs text-muted-foreground">Repair</p>
                                </div>
                                <Badge variant="outline">{linkedRepair.status}</Badge>
                              </div>
                            )}

                            {linkedCustomer && (
                              <div className="flex items-center gap-2 p-3 border rounded-lg" data-testid="linked-customer">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    {linkedCustomer.firstName} {linkedCustomer.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{linkedCustomer.email}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="mt-4" data-testid="comments-content">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12" data-testid="no-comments">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Comments not yet available for tasks</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Task comments feature coming soon
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="mt-4" data-testid="activity-content">
                <Card>
                  <CardContent className="pt-6">
                    {getActivityTimeline().length > 0 ? (
                      <div className="space-y-4">
                        {getActivityTimeline().map((event, index) => (
                          <div key={index} className="flex items-start gap-4" data-testid={`activity-item-${index}`}>
                            <div className="mt-1 p-2 rounded-full bg-muted">
                              {event.icon}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{event.title}</p>
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(event.timestamp as unknown as string), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12" data-testid="no-activity">
                        <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4" data-testid="attachments-content">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12" data-testid="no-attachments">
                      <Paperclip className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No attachments available</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Attachment support coming soon
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task
              "{todo?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-button"
            >
              {deleteTodoMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
