import { useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchaseOrderSchema, type Supplier } from "@shared/schema";
import type { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type PurchaseOrderFormData = z.infer<typeof insertPurchaseOrderSchema>;

interface PurchaseOrderFormProps {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
}

interface LineItem {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export function PurchaseOrderForm({ open, onClose, suppliers }: PurchaseOrderFormProps) {
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { user } = useAuth();

  const form = useForm({
    resolver: zodResolver(insertPurchaseOrderSchema.omit({ poNumber: true })),
    defaultValues: {
      title: "",
      supplierId: "",
      orderDate: new Date(),
      expectedDeliveryDate: undefined,
      totalAmount: 0,
      currency: "EUR",
      status: "draft" as const,
      notes: "",
      createdBy: user?.id || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // First create the PO
      const poResponse = await apiRequest("POST", "/api/purchase-orders", data);
      const purchaseOrder = await poResponse.json();
      
      // Then create line items if any
      if (data.lineItems && data.lineItems.length > 0) {
        for (const item of data.lineItems) {
          await apiRequest("POST", "/api/purchase-order-items", {
            purchaseOrderId: purchaseOrder.id,
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice * 100), // Convert to cents
            subtotal: Math.round(item.quantity * item.unitPrice * 100),
          });
        }
      }
      
      return purchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ 
        title: "Inkoop order aangemaakt", 
        description: "De inkoop order is succesvol aangemaakt." 
      });
      onClose();
      form.reset();
      setLineItems([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "Fout bij aanmaken", 
        description: error.message || "Er is een fout opgetreden.",
        variant: "destructive"
      });
    },
  });

  const handleSubmit = (data: any) => {
    // Calculate total amount from line items in cents
    const total = Math.round(lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 100);
    createMutation.mutate({ ...data, totalAmount: total, createdBy: user?.id, lineItems });
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: Math.random().toString(),
      sku: "",
      productName: "",
      quantity: 1,
      unitPrice: 0,
    }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nieuwe Inkoop Order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-po-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leverancier</FormLabel>
                    <FormControl>
                      <Input
                        list="suppliers-list"
                        placeholder="Zoek leverancier op code of naam..."
                        value={
                          field.value
                            ? suppliers.find(s => s.id === field.value)
                                ? `${suppliers.find(s => s.id === field.value)?.supplierCode} - ${suppliers.find(s => s.id === field.value)?.name}`
                                : ''
                            : ''
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          // Find supplier by code or name
                          const supplier = suppliers.find(s => 
                            value.includes(s.supplierCode) || 
                            value.toLowerCase().includes(s.name.toLowerCase())
                          );
                          if (supplier) {
                            field.onChange(supplier.id);
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          const supplier = suppliers.find(s => 
                            value.includes(s.supplierCode) || 
                            value.toLowerCase().includes(s.name.toLowerCase())
                          );
                          if (supplier) {
                            field.onChange(supplier.id);
                          }
                        }}
                        data-testid="input-supplier-search"
                      />
                    </FormControl>
                    <datalist id="suppliers-list">
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={`${supplier.supplierCode} - ${supplier.name}`}>
                          {supplier.supplierCode} - {supplier.name}
                        </option>
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Datum</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-order-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectedDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verwachte Levering</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-delivery-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Concept</SelectItem>
                      <SelectItem value="sent">Verzonden</SelectItem>
                      <SelectItem value="awaiting_delivery">Onderweg</SelectItem>
                      <SelectItem value="received">Ontvangen</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Regel Items</FormLabel>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addLineItem}
                  data-testid="button-add-line-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Item Toevoegen
                </Button>
              </div>

              {lineItems.map((item, index) => (
                <Card key={item.id}>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-2">
                        <Input
                          placeholder="SKU"
                          value={item.sku}
                          onChange={(e) => updateLineItem(item.id, 'sku', e.target.value)}
                          data-testid={`input-sku-${index}`}
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          placeholder="Productnaam"
                          value={item.productName}
                          onChange={(e) => updateLineItem(item.id, 'productName', e.target.value)}
                          data-testid={`input-productname-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Aantal"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          data-testid={`input-quantity-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Prijs"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          data-testid={`input-price-${index}`}
                        />
                      </div>
                      <div className="col-span-1 text-sm pt-2">
                        €{(item.quantity * item.unitPrice).toFixed(2)}
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          data-testid={`button-remove-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {lineItems.length > 0 && (
                <div className="flex justify-end font-medium text-lg">
                  Totaal: €{totalAmount.toFixed(2)}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notities</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} data-testid="textarea-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Annuleer
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-po">
                {createMutation.isPending ? "Aanmaken..." : "Aanmaken"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
