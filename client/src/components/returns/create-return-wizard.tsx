import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertReturnSchema } from "@shared/schema";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Search, Package, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const wizardSchema = insertReturnSchema.extend({
    customerId: z.string().optional().nullable(),
    orderId: z.string().optional().nullable(),
    returnReason: z.enum(["wrong_item", "damaged", "defective", "size_issue", "changed_mind", "other"]).optional().nullable(),
    otherReason: z.string().optional().nullable(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    trackingNumber: z.string().optional().nullable(),
    status: z.enum(["nieuw_onderweg", "ontvangen_controle", "akkoord_terugbetaling", "vermiste_pakketten", "wachten_klant", "opnieuw_versturen", "klaar", "niet_ontvangen"]).default("nieuw_onderweg"),
});

type WizardFormValues = z.infer<typeof wizardSchema>;

interface CreateReturnWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onReturnCreated?: (returnId: string) => void;
}

interface SelectedItem {
    productName: string;
    sku: string | null;
    quantity: number;
    condition: string;
    reason: string;
    unitPrice: number | null;
}

export function CreateReturnWizard({ open, onOpenChange, onReturnCreated }: CreateReturnWizardProps) {
    const [step, setStep] = useState(1);
    const [orderSearch, setOrderSearch] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
    const { toast } = useToast();

    const form = useForm<WizardFormValues>({
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            status: "nieuw_onderweg",
            priority: "medium",
            returnReason: "wrong_item",
            customerId: undefined,
            orderId: undefined,
            trackingNumber: null,
            otherReason: null,
        },
    });

    // Search orders
    const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
        queryKey: ["/api/orders"],
        enabled: open,
    });

    console.log('Orders loaded:', orders.length, 'orders');

    const filteredOrders = orders.filter((order) =>
        orderSearch
            ? order.orderNumber?.toLowerCase().includes(orderSearch.toLowerCase()) ||
            order.customerEmail?.toLowerCase().includes(orderSearch.toLowerCase()) ||
            order.orderData?.customer?.email?.toLowerCase().includes(orderSearch.toLowerCase())
            : true
    );

    console.log('Filtered orders:', filteredOrders.length, 'Search:', orderSearch);

    const createReturnMutation = useMutation({
        mutationFn: async (data: WizardFormValues & { items: any[] }) => {
            console.log('Creating return with data:', data);
            const response = await fetch("/api/returns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Create return failed:', response.status, errorText);
                throw new Error(`Failed to create return: ${errorText}`);
            }
            return response.json();
        },
        onSuccess: (data) => {
            console.log('Return created successfully:', data);
            queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
            toast({ title: "Return created successfully" });
            onReturnCreated?.(data.id);
            handleClose();
        },
        onError: (error: any) => {
            console.error('Create return error:', error);
            toast({
                title: "Failed to create return",
                description: error.message || "Unknown error",
                variant: "destructive",
            });
        },
    });

    const handleClose = () => {
        setStep(1);
        setSelectedOrder(null);
        setSelectedItems(new Map());
        setOrderSearch("");
        form.reset();
        onOpenChange(false);
    };

    const handleNext = () => {
        if (step === 1 && !selectedOrder) {
            toast({ title: "Please select an order", variant: "destructive" });
            return;
        }
        if (step === 2 && selectedItems.size === 0) {
            toast({ title: "Please select at least one item", variant: "destructive" });
            return;
        }
        setStep(step + 1);
    };

    const handleSubmit = () => {
        console.log('Submit button clicked');
        console.log('Selected order:', selectedOrder);
        console.log('Selected items:', Array.from(selectedItems.values()));
        console.log('Form values:', form.getValues());

        form.handleSubmit((data) => {
            console.log('Form validated, submitting...');
            const items = Array.from(selectedItems.values()).map((item) => ({
                productName: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                reason: item.reason,
                condition: item.condition,
                unitPrice: item.unitPrice,
            }));

            const submitData = {
                ...data,
                // Ensure customerId is set - use order's customerId or fallback to order's customer email
                customerId: selectedOrder.customerId || undefined,
                orderId: selectedOrder.id,
                items,
            };

            console.log('Submitting return with data:', submitData);
            console.log('Selected order customerId:', selectedOrder.customerId);
            console.log('Selected order full data:', selectedOrder);

            createReturnMutation.mutate(submitData);
        }, (errors) => {
            console.error('Form validation errors:', errors);
            toast({
                title: "Form validation failed",
                description: "Please check all required fields",
                variant: "destructive",
            });
        })();
    };

    const toggleItem = (lineItem: any, checked: boolean) => {
        const newItems = new Map(selectedItems);
        if (checked) {
            // Shopify stores price in cents as a number
            const priceInCents = Math.round((lineItem.price || 0) * 100);
            newItems.set(lineItem.id, {
                productName: lineItem.name,
                sku: lineItem.sku,
                quantity: 1,
                condition: "unopened",
                reason: form.watch("returnReason") || "wrong_item",
                unitPrice: priceInCents,
            });
        } else {
            newItems.delete(lineItem.id);
        }
        setSelectedItems(newItems);
    };

    const updateItemQuantity = (itemId: string, quantity: number) => {
        const newItems = new Map(selectedItems);
        const item = newItems.get(itemId);
        if (item) {
            newItems.set(itemId, { ...item, quantity });
            setSelectedItems(newItems);
        }
    };

    const updateItemCondition = (itemId: string, condition: string) => {
        const newItems = new Map(selectedItems);
        const item = newItems.get(itemId);
        if (item) {
            newItems.set(itemId, { ...item, condition });
            setSelectedItems(newItems);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Return - Step {step} of 4</DialogTitle>
                </DialogHeader>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center flex-1">
                            <div
                                className={`h-2 flex-1 rounded ${s <= step ? "bg-primary" : "bg-muted"
                                    }`}
                            />
                        </div>
                    ))}
                </div>

                {/* Step 1: Select Order */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Search Order</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by order number or customer email..."
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {filteredOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedOrder?.id === order.id ? "border-primary bg-primary/5" : ""
                                        }`}
                                    onClick={() => setSelectedOrder(order)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium">Order #{order.orderNumber}</h4>
                                            <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {order.orderDate ? format(new Date(order.orderDate), "PPP") : ""}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium">€{((order.totalAmount || 0) / 100).toFixed(2)}</p>
                                            <Badge variant="outline" className="text-xs mt-1">
                                                {order.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Select Items */}
                {step === 2 && selectedOrder && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium mb-2">Select Items to Return</h3>
                            <p className="text-sm text-muted-foreground">
                                Choose which items from order #{selectedOrder.orderNumber} to return
                            </p>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {selectedOrder.orderData?.line_items?.map((lineItem: any, index: number) => {
                                // Use a unique identifier - prefer id, fallback to sku or index
                                const itemKey = lineItem.id?.toString() || lineItem.sku || `item-${index}`;
                                const isSelected = selectedItems.has(itemKey);
                                const selectedItem = selectedItems.get(itemKey);

                                return (
                                    <div key={itemKey} className="border rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) =>
                                                    toggleItem({ ...lineItem, id: itemKey }, checked as boolean)
                                                }
                                            />
                                            <div className="flex-1">
                                                <h4 className="font-medium">{lineItem.name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    SKU: {lineItem.sku || "N/A"} • Qty: {lineItem.quantity}
                                                </p>

                                                {isSelected && selectedItem && (
                                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-xs font-medium">Quantity</label>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                max={lineItem.quantity}
                                                                value={selectedItem.quantity}
                                                                onChange={(e) =>
                                                                    updateItemQuantity(itemKey, parseInt(e.target.value) || 1)
                                                                }
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-medium">Condition</label>
                                                            <Select
                                                                value={selectedItem.condition}
                                                                onValueChange={(value) =>
                                                                    updateItemCondition(itemKey, value)
                                                                }
                                                            >
                                                                <SelectTrigger className="mt-1">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="unopened">Unopened</SelectItem>
                                                                    <SelectItem value="opened_unused">Opened - Unused</SelectItem>
                                                                    <SelectItem value="used">Used</SelectItem>
                                                                    <SelectItem value="damaged">Damaged</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium">€{Number(lineItem.price || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 3: Return Details */}
                {step === 3 && (
                    <Form {...form}>
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="returnReason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Return Reason</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                                <SelectItem value="damaged">Damaged</SelectItem>
                                                <SelectItem value="defective">Defective</SelectItem>
                                                <SelectItem value="size_issue">Size Issue</SelectItem>
                                                <SelectItem value="changed_mind">Changed Mind</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {form.watch("returnReason") === "other" && (
                                <FormField
                                    control={form.control}
                                    name="otherReason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Specify Reason</FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
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
                                name="trackingNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tracking Number (Optional)</FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value || ""} placeholder="Enter tracking number" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerNotes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Notes (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} value={field.value || ""} placeholder="Any notes from the customer" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </Form>
                )}

                {/* Step 4: Review */}
                {step === 4 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                            <h3 className="font-medium">Review Return Details</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">Order Information</h4>
                                <p className="text-sm">Order #{selectedOrder?.orderNumber}</p>
                                <p className="text-sm text-muted-foreground">{selectedOrder?.customerEmail}</p>
                            </div>

                            <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">Items ({selectedItems.size})</h4>
                                {Array.from(selectedItems.values()).map((item, idx) => (
                                    <div key={idx} className="text-sm flex justify-between py-1">
                                        <span>{item.productName} (x{item.quantity})</span>
                                        <span className="text-muted-foreground">{item.condition}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">Return Details</h4>
                                <div className="text-sm space-y-1">
                                    <p>Reason: {form.watch("returnReason")}</p>
                                    <p>Priority: {form.watch("priority")}</p>
                                    {form.watch("trackingNumber") && (
                                        <p>Tracking: {form.watch("trackingNumber")}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => (step === 1 ? handleClose() : setStep(step - 1))}
                        disabled={createReturnMutation.isPending}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        {step === 1 ? "Cancel" : "Back"}
                    </Button>

                    {step < 4 ? (
                        <Button onClick={handleNext}>
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    ) : (
                        <Button type="button" onClick={() => handleSubmit()} disabled={createReturnMutation.isPending}>
                            {createReturnMutation.isPending ? "Creating..." : "Create Return"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
