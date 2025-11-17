import { useState, useMemo, useEffect } from "react";
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
import { insertCaseSchema } from "@shared/schema";
import { z } from "zod";
import { Check, ChevronsUpDown, Package, Mail, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShopifyLineItem {
  id: string;
  title: string;
  sku: string;
  variantTitle?: string;
  quantity: number;
  price?: string;
}

interface SelectedItemData {
  quantity: number;
  itemNotes: string;
}

const createCaseFormSchema = insertCaseSchema.extend({
  assignedUserId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
});

type CreateCaseFormValues = z.infer<typeof createCaseFormSchema>;

interface CreateCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailThread?: any;
}

export function CreateCaseModal({ open, onOpenChange, emailThread }: CreateCaseModalProps) {
  const { toast } = useToast();
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItemData>>(new Map());

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch orders with search query
  const { data: ordersData } = useQuery<{ orders: any[], total: number }>({
    queryKey: ["/api/orders", 1, 50, orderSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "50",
      });
      
      if (orderSearchQuery) {
        params.append("search", orderSearchQuery);
      }
      
      const response = await fetch(`/api/orders?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
  });

  const form = useForm<CreateCaseFormValues>({
    resolver: zodResolver(createCaseFormSchema),
    defaultValues: {
      title: emailThread?.subject || "",
      description: emailThread ? `Case aangemaakt van email thread: ${emailThread.subject}` : "",
      priority: "medium",
      status: "new",
      customerId: emailThread?.customerId || null,
      customerEmail: emailThread?.customerEmail || null,
      assignedUserId: null,
      orderId: null,
    },
  });

  // Reset form and selections when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedItems(new Map());
      form.reset();
    }
  }, [open, form]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="order-search-input"]') && 
          !target.closest('[data-testid="order-search-dropdown"]')) {
        setOrderSearchOpen(false);
      }
    };

    if (orderSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [orderSearchOpen]);

  // Watch for selected order ID to fetch it separately
  const selectedOrderId = form.watch("orderId");

  // Fetch specific order when one is selected
  const { data: selectedOrderData } = useQuery<any>({
    queryKey: ["/api/orders", selectedOrderId],
    enabled: !!selectedOrderId,
  });

  // Combine selected order with search results to ensure it's always available
  const orders = useMemo(() => {
    const ordersList = ordersData?.orders || [];
    
    if (selectedOrderData && !ordersList.find((o: any) => o.id === selectedOrderData.id)) {
      return [selectedOrderData, ...ordersList];
    }
    
    return ordersList;
  }, [ordersData, selectedOrderData]);

  // Get selected order and customer info
  const selectedOrder = orders?.find((o: any) => o.id === selectedOrderId);
  const selectedCustomerId = form.watch("customerId");
  const selectedCustomer = customers?.find((c: any) => c.id === selectedCustomerId);

  // Extract line items from selected order
  const orderLineItems = useMemo(() => {
    if (!selectedOrder || !selectedOrder.orderData) return [];
    const lineItems = (selectedOrder.orderData as any).line_items || [];
    return lineItems.map((item: any, index: number): ShopifyLineItem => ({
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
    const order = orders?.find((o: any) => o.id === orderId);
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
      form.setValue("customerId", order.customerId || null);
      form.setValue("customerEmail", order.customerEmail || null);
    }
    setOrderSearchOpen(false);
  };

  const createCaseMutation = useMutation({
    mutationFn: async (data: CreateCaseFormValues & { items?: any[] }) => {
      const { items, ...caseFields } = data;
      
      const caseData = {
        ...caseFields,
        orderId: (caseFields.orderId && caseFields.orderId !== "none") ? caseFields.orderId : null,
        assignedUserId: caseFields.assignedUserId || null,
        items: items || [],
      };
      
      const response = await apiRequest("POST", "/api/cases", caseData);
      const newCase = await response.json();
      
      return newCase;
    },
    onSuccess: async (newCase) => {
      // Link email thread if provided
      if (emailThread?.id) {
        try {
          await apiRequest("PATCH", `/api/email-threads/${emailThread.id}`, { caseId: newCase.id });
        } catch (error) {
          console.error("Failed to link email thread to case:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-threads"] });
      
      toast({
        title: "Case aangemaakt",
        description: `Case "${newCase.title}" (${newCase.caseNumber}) is succesvol aangemaakt${selectedItems.size > 0 ? ` met ${selectedItems.size} artikel(en)` : ''}.`,
      });
      
      onOpenChange(false);
      form.reset();
      setSelectedItems(new Map());
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij aanmaken case",
        description: error.message || "Er is een fout opgetreden bij het aanmaken van de case.",
        variant: "destructive",
      });
    },
  });

  const handleFinalSubmit = (data: CreateCaseFormValues) => {
    // Convert selectedItems map to array format
    const items = Array.from(selectedItems.entries()).map(([itemId, itemData]) => {
      const lineItem = orderLineItems.find((li: ShopifyLineItem) => li.id === itemId);
      return {
        sku: lineItem?.sku || "",
        productName: lineItem?.title || "",
        quantity: itemData.quantity,
        itemNotes: itemData.itemNotes || "",
      };
    });

    createCaseMutation.mutate({ ...data, items });
  };

  const onSubmit = (data: CreateCaseFormValues) => {
    handleFinalSubmit(data);
  };

  const toggleItemSelection = (itemId: string, checked: boolean) => {
    const newMap = new Map(selectedItems);
    if (checked) {
      newMap.set(itemId, {
        quantity: 1,
        itemNotes: "",
      });
    } else {
      newMap.delete(itemId);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="create-case-dialog">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            Nieuwe Case Aanmaken
          </DialogTitle>
          <DialogDescription>
            Maak een nieuwe case aan om dit klantverzoek gestructureerd te beheren.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Basis Informatie</h3>
              
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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschrijving</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Beschrijf de case..."
                        {...field}
                        value={field.value || ""}
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
                      <FormLabel>Prioriteit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "medium"}>
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
                  name="assignedUserId"
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
                          {users?.map((user: any) => (
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
            </div>

            <Separator />

            {/* Order Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Bestelling Koppelen (Optioneel)</h3>
                <Badge variant="secondary" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  Optioneel
                </Badge>
              </div>

              <FormField
                control={form.control}
                name="orderId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Zoek Bestelling</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="Zoek op ordernummer, naam, email..."
                          value={orderSearchQuery}
                          onChange={(e) => {
                            setOrderSearchQuery(e.target.value);
                            if (e.target.value.length > 0) {
                              setOrderSearchOpen(true);
                            }
                          }}
                          onFocus={() => {
                            if (orderSearchQuery.length > 0) {
                              setOrderSearchOpen(true);
                            }
                          }}
                          data-testid="order-search-input"
                          className="pr-10"
                        />
                      </FormControl>
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      
                      {orderSearchOpen && (
                        <div 
                          className="absolute z-[100] w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto"
                          data-testid="order-search-dropdown"
                        >
                          {orders.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              Geen bestellingen gevonden.
                            </div>
                          ) : (
                            <div className="p-1">
                              {orders.map((order: any) => (
                                <div
                                  key={order.id}
                                  onClick={() => {
                                    handleOrderSelect(order.id);
                                    setOrderSearchOpen(false);
                                  }}
                                  className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                    field.value === order.id && "bg-accent"
                                  )}
                                  data-testid={`order-option-${order.orderNumber}`}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === order.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium">#{order.orderNumber}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {order.customerEmail} • €{(order.totalAmount / 100).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedOrder && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Geselecteerd: #{selectedOrder.orderNumber} - €{(selectedOrder.totalAmount / 100).toFixed(2)}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedOrder && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Bestelling #{selectedOrder.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedOrder.customerEmail}
                      </p>
                    </div>
                    <Badge variant="outline">{selectedOrder.status}</Badge>
                  </div>

                  {selectedCustomer && (
                    <div className="space-y-1 text-sm">
                      <p><strong>Klant:</strong> {selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                      {selectedCustomer.phone && (
                        <p><strong>Telefoon:</strong> {selectedCustomer.phone}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Totaal: <strong>€{(selectedOrder.totalAmount / 100).toFixed(2)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Datum: {new Date(selectedOrder.orderDate).toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Item Selection */}
            {selectedOrder && orderLineItems.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Selecteer Artikelen (Optioneel)</h3>
                    <Badge variant="secondary" className="text-xs">
                      {selectedItems.size} van {orderLineItems.length} geselecteerd
                    </Badge>
                  </div>

                  <ScrollArea className="h-[300px] rounded-md border p-4">
                    <div className="space-y-4">
                      {orderLineItems.map((item: ShopifyLineItem) => (
                        <div
                          key={item.id}
                          className="flex items-start space-x-3 rounded-lg border p-3"
                          data-testid={`item-${item.sku}`}
                        >
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={(checked) => toggleItemSelection(item.id, checked as boolean)}
                            data-testid={`checkbox-item-${item.sku}`}
                          />
                          <div className="flex-1 space-y-2">
                            <div>
                              <p className="font-medium text-sm">{item.title}</p>
                              {item.variantTitle && (
                                <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                              )}
                              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            </div>

                            {selectedItems.has(item.id) && (
                              <div className="space-y-2 pt-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs font-medium">Aantal</label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max={item.quantity}
                                      value={selectedItems.get(item.id)?.quantity || 1}
                                      onChange={(e) =>
                                        updateItemData(item.id, "quantity", parseInt(e.target.value) || 1)
                                      }
                                      className="h-8"
                                      data-testid={`quantity-input-${item.sku}`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-medium">Notities</label>
                                  <Textarea
                                    placeholder="Bijv. camera werkt niet, scherm kapot..."
                                    value={selectedItems.get(item.id)?.itemNotes || ""}
                                    onChange={(e) =>
                                      updateItemData(item.id, "itemNotes", e.target.value)
                                    }
                                    className="min-h-[60px] text-sm"
                                    data-testid={`notes-input-${item.sku}`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {/* Email Thread Info */}
            {emailThread && (
              <>
                <Separator />
                <div className="rounded-lg border bg-muted p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <h4 className="font-medium text-sm">Email Thread Gekoppeld</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Van:</strong> {emailThread.customerEmail}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Onderwerp:</strong> {emailThread.subject}
                  </p>
                </div>
              </>
            )}

            {/* Submit Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="cancel-button"
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={createCaseMutation.isPending}
                data-testid="submit-button"
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
