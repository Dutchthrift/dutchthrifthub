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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertReturnSchema } from "@shared/schema";
import { z } from "zod";
import { Check, ChevronsUpDown, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const createReturnFormSchema = insertReturnSchema.extend({
  customerId: z.string().min(1, "Klant is verplicht"),
  orderId: z.string().optional().nullable(),
  returnReason: z.enum(["wrong_item", "damaged", "defective", "size_issue", "changed_mind", "other"]),
  otherReason: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  trackingNumber: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
}).refine((data) => {
  if (data.returnReason === "other" && !data.otherReason) {
    return false;
  }
  return true;
}, {
  message: "Specificeer de reden wanneer 'Anders' is geselecteerd",
  path: ["otherReason"],
});

type CreateReturnFormValues = z.infer<typeof createReturnFormSchema>;

interface CreateReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  orderId?: string;
  onReturnCreated?: (returnId: string) => void;
}

interface SelectedItemData {
  quantity: number;
  condition: string;
  notes?: string;
}

export function CreateReturnModal({ open, onOpenChange, customerId, orderId, onReturnCreated }: CreateReturnModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItemData>>(new Map());

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch specific order when orderId is preset
  const { data: presetOrder } = useQuery<any>({
    queryKey: ["/api/orders", orderId],
    enabled: !!orderId,
  });

  // Fetch orders with search query (or recent orders if no search)
  const { data: ordersData } = useQuery<{ orders: any[], total: number }>({
    queryKey: ["/api/orders", "paginated", orderSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "50",
      });
      
      if (orderSearchQuery) {
        params.append("search", orderSearchQuery);
      }
      
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
  });

  // Combine preset order with search results
  const orders = useMemo(() => {
    const ordersList = ordersData?.orders || [];
    
    if (presetOrder && !ordersList.find(o => o.id === presetOrder.id)) {
      return [presetOrder, ...ordersList];
    }
    
    return ordersList;
  }, [ordersData, presetOrder]);

  const form = useForm<CreateReturnFormValues>({
    resolver: zodResolver(createReturnFormSchema),
    defaultValues: {
      customerId: customerId || "",
      orderId: orderId || null,
      returnReason: "other" as const,
      otherReason: null,
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
    if (open && presetOrder && presetOrder.customerId) {
      form.setValue("customerId", presetOrder.customerId);
      form.setValue("orderId", presetOrder.id);
    }
  }, [open, presetOrder, form]);

  // Reset form and selections when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedItems(new Map());
      form.reset();
    }
  }, [open, form]);

  // Watch for return reason to show/hide other reason field
  const returnReason = form.watch("returnReason");

  // Get selected order and customer info
  const selectedOrderId = form.watch("orderId");
  const selectedOrder = orders?.find(o => o.id === selectedOrderId);
  const selectedCustomer = customers?.find(c => c.id === selectedOrder?.customerId);

  // Extract line items from selected order
  const orderLineItems = useMemo(() => {
    if (!selectedOrder || !selectedOrder.orderData) return [];
    const lineItems = (selectedOrder.orderData as any).line_items || [];
    return lineItems.map((item: any, index: number) => ({
      id: item.id?.toString() || item.sku || `${selectedOrder.id}-line-${index}`,
      title: item.title || "Unknown Product",
      sku: item.sku || "",
      variantTitle: item.variant_title || "",
      quantity: item.quantity || 1,
      price: item.price || "0",
    }));
  }, [selectedOrder]);

  // Handle order selection
  const handleOrderSelect = (orderId: string) => {
    const order = orders?.find(o => o.id === orderId);
    if (order) {
      // If changing order, reset item selections
      const currentOrderId = form.getValues("orderId");
      if (currentOrderId && currentOrderId !== orderId && selectedItems.size > 0) {
        if (confirm("Bestelling wijzigen zal geselecteerde artikelen wissen. Doorgaan?")) {
          setSelectedItems(new Map());
        } else {
          return;
        }
      }
      
      form.setValue("orderId", orderId);
      form.setValue("customerId", order.customerId || "");
    }
    setOrderSearchOpen(false);
  };

  const createReturnMutation = useMutation({
    mutationFn: async (data: CreateReturnFormValues & { items?: any[] }) => {
      const { items, ...returnFields } = data;
      
      const returnData = {
        ...returnFields,
        orderId: (returnFields.orderId && returnFields.orderId !== "none") ? returnFields.orderId : null,
        otherReason: returnFields.returnReason === "other" ? returnFields.otherReason : null,
        trackingNumber: returnFields.trackingNumber || null,
        internalNotes: returnFields.internalNotes || null,
        items: items || [],
      };
      
      const response = await apiRequest("POST", "/api/returns", returnData);
      const newReturn = await response.json();
      
      return newReturn;
    },
    onSuccess: async (newReturn) => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      
      toast({
        title: "Retour aangemaakt",
        description: `Retour "${newReturn.returnNumber}" is succesvol aangemaakt${selectedItems.size > 0 ? ` met ${selectedItems.size} artikel(en)` : ''}.`,
      });
      
      onOpenChange(false);
      form.reset();
      setSelectedItems(new Map());
      
      // Instead of navigating, call the callback or open modal
      if (onReturnCreated) {
        onReturnCreated(newReturn.id);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij aanmaken retour",
        description: error.message || "Er is een fout opgetreden bij het aanmaken van de retour.",
        variant: "destructive",
      });
    },
  });


  const handleFinalSubmit = (data: CreateReturnFormValues) => {
    // Convert selectedItems map to array format
    const items = Array.from(selectedItems.entries()).map(([itemId, itemData]) => {
      const lineItem = orderLineItems.find(li => li.id === itemId);
      return {
        sku: lineItem?.sku || "",
        productName: lineItem?.title || "",
        quantity: itemData.quantity,
        unitPrice: lineItem?.price ? Math.round(parseFloat(lineItem.price) * 100) : 0,
        condition: itemData.condition,
        imageUrl: null,
        restockable: itemData.condition === "unopened",
      };
    });

    createReturnMutation.mutate({ ...data, items });
  };

  const onSubmit = (data: CreateReturnFormValues) => {
    // Always submit with current item selection (empty array if no items selected)
    handleFinalSubmit(data);
  };

  const toggleItemSelection = (itemId: string) => {
    const newMap = new Map(selectedItems);
    if (newMap.has(itemId)) {
      newMap.delete(itemId);
    } else {
      const lineItem = orderLineItems.find(li => li.id === itemId);
      newMap.set(itemId, {
        quantity: 1,
        condition: "unopened",
      });
    }
    setSelectedItems(newMap);
  };

  const updateItemData = (itemId: string, field: keyof SelectedItemData, value: any) => {
    const newMap = new Map(selectedItems);
    const itemData = newMap.get(itemId);
    if (itemData) {
      newMap.set(itemId, { ...itemData, [field]: value });
      setSelectedItems(newMap);
    }
  };

  const selectAllItems = () => {
    const newMap = new Map<string, SelectedItemData>();
    orderLineItems.forEach(item => {
      newMap.set(item.id, {
        quantity: 1,
        condition: "unopened",
      });
    });
    setSelectedItems(newMap);
  };

  const deselectAllItems = () => {
    setSelectedItems(new Map());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col" data-testid="create-return-modal">
        <DialogHeader>
          <DialogTitle>Nieuwe Retour Aanmaken</DialogTitle>
          <DialogDescription>
            Selecteer een bestelling en vul de retourinformatie in. Kies optioneel specifieke artikelen om te retourneren.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Section 1: Order & Return Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Bestelling & Retour Details</h3>
                
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
                        <PopoverContent className="w-[600px] p-0" data-testid="order-search-popover">
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
                                {orders.map((order) => (
                                  <CommandItem
                                    key={order.id}
                                    value={`${order.orderNumber} ${order.customerEmail} ${order.shopifyOrderId || ''}`}
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

                {returnReason === "other" && (
                  <FormField
                    control={form.control}
                    name="otherReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specificeer reden *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Bijv. Verkeerde kleur besteld"
                            {...field}
                            value={field.value || ""}
                            data-testid="return-other-reason-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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

              </div>

              {/* Separator */}
              <Separator className="my-6" />

              {/* Section 2: Item Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground">Artikelen uit Bestelling</h3>
                    {!selectedOrderId && (
                      <p className="text-xs text-muted-foreground mt-1">Selecteer eerst een bestelling om artikelen te zien</p>
                    )}
                  </div>
                  {selectedOrderId && orderLineItems.length > 0 && (
                    <Badge variant="outline">
                      {selectedItems.size} van {orderLineItems.length} geselecteerd
                    </Badge>
                  )}
                </div>

                {!selectedOrderId ? (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground bg-muted/30">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Selecteer een bestelling om artikelen te selecteren</p>
                  </div>
                ) : orderLineItems.length === 0 ? (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <p>Geen artikelen gevonden in deze bestelling</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllItems}
                        disabled={!selectedOrderId}
                        data-testid="button-select-all"
                      >
                        Alles Selecteren
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={deselectAllItems}
                        disabled={!selectedOrderId || selectedItems.size === 0}
                        data-testid="button-deselect-all"
                      >
                        Alles Deselecteren
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                      {orderLineItems.map((lineItem) => {
                        const isSelected = selectedItems.has(lineItem.id);
                        const itemData = selectedItems.get(lineItem.id);

                        return (
                          <div
                            key={lineItem.id}
                            className={cn(
                              "border rounded-lg p-4 space-y-3 transition-colors",
                              isSelected ? "border-primary bg-primary/5" : "border-border"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleItemSelection(lineItem.id)}
                                data-testid={`checkbox-item-${lineItem.id}`}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{lineItem.title}</div>
                                {lineItem.variantTitle && (
                                  <div className="text-sm text-muted-foreground">{lineItem.variantTitle}</div>
                                )}
                                <div className="text-sm text-muted-foreground">
                                  SKU: {lineItem.sku || "N/A"} • Besteld: {lineItem.quantity} • €{parseFloat(lineItem.price).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            {isSelected && itemData && (
                              <div className="grid grid-cols-2 gap-3 pl-8">
                                <div>
                                  <label className="text-sm font-medium">Aantal Retour</label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={lineItem.quantity}
                                    value={itemData.quantity}
                                    onChange={(e) => updateItemData(lineItem.id, "quantity", parseInt(e.target.value) || 1)}
                                    className="mt-1"
                                    data-testid={`input-quantity-${lineItem.id}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Conditie *</label>
                                  <Select
                                    value={itemData.condition}
                                    onValueChange={(value) => updateItemData(lineItem.id, "condition", value)}
                                  >
                                    <SelectTrigger className="mt-1" data-testid={`select-condition-${lineItem.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unopened">Ongeopend</SelectItem>
                                      <SelectItem value="opened_unused">Geopend, Ongebruikt</SelectItem>
                                      <SelectItem value="used">Gebruikt</SelectItem>
                                      <SelectItem value="damaged">Beschadigd</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex justify-between gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={createReturnMutation.isPending}
                  data-testid="button-cancel-return"
                >
                  Annuleren
                </Button>
                <div className="flex gap-2">
                  {selectedOrderId && orderLineItems.length > 0 && selectedItems.size === 0 && (
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={createReturnMutation.isPending}
                      data-testid="button-skip-items"
                    >
                      Zonder Artikelen
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={createReturnMutation.isPending || !selectedOrderId}
                    data-testid="button-create-return"
                  >
                    {createReturnMutation.isPending 
                      ? "Aanmaken..." 
                      : selectedItems.size > 0 
                        ? `Retour Aanmaken (${selectedItems.size} ${selectedItems.size === 1 ? 'artikel' : 'artikelen'})`
                        : "Retour Aanmaken"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
