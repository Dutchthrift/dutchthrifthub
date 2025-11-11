import { useState, useMemo, useEffect } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertReturnSchema } from "@shared/schema";
import { z } from "zod";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

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

  // Populate customerId when modal opens with preset orderId
  useEffect(() => {
    if (open && orderId && orders) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.customerId) {
        form.setValue("customerId", order.customerId);
      }
    }
  }, [open, orderId, orders, form]);

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

  // Filter orders by search query
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!orderSearchQuery) return orders;
    
    const query = orderSearchQuery.toLowerCase();
    return orders.filter((order) => 
      order.orderNumber?.toLowerCase().includes(query) ||
      order.shopifyOrderId?.toLowerCase().includes(query) ||
      order.customerEmail?.toLowerCase().includes(query)
    );
  }, [orders, orderSearchQuery]);

  // Get selected order and customer info
  const selectedOrderId = form.watch("orderId");
  const selectedOrder = orders?.find(o => o.id === selectedOrderId);
  const selectedCustomer = customers?.find(c => c.id === selectedOrder?.customerId);

  // Handle order selection
  const handleOrderSelect = (orderId: string) => {
    const order = orders?.find(o => o.id === orderId);
    if (order) {
      form.setValue("orderId", orderId);
      form.setValue("customerId", order.customerId || "");
    }
    setOrderSearchOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="create-return-modal">
        <DialogHeader>
          <DialogTitle>Nieuwe Retour Aanmaken</DialogTitle>
          <DialogDescription>
            Zoek een bestelling om een retour aan te maken. U kunt artikelen toevoegen op de detailpagina.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Order Search */}
            <FormField
              control={form.control}
              name="orderId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Bestelling *</FormLabel>
                  <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="order-search-button"
                        >
                          {field.value && selectedOrder
                            ? `${selectedOrder.orderNumber} - €${(selectedOrder.totalAmount / 100).toFixed(2)}`
                            : "Zoek bestelling..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[460px] p-0" data-testid="order-search-popover">
                      <Command>
                        <CommandInput 
                          placeholder="Zoek op bestelnummer of email..." 
                          value={orderSearchQuery}
                          onValueChange={setOrderSearchQuery}
                          data-testid="order-search-input"
                        />
                        <CommandList>
                          <CommandEmpty>Geen bestellingen gevonden.</CommandEmpty>
                          <CommandGroup>
                            {filteredOrders.slice(0, 50).map((order) => (
                              <CommandItem
                                key={order.id}
                                value={order.id}
                                onSelect={() => handleOrderSelect(order.id)}
                                data-testid={`order-option-${order.id}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === order.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-mono font-medium">
                                      {order.orderNumber}
                                    </span>
                                    <Badge variant="outline" className="ml-auto">
                                      €{(order.totalAmount / 100).toFixed(2)}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {order.customerEmail}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show customer info when order is selected */}
            {selectedOrder && selectedCustomer && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="text-sm font-medium">Klantinformatie</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Naam:</span>{" "}
                    <span className="font-medium">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium">{selectedCustomer.email}</span>
                  </div>
                </div>
              </div>
            )}

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
                disabled={createReturnMutation.isPending || !selectedOrder}
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
