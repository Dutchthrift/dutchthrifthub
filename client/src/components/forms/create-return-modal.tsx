import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { insertReturnSchema } from "@shared/schema";
import { z } from "zod";

const createReturnFormSchema = insertReturnSchema.extend({
  customerId: z.string().min(1, "Klant is verplicht"),
  orderId: z.string().optional().nullable(),
  returnReason: z.enum(["wrong_item", "damaged", "defective", "size_issue", "changed_mind", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  trackingNumber: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

type CreateReturnFormValues = z.infer<typeof createReturnFormSchema>;

interface CreateReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  orderId?: string;
}

export function CreateReturnModal({ open, onOpenChange, customerId, orderId }: CreateReturnModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  const { data: orders } = useQuery<any[]>({
    queryKey: ["/api/orders"],
  });

  const form = useForm<CreateReturnFormValues>({
    resolver: zodResolver(createReturnFormSchema),
    defaultValues: {
      customerId: customerId || "",
      orderId: orderId || null,
      returnReason: "other" as const,
      priority: "medium" as const,
      status: "nieuw_onderweg" as const,
      trackingNumber: null,
      internalNotes: null,
      customerNotes: null,
      conditionNotes: null,
      refundAmount: null,
      refundStatus: "pending" as const,
      refundMethod: null,
      shopifyRefundId: null,
      photos: null,
      assignedUserId: null,
      caseId: null,
      requestedAt: undefined,
      receivedAt: null,
      expectedReturnDate: null,
      completedAt: null,
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (data: CreateReturnFormValues) => {
      const returnData = {
        ...data,
        orderId: (data.orderId && data.orderId !== "none") ? data.orderId : null,
        trackingNumber: data.trackingNumber || null,
        internalNotes: data.internalNotes || null,
      };
      
      const response = await apiRequest("POST", "/api/returns", returnData);
      const newReturn = await response.json();
      
      return newReturn;
    },
    onSuccess: async (newReturn) => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      
      toast({
        title: "Retour aangemaakt",
        description: `Retour "${newReturn.returnNumber}" is succesvol aangemaakt. U kunt nu artikelen toevoegen.`,
      });
      
      onOpenChange(false);
      form.reset();
      
      setLocation(`/returns/${newReturn.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij aanmaken retour",
        description: error.message || "Er is een fout opgetreden bij het aanmaken van de retour.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateReturnFormValues) => {
    createReturnMutation.mutate(data);
  };

  const selectedCustomer = customers?.find(c => c.id === form.watch("customerId"));
  const customerOrders = orders?.filter(o => o.customerId === form.watch("customerId")) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="create-return-modal">
        <DialogHeader>
          <DialogTitle>Nieuwe Retour Aanmaken</DialogTitle>
          <DialogDescription>
            Maak een nieuwe retour aan. U kunt artikelen toevoegen op de detailpagina.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Klant *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="return-customer-select">
                        <SelectValue placeholder="Selecteer klant..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName} ({customer.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bestelling (Optioneel)</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                    disabled={!form.watch("customerId")}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="return-order-select">
                        <SelectValue placeholder={
                          form.watch("customerId") 
                            ? "Selecteer bestelling..." 
                            : "Selecteer eerst een klant"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Geen bestelling</SelectItem>
                      {customerOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.shopifyOrderNumber || order.id} - €{(order.totalPrice / 100).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="returnReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reden *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="return-reason-select">
                          <SelectValue placeholder="Selecteer reden" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="wrong_item">Verkeerd artikel</SelectItem>
                        <SelectItem value="damaged">Beschadigd</SelectItem>
                        <SelectItem value="defective">Defect</SelectItem>
                        <SelectItem value="size_issue">Maat probleem</SelectItem>
                        <SelectItem value="changed_mind">Bedacht</SelectItem>
                        <SelectItem value="other">Anders</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioriteit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="return-priority-select">
                          <SelectValue placeholder="Selecteer prioriteit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Laag</SelectItem>
                        <SelectItem value="medium">Normaal</SelectItem>
                        <SelectItem value="high">Hoog</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="trackingNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Track & Trace (Optioneel)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Bijv. 3SABCD1234567890"
                      {...field}
                      value={field.value || ""}
                      data-testid="return-tracking-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interne Notities (Optioneel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Interne notities over deze retour..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                      data-testid="return-notes-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createReturnMutation.isPending}
                data-testid="button-cancel-return"
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={createReturnMutation.isPending}
                data-testid="button-create-return"
              >
                {createReturnMutation.isPending ? "Aanmaken..." : "Retour Aanmaken"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
