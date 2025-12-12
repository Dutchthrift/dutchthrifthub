import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarIcon,
  CheckSquare,
  User,
  Flag,
  FolderOpen,
  Link2,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { InsertTodo, User as UserType } from "@shared/schema";

interface TodoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo?: any; // For editing existing todos
}

interface TodoFormData {
  title: string;
  description: string;
  category: "orders" | "purchasing" | "marketing" | "admin" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: Date | null;
  assignedUserId: string;
  orderId: string;
  caseId: string;
  customerId: string;
  repairId: string;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Laag", emoji: "🟢", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "medium", label: "Normaal", emoji: "🟡", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "high", label: "Hoog", emoji: "🟠", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "urgent", label: "Urgent", emoji: "🔴", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "orders", label: "Orders", emoji: "📦", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "purchasing", label: "Inkoop", emoji: "🛒", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "marketing", label: "Marketing", emoji: "📣", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  { value: "admin", label: "Admin", emoji: "⚙️", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "other", label: "Overig", emoji: "📌", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
] as const;

export function TodoForm({ open, onOpenChange, todo }: TodoFormProps) {
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showEntityLinks, setShowEntityLinks] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch users for assignment dropdown
  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users/list"],
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TodoFormData>({
    defaultValues: {
      title: "",
      description: "",
      category: "other",
      priority: "medium",
      dueDate: null,
      assignedUserId: user?.id || "",
      orderId: "",
      caseId: "",
      customerId: "",
      repairId: "",
    },
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (todo) {
      setValue("title", todo.title || "");
      setValue("description", todo.description || "");
      setValue("category", todo.category || "other");
      setValue("priority", todo.priority || "medium");
      setValue("assignedUserId", todo.assignedUserId || user?.id || "");
      setValue("orderId", todo.orderId || "");
      setValue("caseId", todo.caseId || "");
      setValue("customerId", todo.customerId || "");
      setValue("repairId", todo.repairId || "");

      // Set due date
      if (todo.dueDate) {
        const date = typeof todo.dueDate === 'string' ? new Date(todo.dueDate) : todo.dueDate;
        setDueDate(date);
      } else {
        setDueDate(null);
      }

      // Show entity links if any are set
      if (todo.orderId || todo.caseId || todo.customerId || todo.repairId) {
        setShowEntityLinks(true);
      }
    } else {
      // Reset form for new todo
      reset({
        title: "",
        description: "",
        category: "other",
        priority: "medium",
        assignedUserId: user?.id || "",
        orderId: "",
        caseId: "",
        customerId: "",
        repairId: "",
      });
      setDueDate(null);
      setShowEntityLinks(false);
    }
  }, [todo, setValue, reset, user]);

  const createTodoMutation = useMutation({
    mutationFn: async (data: InsertTodo) => {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create todo");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/todos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "✅ Taak aangemaakt",
        description: "Je taak is succesvol aangemaakt.",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Fout bij aanmaken",
        description: "Er is een fout opgetreden bij het aanmaken van de taak.",
        variant: "destructive",
      });
    }
  });

  const updateTodoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTodo> }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "✅ Taak bijgewerkt",
        description: "Je taak is succesvol bijgewerkt.",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Fout bij bijwerken",
        description: "Er is een fout opgetreden bij het bijwerken van de taak.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: TodoFormData) => {
    if (!user) {
      toast({
        title: "Authenticatie vereist",
        description: "Je moet ingelogd zijn om een taak aan te maken.",
        variant: "destructive",
      });
      return;
    }

    const todoData: InsertTodo = {
      title: data.title,
      description: data.description || undefined,
      category: data.category,
      priority: data.priority,
      assignedUserId: data.assignedUserId,
      createdBy: user.id,
      dueDate: dueDate?.toISOString(),
      orderId: data.orderId || undefined,
      caseId: data.caseId || undefined,
      customerId: data.customerId || undefined,
      repairId: data.repairId || undefined,
    };

    if (todo) {
      // Update existing todo
      updateTodoMutation.mutate({ id: todo.id, data: todoData });
    } else {
      // Create new todo
      createTodoMutation.mutate(todoData);
    }
  };

  const handleClose = () => {
    reset();
    setDueDate(null);
    setShowEntityLinks(false);
    onOpenChange(false);
  };

  const selectedPriority = PRIORITY_OPTIONS.find(p => p.value === watch("priority"));
  const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === watch("category"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin p-4" data-testid="todo-form-dialog">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            {todo ? "Taak Bewerken" : "Nieuwe Taak"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Titel *
            </Label>
            <Input
              id="title"
              placeholder="Wat moet er gedaan worden?"
              {...register("title", { required: "Titel is verplicht" })}
              className="h-9 text-sm"
              data-testid="todo-title-input"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium">Omschrijving</Label>
            <Textarea
              id="description"
              placeholder="Voeg details toe..."
              {...register("description")}
              className="text-sm min-h-[60px]"
              data-testid="todo-description-input"
            />
          </div>

          {/* Category and Priority - Visual Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3 text-blue-500" />
                Categorie
              </Label>
              <Select
                onValueChange={(value) => setValue("category", value as any)}
                value={watch("category")}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="todo-category-select">
                  <SelectValue>
                    {selectedCategory && (
                      <span className="flex items-center gap-2">
                        <span>{selectedCategory.emoji}</span>
                        <span>{selectedCategory.label}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      <span className="flex items-center gap-2">
                        <span>{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Flag className="h-3 w-3 text-orange-500" />
                Prioriteit
              </Label>
              <Select
                onValueChange={(value) => setValue("priority", value as any)}
                value={watch("priority")}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="todo-priority-select">
                  <SelectValue>
                    {selectedPriority && (
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${selectedPriority.value === 'urgent' ? 'bg-red-500' :
                            selectedPriority.value === 'high' ? 'bg-orange-500' :
                              selectedPriority.value === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                        <span>{selectedPriority.label}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${opt.value === 'urgent' ? 'bg-red-500' :
                            opt.value === 'high' ? 'bg-orange-500' :
                              opt.value === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                        <span>{opt.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned User and Due Date */}
          <div className="grid grid-cols-2 gap-3">
            {/* Assigned User */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <User className="h-3 w-3 text-purple-500" />
                Toegewezen aan
              </Label>
              <Select
                onValueChange={(value) => setValue("assignedUserId", value)}
                value={watch("assignedUserId")}
                disabled={usersLoading}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="todo-assigned-user-select">
                  <SelectValue placeholder="Selecteer..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-sm">
                      {u.firstName && u.lastName
                        ? `${u.firstName} ${u.lastName}`
                        : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <CalendarIcon className="h-3 w-3 text-green-500" />
                Deadline
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full h-9 text-sm justify-start font-normal"
                    data-testid="todo-due-date-trigger"
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {dueDate ? (
                      <span>{format(dueDate, "d MMM yyyy", { locale: nl })}</span>
                    ) : (
                      <span className="text-muted-foreground">Selecteer datum</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate || undefined}
                    onSelect={(date) => setDueDate(date || null)}
                    initialFocus
                    data-testid="todo-due-date-calendar"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Entity Linking Section - Collapsible */}
          <div className="pt-2 border-t">
            <button
              type="button"
              onClick={() => setShowEntityLinks(!showEntityLinks)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Link2 className="h-3 w-3" />
              <span>Koppel aan order, case, of reparatie</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                Optioneel
              </Badge>
            </button>

            {showEntityLinks && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-muted/30 rounded-lg border border-dashed">
                <div className="space-y-1.5">
                  <Label htmlFor="orderId" className="text-xs">📦 Order ID</Label>
                  <Input
                    id="orderId"
                    placeholder="Order ID..."
                    {...register("orderId")}
                    className="h-8 text-xs"
                    data-testid="todo-order-id-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="caseId" className="text-xs">📁 Case ID</Label>
                  <Input
                    id="caseId"
                    placeholder="Case ID..."
                    {...register("caseId")}
                    className="h-8 text-xs"
                    data-testid="todo-case-id-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customerId" className="text-xs">👤 Klant ID</Label>
                  <Input
                    id="customerId"
                    placeholder="Klant ID..."
                    {...register("customerId")}
                    className="h-8 text-xs"
                    data-testid="todo-customer-id-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="repairId" className="text-xs">🔧 Reparatie ID</Label>
                  <Input
                    id="repairId"
                    placeholder="Reparatie ID..."
                    {...register("repairId")}
                    className="h-8 text-xs"
                    data-testid="todo-repair-id-input"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="h-8 text-sm"
              data-testid="todo-cancel-button"
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createTodoMutation.isPending || updateTodoMutation.isPending}
              className="h-8 text-sm bg-primary hover:bg-primary/90"
              data-testid="todo-submit-button"
            >
              {(createTodoMutation.isPending || updateTodoMutation.isPending)
                ? (todo ? "Bijwerken..." : "Aanmaken...")
                : (todo ? "✓ Opslaan" : "✓ Taak Aanmaken")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
