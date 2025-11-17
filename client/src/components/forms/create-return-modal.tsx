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
  editReturn?: any;
}

interface SelectedItemData {
  quantity: number;
  condition: string;
  notes?: string;
}

export function CreateReturnModal({ open, onOpenChange, customerId, orderId, onReturnCreated, editReturn }: CreateReturnModalProps) {
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
    defaultValues: editReturn ? {
      customerId: editReturn.customerId || "",
      orderId: editReturn.orderId || null,
      returnReason: editReturn.returnReason || "other" as const,
      otherReason: editReturn.otherReason || null,
      priority: editReturn.priority || "medium" as const,
      status: editReturn.status || "nieuw_onderweg" as const,
      trackingNumber: editReturn.trackingNumber || null,
      internalNotes: editReturn.internalNotes || null,
      customerNotes: editReturn.customerNotes || null,
      conditionNotes: editReturn.conditionNotes || null,
      refundAmount: editReturn.refundAmount || null,
      refundStatus: editReturn.refundStatus || "pending" as const,
      refundMethod: editReturn.refundMethod || null,
      shopifyRefundId: editReturn.shopifyRefundId || null,
      photos: editReturn.photos || null,
      assignedUserId: editReturn.assignedUserId || null,
      caseId: editReturn.caseId || null,
      requestedAt: undefined,
      receivedAt: editReturn.receivedAt || null,
      expectedReturnDate: editReturn.expectedReturnDate || null,
      completedAt: editReturn.completedAt || null,
    } : {
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
      
      if (editReturn) {
        const response = await apiRequest("PATCH", `/api/returns/${editReturn.id}`, returnData);
        const updatedReturn = await response.json();
        return updatedReturn;
      } else {
        const response = await apiRequest("POST", "/api/returns", returnData);
        const newReturn = await response.json();
        return newReturn;
      }
    },
    onSuccess: async (returnData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      
      toast({
        title: editReturn ? "Retour bijgewerkt" : "Retour aangemaakt",
        description: editReturn 
          ? `Retour "${returnData.returnNumber}" is succesvol bijgewerkt.`
          : `Retour "${returnData.returnNumber}" is succesvol aangemaakt${selectedItems.size > 0 ? ` met ${selectedItems.size} artikel(en)` : ''}.`,
      });
      
      onOpenChange(false);
      form.reset();
      setSelectedItems(new Map());
      
      // Instead of navigating, call the callback or open modal
      if (onReturnCreated) {
        onReturnCreated(returnData.id);
      }
    },
    onError: (error: any) => {
      toast({
        title: editReturn ? "Fout bij bijwerken retour" : "Fout bij aanmaken retour",
        description: error.message || `Er is een fout opgetreden bij het ${editReturn ? 'bijwerken' : 'aanmaken'} van de retour.`,
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
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col p-0" data-testid="create-return-modal">
        <DialogHeader className="px-6 pt-4 pb-3 flex-shrink-0">
          <DialogTitle className="text-lg">{editReturn ? 'Retour Bewerken' : 'Nieuwe Retour Aanmaken'}</DialogTitle>
          <DialogDescription className="text-sm">
            {editReturn ? 'Wijzig de retourinformatie' : 'Selecteer een bestelling en vul de retourinformatie in'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 pb-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Section 1: Order & Return Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bestelling & Details</h3>
                
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
                  <div className="p-2 bg-muted/50 rounded-md">
                    <div className="grid grid-cols-2 gap-2 text-xs">
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="trackingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Track & Trace</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Bijv. 3SABCD1234567890"
                            {...field}
                            value={field.value || ""}
                            data-testid="return-tracking-input"
                            className="h-9"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div></div>
                </div>

                <FormField
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Interne Notities</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Interne notities over deze retour..."
                          className="resize-none h-16"
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
              <Separator className="my-3" />

              {/* Section 2: Item Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Artikelen {!selectedOrderId && <span className="text-xs normal-case font-normal ml-2">(selecteer eerst bestelling)</span>}
                  </h3>
                  {selectedOrderId && orderLineItems.length > 0 && (
                    <Badge variant="outline">
                      {selectedItems.size} van {orderLineItems.length} geselecteerd
                    </Badge>
                  )}
                </div>

                {!selectedOrderId ? (
                  <div className="border rounded-md p-4 text-center text-muted-foreground bg-muted/30">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Selecteer een bestelling</p>
                  </div>
                ) : orderLineItems.length === 0 ? (
                  <div className="border rounded-md p-4 text-center text-muted-foreground text-sm">
                    <p>Geen artikelen gevonden</p>
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
                        className="h-8 text-xs"
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
                        className="h-8 text-xs"
                      >
                        Alles Deselecteren
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                      {orderLineItems.map((lineItem) => {
                        const isSelected = selectedItems.has(lineItem.id);
                        const itemData = selectedItems.get(lineItem.id);

                        return (
                          <div
                            key={lineItem.id}
                            className={cn(
                              "border rounded-md p-2 space-y-2 transition-colors",
                              isSelected ? "border-primary bg-primary/5" : "border-border"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleItemSelection(lineItem.id)}
                                data-testid={`checkbox-item-${lineItem.id}`}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{lineItem.title}</div>
                                {lineItem.variantTitle && (
                                  <div className="text-xs text-muted-foreground">{lineItem.variantTitle}</div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  SKU: {lineItem.sku || "N/A"} • {lineItem.quantity}x • €{parseFloat(lineItem.price).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            {isSelected && itemData && (
                              <div className="grid grid-cols-2 gap-2 pl-6">
                                <div>
                                  <label className="text-xs font-medium">Aantal</label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={lineItem.quantity}
                                    value={itemData.quantity}
                                    onChange={(e) => updateItemData(lineItem.id, "quantity", parseInt(e.target.value) || 1)}
                                    className="mt-1 h-8"
                                    data-testid={`input-quantity-${lineItem.id}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium">Conditie</label>
                                  <Select
                                    value={itemData.condition}
                                    onValueChange={(value) => updateItemData(lineItem.id, "condition", value)}
                                  >
                                    <SelectTrigger className="mt-1 h-8" data-testid={`select-condition-${lineItem.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unopened">Ongeopend</SelectItem>
                                      <SelectItem value="opened_unused">Geopend</SelectItem>
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
              <div className="flex justify-between gap-3 pt-3">
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
                    disabled={createReturnMutation.isPending || (!editReturn && !selectedOrderId)}
                    data-testid="button-create-return"
                  >
                    {createReturnMutation.isPending 
                      ? (editReturn ? "Bijwerken..." : "Aanmaken...") 
                      : editReturn
                        ? "Retour Bijwerken"
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
