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
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Package,
    CheckCircle,
    CheckSquare,
    ShoppingBag,
    AlertCircle,
    Zap,
    Hash,
    MessageSquare,
    User,
    Mail,
    Calendar,
    Euro,
    Image as ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

// Extended return reasons including carrier return
const RETURN_REASONS = [
    { value: "wrong_item", label: "Verkeerd artikel", icon: "🔄" },
    { value: "damaged", label: "Beschadigd", icon: "💔" },
    { value: "defective", label: "Defect", icon: "⚠️" },
    { value: "size_issue", label: "Verkeerde maat", icon: "📏" },
    { value: "changed_mind", label: "Niet meer nodig", icon: "🤔" },
    { value: "not_as_described", label: "Niet zoals beschreven", icon: "📝" },
    { value: "quality_issue", label: "Kwaliteitsprobleem", icon: "👎" },
    { value: "delivery_issue", label: "Leveringsprobleem", icon: "📦" },
    { value: "carrier_return", label: "Retour bezorgdienst", icon: "🚚" },
    { value: "other", label: "Anders", icon: "❓" },
] as const;

// Map extended reasons to database enum (use 'other' for new reasons)
const reasonToDbValue = (reason: string): "wrong_item" | "damaged" | "defective" | "size_issue" | "changed_mind" | "other" => {
    const directValues = ["wrong_item", "damaged", "defective", "size_issue", "changed_mind"] as const;
    if (directValues.includes(reason as any)) {
        return reason as any;
    }
    return "other";
};

const PRIORITY_OPTIONS = [
    { value: "low", label: "Laag", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { value: "medium", label: "Normaal", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    { value: "high", label: "Hoog", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

const CONDITION_OPTIONS = [
    { value: "unopened", label: "Ongeopend", color: "text-emerald-600" },
    { value: "opened_unused", label: "Geopend - Ongebruikt", color: "text-blue-600" },
    { value: "used", label: "Gebruikt", color: "text-amber-600" },
    { value: "damaged", label: "Beschadigd", color: "text-red-600" },
] as const;

const wizardSchema = insertReturnSchema.extend({
    customerId: z.string().optional().nullable(),
    orderId: z.string().optional().nullable(),
    returnReason: z.enum(["wrong_item", "damaged", "defective", "size_issue", "changed_mind", "other"]).optional().nullable(),
    otherReason: z.string().optional().nullable(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    trackingNumber: z.string().optional().nullable(),
    status: z.enum(["nieuw", "onderweg", "ontvangen_controle", "akkoord_terugbetaling", "vermiste_pakketten", "wachten_klant", "opnieuw_versturen", "klaar", "niet_ontvangen"]).default("nieuw"),
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
    imageUrl?: string | null;
}

// Step indicator icons
const STEP_ICONS = [ShoppingBag, Package, AlertCircle, CheckCircle];
const STEP_LABELS = ["Order", "Artikelen", "Details", "Bevestig"];

export function CreateReturnWizard({ open, onOpenChange, onReturnCreated }: CreateReturnWizardProps) {
    const [step, setStep] = useState(1);
    const [orderSearch, setOrderSearch] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
    const [selectedReason, setSelectedReason] = useState("wrong_item");
    const { toast } = useToast();

    const form = useForm<WizardFormValues>({
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            status: "nieuw",
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

    const filteredOrders = orders.filter((order) =>
        orderSearch
            ? order.orderNumber?.toLowerCase().includes(orderSearch.toLowerCase()) ||
            order.customerEmail?.toLowerCase().includes(orderSearch.toLowerCase()) ||
            order.orderData?.customer?.email?.toLowerCase().includes(orderSearch.toLowerCase())
            : true
    ).slice(0, 20); // Limit to 20 results

    const createReturnMutation = useMutation({
        mutationFn: async (data: WizardFormValues & { items: any[] }) => {
            const response = await fetch("/api/returns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create return: ${errorText}`);
            }
            return response.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
            toast({ title: "✅ Retour succesvol aangemaakt" });
            onReturnCreated?.(data.id);
            handleClose();
        },
        onError: (error: any) => {
            toast({
                title: "Retour aanmaken mislukt",
                description: error.message || "Onbekende fout",
                variant: "destructive",
            });
        },
    });

    const handleClose = () => {
        setStep(1);
        setSelectedOrder(null);
        setSelectedItems(new Map());
        setOrderSearch("");
        setSelectedReason("wrong_item");
        form.reset();
        onOpenChange(false);
    };

    const handleNext = () => {
        if (step === 1 && !selectedOrder) {
            toast({ title: "Selecteer een order", variant: "destructive" });
            return;
        }
        if (step === 2 && selectedItems.size === 0) {
            toast({ title: "Selecteer minimaal één artikel", variant: "destructive" });
            return;
        }
        setStep(step + 1);
    };

    const handleSubmit = () => {
        const dbReason = reasonToDbValue(selectedReason);
        const reasonLabel = RETURN_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;

        if (dbReason === "other" && selectedReason !== "other") {
            form.setValue("otherReason", reasonLabel);
        }
        form.setValue("returnReason", dbReason);

        form.handleSubmit((data) => {
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
                customerId: selectedOrder.customerId || undefined,
                orderId: selectedOrder.id,
                items,
            };

            createReturnMutation.mutate(submitData);
        }, (errors) => {
            console.error('Form validation errors:', errors);
            toast({
                title: "Formulier validatie mislukt",
                description: "Controleer alle verplichte velden",
                variant: "destructive",
            });
        })();
    };

    const getProductImage = (lineItem: any): string | null => {
        // Try different image paths from Shopify order data
        return lineItem.image?.src ||
            lineItem.product?.image?.src ||
            lineItem.featured_image?.url ||
            null;
    };

    const toggleItem = (lineItem: any, checked: boolean) => {
        const newItems = new Map(selectedItems);
        if (checked) {
            const priceInCents = Math.round((lineItem.price || 0) * 100);
            newItems.set(lineItem.id, {
                productName: lineItem.name || lineItem.title,
                sku: lineItem.sku,
                quantity: 1,
                condition: "unopened",
                reason: selectedReason,
                unitPrice: priceInCents,
                imageUrl: getProductImage(lineItem),
            });
        } else {
            newItems.delete(lineItem.id);
        }
        setSelectedItems(newItems);
    };

    const selectAllItems = () => {
        const lineItems = selectedOrder?.orderData?.line_items || [];
        const newItems = new Map<string, SelectedItem>();

        lineItems.forEach((lineItem: any, index: number) => {
            const itemKey = lineItem.id?.toString() || lineItem.sku || `item-${index}`;
            const priceInCents = Math.round((lineItem.price || 0) * 100);
            newItems.set(itemKey, {
                productName: lineItem.name || lineItem.title,
                sku: lineItem.sku,
                quantity: 1,
                condition: "unopened",
                reason: selectedReason,
                unitPrice: priceInCents,
                imageUrl: getProductImage(lineItem),
            });
        });

        setSelectedItems(newItems);
    };

    const deselectAllItems = () => {
        setSelectedItems(new Map());
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

    const lineItems = selectedOrder?.orderData?.line_items || [];
    const allSelected = lineItems.length > 0 && selectedItems.size === lineItems.length;

    const getStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            fulfilled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
            pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        };
        return statusColors[status] || "bg-gray-100 text-gray-700";
    };

    // Calculate total refund amount
    const totalRefundAmount = Array.from(selectedItems.values()).reduce(
        (sum, item) => sum + (item.unitPrice || 0) * item.quantity,
        0
    );

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-base font-semibold flex items-center gap-2">
                        <Package className="h-4 w-4 text-orange-500" />
                        Retour Aanmaken
                    </DialogTitle>
                </DialogHeader>

                {/* Compact Step Progress Indicator */}
                <div className="flex items-center justify-between mb-4 px-2">
                    {STEP_LABELS.map((label, idx) => {
                        const StepIcon = STEP_ICONS[idx];
                        const stepNum = idx + 1;
                        const isActive = step === stepNum;
                        const isCompleted = step > stepNum;

                        return (
                            <div key={idx} className="flex items-center">
                                <div className="flex flex-col items-center">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                                        ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                                        ${isActive ? 'bg-orange-500 text-white ring-2 ring-orange-200' : ''}
                                        ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : ''}
                                    `}>
                                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                                    </div>
                                    <span className={`text-[10px] mt-1 ${isActive ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                                        {label}
                                    </span>
                                </div>
                                {idx < 3 && (
                                    <div className={`w-8 h-0.5 mx-1 ${step > stepNum ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Step 1: Select Order */}
                {step === 1 && (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Zoek op ordernummer of e-mail..."
                                value={orderSearch}
                                onChange={(e) => setOrderSearch(e.target.value)}
                                className="pl-8 h-9 text-sm"
                            />
                        </div>

                        <div className="space-y-2 max-h-[350px] overflow-y-auto">
                            {filteredOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-all text-sm ${selectedOrder?.id === order.id
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 ring-1 ring-orange-500"
                                        : "hover:border-gray-300"
                                        }`}
                                    onClick={() => setSelectedOrder(order)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm">{order.orderNumber}</span>
                                                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${getStatusBadge(order.status)}`}>
                                                    {order.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                {order.customerEmail}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {order.orderDate ? format(new Date(order.orderDate), "d MMM yyyy", { locale: nl }) : ""}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                €{((order.totalAmount || 0) / 100).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredOrders.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    Geen orders gevonden
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 2: Select Items */}
                {step === 2 && selectedOrder && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Order {selectedOrder.orderNumber}</p>
                                <p className="text-xs text-muted-foreground">
                                    Selecteer artikelen om te retourneren
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={allSelected ? deselectAllItems : selectAllItems}
                                className="h-7 text-xs"
                            >
                                <CheckSquare className="h-3 w-3 mr-1" />
                                {allSelected ? "Deselecteer" : "Selecteer alles"}
                            </Button>
                        </div>

                        <div className="space-y-2 max-h-[350px] overflow-y-auto overflow-x-hidden">
                            {lineItems.map((lineItem: any, index: number) => {
                                const itemKey = lineItem.id?.toString() || lineItem.sku || `item-${index}`;
                                const isSelected = selectedItems.has(itemKey);
                                const selectedItem = selectedItems.get(itemKey);
                                const imageUrl = getProductImage(lineItem);

                                return (
                                    <div key={itemKey} className={`border rounded-lg p-2.5 transition-all overflow-hidden ${isSelected ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20' : ''
                                        }`}>
                                        <div className="flex items-start gap-2">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) =>
                                                    toggleItem({ ...lineItem, id: itemKey }, checked as boolean)
                                                }
                                                className="mt-1 flex-shrink-0 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                            />

                                            {/* Product Image */}
                                            <div className="w-9 h-9 flex-shrink-0 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                                                {imageUrl ? (
                                                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 overflow-hidden">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-xs font-medium truncate">{lineItem.name || lineItem.title}</p>
                                                    <p className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                                        €{Number(lineItem.price || 0).toFixed(2)}
                                                    </p>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate">
                                                    SKU: {lineItem.sku || "N/B"} • Aantal: {lineItem.quantity}
                                                </p>

                                                {isSelected && selectedItem && (
                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[10px] font-medium text-muted-foreground">Aantal</label>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                max={lineItem.quantity}
                                                                value={selectedItem.quantity}
                                                                onChange={(e) =>
                                                                    updateItemQuantity(itemKey, parseInt(e.target.value) || 1)
                                                                }
                                                                className="h-7 text-xs mt-0.5"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-medium text-muted-foreground">Conditie</label>
                                                            <Select
                                                                value={selectedItem.condition}
                                                                onValueChange={(value) =>
                                                                    updateItemCondition(itemKey, value)
                                                                }
                                                            >
                                                                <SelectTrigger className="h-7 text-xs mt-0.5">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {CONDITION_OPTIONS.map((opt) => (
                                                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                            {opt.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                )}
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
                        <div className="space-y-3">
                            {/* Reason Select */}
                            <div>
                                <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
                                    <AlertCircle className="h-3 w-3 text-orange-500" />
                                    Reden van retour
                                </label>
                                <Select value={selectedReason} onValueChange={setSelectedReason}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RETURN_REASONS.map((reason) => (
                                            <SelectItem key={reason.value} value={reason.value} className="text-sm">
                                                <span className="flex items-center gap-2">
                                                    <span>{reason.icon}</span>
                                                    {reason.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedReason === "other" && (
                                <FormField
                                    control={form.control}
                                    name="otherReason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Specificeer reden</FormLabel>
                                            <FormControl>
                                                <Input {...field} value={field.value || ""} placeholder="Beschrijf de reden..." className="h-9 text-sm" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {/* Priority with color */}
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs flex items-center gap-1.5">
                                            <Zap className="h-3 w-3 text-orange-500" />
                                            Prioriteit
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-9 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {PRIORITY_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                                        <span className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${opt.value === 'urgent' ? 'bg-red-500' : opt.value === 'high' ? 'bg-orange-500' : opt.value === 'medium' ? 'bg-gray-400' : 'bg-emerald-500'}`} />
                                                            {opt.label}
                                                        </span>
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
                                name="trackingNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs flex items-center gap-1.5">
                                            <Hash className="h-3 w-3 text-muted-foreground" />
                                            Trackingnummer (optioneel)
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value || ""} placeholder="Voer trackingnummer in" className="h-9 text-sm" />
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
                                        <FormLabel className="text-xs flex items-center gap-1.5">
                                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                            Klantnotities (optioneel)
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea {...field} value={field.value || ""} placeholder="Eventuele opmerkingen" className="text-sm min-h-[60px]" />
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
                    <div className="space-y-3">
                        {/* Order Info Card */}
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-2">
                                <ShoppingBag className="h-4 w-4 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Order Informatie</span>
                            </div>
                            <p className="text-sm font-medium">{selectedOrder?.orderNumber}</p>
                            <p className="text-xs text-muted-foreground">{selectedOrder?.customerEmail}</p>
                        </div>

                        {/* Items Card */}
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="h-4 w-4 text-purple-600" />
                                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                                    Artikelen ({selectedItems.size})
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {Array.from(selectedItems.values()).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                        <span className="truncate flex-1">{item.productName} (x{item.quantity})</span>
                                        <span className={`ml-2 ${CONDITION_OPTIONS.find(c => c.value === item.condition)?.color}`}>
                                            {CONDITION_OPTIONS.find(c => c.value === item.condition)?.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Details Card */}
                        <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Retour Details</span>
                            </div>
                            <div className="space-y-1 text-xs">
                                <p>
                                    <span className="text-muted-foreground">Reden:</span>{" "}
                                    {RETURN_REASONS.find(r => r.value === selectedReason)?.icon}{" "}
                                    {RETURN_REASONS.find(r => r.value === selectedReason)?.label}
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Prioriteit:</span>{" "}
                                    <Badge className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_OPTIONS.find(p => p.value === form.watch("priority"))?.color}`}>
                                        {PRIORITY_OPTIONS.find(p => p.value === form.watch("priority"))?.label}
                                    </Badge>
                                </p>
                                {form.watch("trackingNumber") && (
                                    <p><span className="text-muted-foreground">Tracking:</span> {form.watch("trackingNumber")}</p>
                                )}
                            </div>
                        </div>

                        {/* Total */}
                        <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Euro className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Geschat Retourbedrag</span>
                                </div>
                                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                    €{(totalRefundAmount / 100).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-3 border-t mt-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (step === 1 ? handleClose() : setStep(step - 1))}
                        disabled={createReturnMutation.isPending}
                        className="h-8 text-sm"
                    >
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        {step === 1 ? "Annuleren" : "Terug"}
                    </Button>

                    {step < 4 ? (
                        <Button onClick={handleNext} size="sm" className="h-8 text-sm bg-orange-500 hover:bg-orange-600">
                            Volgende
                            <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={() => handleSubmit()}
                            disabled={createReturnMutation.isPending}
                            size="sm"
                            className="h-8 text-sm bg-emerald-500 hover:bg-emerald-600"
                        >
                            {createReturnMutation.isPending ? "Aanmaken..." : "✓ Retour Aanmaken"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
