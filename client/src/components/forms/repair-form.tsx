import { useState } from "react";
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
import { CalendarIcon, Upload } from "lucide-react";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertRepair } from "@shared/schema";

interface RepairFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair?: any; // For editing existing repairs
}

interface RepairFormData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  estimatedCost: number;
  partsNeeded: string;
  slaDeadline: Date | null;
  assignedUserId: string;
}

export function RepairForm({ open, onOpenChange, repair }: RepairFormProps) {
  const [slaDeadline, setSlaDeadline] = useState<Date | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RepairFormData>({
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      estimatedCost: 0,
      partsNeeded: "",
      slaDeadline: null,
      assignedUserId: "current-user", // In a real app, get from auth context
    },
  });

  const createRepairMutation = useMutation({
    mutationFn: async (data: InsertRepair) => {
      const response = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create repair");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Repair created",
        description: "Repair request has been created successfully",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Failed to create repair",
        description: "There was an error creating the repair request",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: RepairFormData) => {
    const repairData: InsertRepair = {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      estimatedCost: Math.round(data.estimatedCost * 100), // Convert to cents
      partsNeeded: data.partsNeeded ? [data.partsNeeded] : undefined,
      assignedUserId: data.assignedUserId,
      slaDeadline: slaDeadline,
    };

    createRepairMutation.mutate(repairData);
  };

  const handleClose = () => {
    reset();
    setSlaDeadline(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="repair-form-dialog">
        <DialogHeader>
          <DialogTitle>{repair ? "Edit Repair" : "Create New Repair"}</DialogTitle>
          <DialogDescription>
            {repair ? "Update the repair details below." : "Create a new repair request."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Canon EOS R5 sensor cleaning"
              {...register("title", { required: "Title is required" })}
              data-testid="repair-title-input"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the repair issue and requirements..."
              {...register("description")}
              data-testid="repair-description-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                onValueChange={(value) => setValue("priority", value as any)}
                defaultValue="medium"
              >
                <SelectTrigger data-testid="repair-priority-select">
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

            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Estimated Cost (€)</Label>
              <Input
                id="estimatedCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("estimatedCost", { 
                  valueAsNumber: true,
                  min: { value: 0, message: "Cost must be positive" }
                })}
                data-testid="repair-cost-input"
              />
              {errors.estimatedCost && (
                <p className="text-sm text-destructive">{errors.estimatedCost.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partsNeeded">Parts Needed</Label>
            <Input
              id="partsNeeded"
              placeholder="List required parts..."
              {...register("partsNeeded")}
              data-testid="repair-parts-input"
            />
          </div>

          <div className="space-y-2">
            <Label>SLA Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="repair-deadline-trigger"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {slaDeadline ? format(slaDeadline, "PPP") : "Set deadline"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={slaDeadline || undefined}
                  onSelect={(date) => setSlaDeadline(date || null)}
                  initialFocus
                  data-testid="repair-deadline-calendar"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Photos/Attachments</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop photos here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, PDF up to 10MB each
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              data-testid="repair-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createRepairMutation.isPending}
              data-testid="repair-submit-button"
            >
              {createRepairMutation.isPending ? "Creating..." : "Create Repair"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
