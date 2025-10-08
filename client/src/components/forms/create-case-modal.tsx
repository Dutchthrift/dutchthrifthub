import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertCaseSchema } from "@shared/schema";
import type { EmailThread, User } from "@/lib/types";

interface ThreadWithMessages extends EmailThread {
  messages?: { body?: string | null; }[];
}
import { z } from "zod";

const createCaseFormSchema = insertCaseSchema.extend({
  assignedToId: z.string().optional(),
});

type CreateCaseFormValues = z.infer<typeof createCaseFormSchema>;

interface CreateCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailThread?: ThreadWithMessages;
}

export function CreateCaseModal({ open, onOpenChange, emailThread }: CreateCaseModalProps) {
  const { toast } = useToast();

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<CreateCaseFormValues>({
    resolver: zodResolver(createCaseFormSchema),
    defaultValues: {
      title: emailThread?.subject || "",
      description: emailThread?.messages?.[0]?.body || "",
      priority: "medium" as const,
      status: "new" as const,
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: CreateCaseFormValues) => {
      const caseData = {
        ...data,
        assignedToId: data.assignedToId || null,
      };
      
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseData),
      });
      
      if (!response.ok) throw new Error("Failed to create case");
      const newCase = await response.json();
      
      return newCase;
    },
    onSuccess: async (newCase) => {
      // Link the email thread to the case if provided
      if (emailThread?.id) {
        try {
          // Link the email thread to the case by updating the emailThread's caseId
          const linkResponse = await fetch(`/api/email-threads/${emailThread.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: newCase.id }),
          });
          
          if (!linkResponse.ok) throw new Error("Failed to link email thread to case");
        } catch (error) {
          console.error("Failed to link email thread to case:", error);
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
      
      toast({
        title: "Case aangemaakt",
        description: `Case "${newCase.title}" is succesvol aangemaakt.`,
      });
      
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij aanmaken case",
        description: error.message || "Er is een fout opgetreden bij het aanmaken van de case.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateCaseFormValues) => {
    createCaseMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="create-case-modal">
        <DialogHeader>
          <DialogTitle>Nieuwe Case Aanmaken</DialogTitle>
          <DialogDescription>
            Maak een nieuwe case aan om dit klantverzoek gestructureerd te beheren.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel van de Case</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Bijv. Reparatieverzoek iPhone"
                      {...field}
                      data-testid="case-title-input"
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
                    <FormLabel>Prioriteit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="case-priority-select">
                          <SelectValue placeholder="Selecteer prioriteit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Laag</SelectItem>
                        <SelectItem value="medium">Gemiddeld</SelectItem>
                        <SelectItem value="high">Hoog</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Toewijzen aan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="case-assignee-select">
                          <SelectValue placeholder="Selecteer teamlid" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {emailThread && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Klantgegevens</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>Email:</strong> {emailThread.customerEmail}
                </p>
                {emailThread.orderId && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Gekoppelde Order:</strong> {emailThread.orderId}
                  </p>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschrijving</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Beschrijf het probleem of verzoek..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ""}
                      data-testid="case-description-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="cancel-case-button"
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={createCaseMutation.isPending}
                data-testid="submit-case-button"
              >
                {createCaseMutation.isPending ? "Aanmaken..." : "Case Aanmaken"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}