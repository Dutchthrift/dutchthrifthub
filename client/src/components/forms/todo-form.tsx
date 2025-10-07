import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { InsertTodo, User } from "@shared/schema";

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

export function TodoForm({ open, onOpenChange, todo }: TodoFormProps) {
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch users for assignment dropdown
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
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
        title: "Todo created",
        description: "Your todo has been created successfully",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Failed to create todo",
        description: "There was an error creating your todo",
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
        title: "Todo updated",
        description: "Your todo has been updated successfully",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Failed to update todo",
        description: "There was an error updating your todo",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: TodoFormData) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create a todo",
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="todo-form-dialog">
        <DialogHeader>
          <DialogTitle>{todo ? "Edit Todo" : "Create New Todo"}</DialogTitle>
          <DialogDescription>
            {todo ? "Update your todo details below." : "Add a new task to your todo list."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter todo title..."
              {...register("title", { required: "Title is required" })}
              data-testid="todo-title-input"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description..."
              {...register("description")}
              data-testid="todo-description-input"
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select 
                onValueChange={(value) => setValue("category", value as any)}
                value={watch("category")}
              >
                <SelectTrigger data-testid="todo-category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="purchasing">Purchasing</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                onValueChange={(value) => setValue("priority", value as any)}
                value={watch("priority")}
              >
                <SelectTrigger data-testid="todo-priority-select">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned User and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assigned To *</Label>
              <Select 
                onValueChange={(value) => setValue("assignedUserId", value)}
                value={watch("assignedUserId")}
                disabled={usersLoading}
              >
                <SelectTrigger data-testid="todo-assigned-user-select">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="todo-due-date-trigger"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
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

          {/* Entity Linking Section */}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-semibold">Entity Linking (Optional)</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderId">Order ID</Label>
                <Input
                  id="orderId"
                  placeholder="Enter order ID..."
                  {...register("orderId")}
                  data-testid="todo-order-id-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caseId">Case ID</Label>
                <Input
                  id="caseId"
                  placeholder="Enter case ID..."
                  {...register("caseId")}
                  data-testid="todo-case-id-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerId">Customer ID</Label>
                <Input
                  id="customerId"
                  placeholder="Enter customer ID..."
                  {...register("customerId")}
                  data-testid="todo-customer-id-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="repairId">Repair ID</Label>
                <Input
                  id="repairId"
                  placeholder="Enter repair ID..."
                  {...register("repairId")}
                  data-testid="todo-repair-id-input"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              data-testid="todo-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTodoMutation.isPending || updateTodoMutation.isPending}
              data-testid="todo-submit-button"
            >
              {(createTodoMutation.isPending || updateTodoMutation.isPending) 
                ? (todo ? "Updating..." : "Creating...") 
                : (todo ? "Save Changes" : "Create Todo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
