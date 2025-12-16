import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    ChevronLeft,
    ChevronRight,
    Search,
    CalendarIcon,
    Upload,
    X,
    CheckCircle,
    Package,
    ShoppingBag,
    Wrench,
    Mail,
    Image as ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { User, Customer, Order } from "@shared/schema";

interface CreateRepairWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: User[];
    caseId?: string;
    emailThreadId?: string;
    repairType?: 'customer' | 'inventory';
}

interface SelectedItem {
    productName: string;
    sku: string | null;
    quantity: number;
    unitPrice: number | null;
    imageUrl?: string | null;
}

interface FormData {
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    assignedUserId: string;
    trackingNumber?: string;
    trackingCarrier?: string;
}

const PRIORITY_OPTIONS = [
    { value: "low", label: "Laag", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { value: "medium", label: "Normaal", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    { value: "high", label: "Hoog", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

const STEP_ICONS = [ShoppingBag, Package, CheckCircle];
const STEP_LABELS = ["Order", "Details", "Bevestig"];

export function CreateRepairWizard({ open, onOpenChange, users, caseId, emailThreadId, repairType = 'customer' }: CreateRepairWizardProps) {
    const [step, setStep] = useState(1);
    const [orderSearch, setOrderSearch] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
    const [slaDeadline, setSlaDeadline] = useState<Date | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const { toast } = useToast();

    const { data: customers = [] } = useQuery<Customer[]>({
        queryKey: ['/api/customers'],
        enabled: open,
    });

    const { data: orders = [] } = useQuery<Order[]>({
        queryKey: ['/api/orders'],
        enabled: open,
    });

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormData>({
        defaultValues: {
            description: "",
            priority: "medium",
            assignedUserId: "none",
            trackingNumber: "",
            trackingCarrier: "",
        },
    });

    const createRepairMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/repairs", data);
            return await res.json();
        },
        onSuccess: async (newRepair: any) => {
            if (selectedFiles.length > 0) {
                const formData = new FormData();
                selectedFiles.forEach((file) => {
                    formData.append('files', file);
                });
                const uploadRes = await fetch(`/api/repairs/${newRepair.id}/upload`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });
                if (!uploadRes.ok) {
                    throw new Error('Failed to upload files');
                }
            }

            queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
            toast({
                title: "✅ Reparatie aangemaakt",
                description: "De reparatie is succesvol aangemaakt.",
            });
            handleClose();
        },
        onError: (error: any) => {
            console.error("Create repair error:", error);
            toast({
                title: "Fout",
                description: error?.message || "Er is een fout opgetreden bij het aanmaken van de reparatie.",
                variant: "destructive",
            });
        }
    });

    const handleClose = () => {
        setStep(1);
        setSelectedOrder(null);
        setSelectedItems(new Map());
        setOrderSearch("");
        setSlaDeadline(null);
        setSelectedFiles([]);
        reset();
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

    const handleBack = () => {
        setStep(step - 1);
    };

    const onSubmit = (data: FormData) => {
        const selectedCustomer = selectedOrder
            ? customers.find(c => c.id === selectedOrder.customerId)
            : null;

        // Get first selected item for SKU and product name
        const firstItem = Array.from(selectedItems.values())[0];
        const itemsList = Array.from(selectedItems.values());

        // Build title: OrderNumber - SKU ProductName
        const title = `${selectedOrder?.orderNumber || 'Reparatie'} - ${firstItem?.sku || ''} ${firstItem?.productName || ''}`.trim();

        const repairData = {
            title,
            description: data.description || undefined,
            priority: data.priority,
            assignedUserId: (data.assignedUserId && data.assignedUserId !== "none") ? data.assignedUserId : undefined,
            slaDeadline: slaDeadline ? slaDeadline.toISOString() : undefined,
            productSku: firstItem?.sku || undefined,
            productName: firstItem?.productName || undefined,
            customerId: selectedOrder?.customerId || undefined,
            orderId: selectedOrder?.id || undefined,
            customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim() : undefined,
            customerEmail: selectedCustomer?.email || selectedOrder?.customerEmail || undefined,
            orderNumber: selectedOrder?.orderNumber || undefined,
            status: "new",
            repairType: repairType,
            caseId: caseId,
            emailThreadId: emailThreadId,
            trackingNumber: data.trackingNumber || undefined,
            trackingCarrier: data.trackingCarrier || undefined,
        };

        createRepairMutation.mutate(repairData);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + selectedFiles.length > 10) {
            toast({
                title: "Te veel bestanden",
                description: "Je kunt maximaal 10 bestanden uploaden.",
                variant: "destructive",
            });
            return;
        }
        setSelectedFiles([...selectedFiles, ...files]);
    };

    const removeFile = (index: number) => {
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    // Item selection helper functions
    const getProductImage = (lineItem: any): string | null => {
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
                unitPrice: priceInCents,
                imageUrl: getProductImage(lineItem),
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

    const filteredOrders = orders.filter((order) =>
        orderSearch
            ? order.orderNumber?.toLowerCase().includes(orderSearch.toLowerCase()) ||
            order.customerEmail?.toLowerCase().includes(orderSearch.toLowerCase())
            : true
    ).slice(0, 20);

    const lineItems = selectedOrder?.orderData?.line_items || [];
    const technicians = users.filter(u => u.role === 'TECHNICUS' || u.role === 'ADMIN');

    const getStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            fulfilled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
            pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        };
        return statusColors[status] || "bg-gray-100 text-gray-700";
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-base font-semibold flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-blue-500" />
                        Nieuwe Reparatie
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
                                        ${isActive ? 'bg-blue-500 text-white ring-2 ring-blue-200' : ''}
                                        ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : ''}
                                    `}>
                                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                                    </div>
                                    <span className={`text-[10px] mt-1 ${isActive ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
                                        {label}
                                    </span>
                                </div>
                                {idx < 2 && (
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
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-500"
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
                                                <CalendarIcon className="h-3 w-3" />
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

                {/* Step 2: Select Items + Details */}
                {step === 2 && selectedOrder && (
                    <div className="space-y-4">
                        {/* Order info header */}
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                Order {selectedOrder.orderNumber} - {selectedOrder.customerEmail}
                            </p>
                        </div>

                        {/* Item Selection */}
                        <div>
                            <label className="text-xs font-medium mb-2 block">Selecteer artikel(en)</label>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {lineItems.map((lineItem: any, index: number) => {
                                    const itemKey = lineItem.id?.toString() || lineItem.sku || `item-${index}`;
                                    const isSelected = selectedItems.has(itemKey);
                                    const selectedItem = selectedItems.get(itemKey);
                                    const imageUrl = getProductImage(lineItem);

                                    return (
                                        <div
                                            key={itemKey}
                                            className={`border rounded-lg p-2.5 transition-all cursor-pointer hover:bg-muted/30 ${isSelected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : ''
                                                }`}
                                            onClick={() => toggleItem({ ...lineItem, id: itemKey }, !isSelected)}
                                        >
                                            <div className="flex items-start gap-2">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) =>
                                                        toggleItem({ ...lineItem, id: itemKey }, checked as boolean)
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="mt-1 flex-shrink-0 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                                />

                                                {/* Product Image */}
                                                <div className="w-9 h-9 flex-shrink-0 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                                                    {imageUrl ? (
                                                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
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
                                                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                max={lineItem.quantity}
                                                                value={selectedItem.quantity}
                                                                onChange={(e) =>
                                                                    updateItemQuantity(itemKey, parseInt(e.target.value) || 1)
                                                                }
                                                                className="h-6 text-xs w-16"
                                                                placeholder="Aantal"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <Label className="text-xs">Omschrijving probleem</Label>
                            <Textarea
                                placeholder="Beschrijf het probleem..."
                                {...register("description")}
                                className="text-sm min-h-[60px] mt-1"
                            />
                        </div>

                        {/* Priority & Deadline */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Prioriteit</Label>
                                <Select
                                    onValueChange={(value) => setValue("priority", value as any)}
                                    value={watch("priority") || "medium"}
                                >
                                    <SelectTrigger className="h-8 text-xs mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITY_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${opt.value === 'urgent' ? 'bg-red-500' : opt.value === 'high' ? 'bg-orange-500' : opt.value === 'medium' ? 'bg-gray-400' : 'bg-emerald-500'}`} />
                                                    {opt.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs">Deadline</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            type="button"
                                            className="w-full h-8 text-xs mt-1 justify-start"
                                        >
                                            <CalendarIcon className="mr-1.5 h-3 w-3" />
                                            {slaDeadline ? format(slaDeadline, "d MMM", { locale: nl }) : "Selecteer"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={slaDeadline || undefined}
                                            onSelect={(date) => setSlaDeadline(date || null)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Tracking Info (Optional) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Tracking Code (Retour)</Label>
                                <Input
                                    placeholder="Track & Trace"
                                    {...register("trackingNumber")}
                                    className="h-8 text-xs mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Vervoerder</Label>
                                <Input
                                    placeholder="bijv. PostNL"
                                    {...register("trackingCarrier")}
                                    className="h-8 text-xs mt-1"
                                />
                            </div>
                        </div>

                        {/* Technician (optional) */}
                        <div>
                            <Label className="text-xs">Technicus (optioneel)</Label>
                            <Select
                                onValueChange={(value) => setValue("assignedUserId", value)}
                                value={watch("assignedUserId") || "none"}
                            >
                                <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder="Niet toegewezen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-xs">Niet toegewezen</SelectItem>
                                    {technicians.map((tech) => (
                                        <SelectItem key={tech.id} value={tech.id} className="text-xs">
                                            {tech.firstName || ''} {tech.lastName || ''} ({tech.username})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* File Upload */}
                        <div>
                            <Label className="text-xs">Foto's / Bijlagen (optioneel)</Label>
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 text-center mt-1">
                                <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-[10px] text-muted-foreground">
                                    Max 10 bestanden (afbeeldingen, PDF)
                                </p>
                                <Input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="mt-2 h-7 text-xs"
                                    accept="image/*,.pdf"
                                />
                            </div>

                            {selectedFiles.length > 0 && (
                                <div className="space-y-1 mt-2">
                                    {selectedFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between border p-1.5 rounded text-xs">
                                            <span className="truncate">{file.name}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeFile(index)}
                                                className="h-5 w-5 p-0"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Review & Photos */}
                {step === 3 && (
                    <div className="space-y-3">
                        {/* Order Info */}
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-2">
                                <ShoppingBag className="h-4 w-4 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Order</span>
                            </div>
                            <p className="text-sm font-medium">{selectedOrder?.orderNumber}</p>
                            <p className="text-xs text-muted-foreground">{selectedOrder?.customerEmail}</p>
                        </div>

                        {/* Selected Items */}
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="h-4 w-4 text-purple-600" />
                                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                                    Artikelen ({selectedItems.size})
                                </span>
                            </div>
                            <div className="space-y-1">
                                {Array.from(selectedItems.values()).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                        <span className="truncate flex-1">{item.productName} (x{item.quantity})</span>
                                        <span className="ml-2 text-muted-foreground">{item.sku}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Wrench className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Details</span>
                            </div>
                            <div className="space-y-1 text-xs">
                                <p>
                                    <span className="text-muted-foreground">Prioriteit:</span>{" "}
                                    <Badge className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_OPTIONS.find(p => p.value === watch("priority"))?.color}`}>
                                        {PRIORITY_OPTIONS.find(p => p.value === watch("priority"))?.label}
                                    </Badge>
                                </p>
                                {slaDeadline && (
                                    <p><span className="text-muted-foreground">Deadline:</span> {format(slaDeadline, "d MMMM yyyy", { locale: nl })}</p>
                                )}
                                {watch("description") && (
                                    <p><span className="text-muted-foreground">Probleem:</span> {watch("description")}</p>
                                )}
                            </div>
                        </div>


                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-3 border-t mt-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (step === 1 ? handleClose() : handleBack())}
                        disabled={createRepairMutation.isPending}
                        className="h-8 text-sm"
                    >
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        {step === 1 ? "Annuleren" : "Terug"}
                    </Button>

                    {step < 3 ? (
                        <Button onClick={handleNext} size="sm" className="h-8 text-sm bg-blue-500 hover:bg-blue-600">
                            Volgende
                            <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleSubmit(onSubmit)}
                            disabled={createRepairMutation.isPending}
                            size="sm"
                            className="h-8 text-sm bg-emerald-500 hover:bg-emerald-600"
                        >
                            {createRepairMutation.isPending ? "Aanmaken..." : "✓ Reparatie Aanmaken"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
