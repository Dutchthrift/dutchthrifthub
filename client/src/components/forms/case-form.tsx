import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCaseSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertCase } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface CaseFormProps {
  onSuccess?: () => void;
  caseData?: any; // For editing existing cases
}

interface CaseFormData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  customerEmail: string;
  slaDeadline: Date | null;
}

export function CaseForm({ onSuccess, caseData }: CaseFormProps) {
  const [slaDeadline, setSlaDeadline] = useState<Date | null>(
    caseData?.slaDeadline ? new Date(caseData.slaDeadline) : null
  );
  const { toast } = useToast();

  const form = useForm<CaseFormData>({
    resolver: zodResolver(insertCaseSchema.extend({
      slaDeadline: insertCaseSchema.shape.slaDeadline,
    })),
    defaultValues: {
      title: caseData?.title || "",
      description: caseData?.description || "",
      priority: caseData?.priority || "medium",
      customerEmail: caseData?.customerEmail || "",
      slaDeadline: caseData?.slaDeadline ? new Date(caseData.slaDeadline) : null,
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: InsertCase) => {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case created",
        description: "New case has been created successfully",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Create failed",
        description: "Failed to create case. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCase> }) => {
      const response = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case updated",
        description: "Case has been updated successfully",
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update case. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: CaseFormData) => {
    const submitData: InsertCase = {
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      customerEmail: data.customerEmail,
      slaDeadline: data.slaDeadline ? data.slaDeadline.toISOString() : null,
    };

    if (caseData?.id) {
      updateCaseMutation.mutate({ id: caseData.id, data: submitData });
    } else {
      createCaseMutation.mutate(submitData);
    }
  };

  const isLoading = createCaseMutation.isPending || updateCaseMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="case-form">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Case title" 
                  {...field} 
                  data-testid="case-title-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the case details..."
                  rows={4}
                  {...field}
                  data-testid="case-description-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="case-priority-select">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="customerEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    {...field}
                    data-testid="case-customer-email-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="slaDeadline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SLA Deadline (optional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full pl-3 text-left font-normal"
                      data-testid="case-sla-deadline-trigger"
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value || undefined}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            data-testid="submit-case-button"
          >
            {isLoading ? "Saving..." : caseData ? "Update Case" : "Create Case"}
          </Button>
        </div>
      </form>
    </Form>
  );
}