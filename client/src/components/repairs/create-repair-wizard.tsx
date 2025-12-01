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
import { ChevronLeft, ChevronRight, Search, CalendarIcon, Upload, X, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import type { User, Customer, Order } from "@shared/schema";

interface CreateRepairWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: User[];
    caseId?: string;
    emailThreadId?: string;
}

interface FormData {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    estimatedCost: number;
    productSku: string;
    productName: string;
    issueCategory: string;
    assignedUserId: string;
    customerId: string;
    orderId: string;
}

const ISSUE_CATEGORIES = [
    "Lensdefect - autofocus werkt niet",
    "Lensdefect - beeldstabilisatie defect",
    "Lensdefect - diafragma vastgelopen",
    "Lensdefect - schade aan lenselement",
    "Camera - sluiter defect",
    "Camera - sensor vervuiling",
    "Camera - schade aan behuizing",
    "Camera - batterij/oplaad probleem",
    "Camera - display defect",
    "Camera - knoppen/draaiknoppen defect",
    "Mechanische schade",
    "Water/vochtschade",
    "Overig",
];

export function CreateRepairWizard({ open, onOpenChange, users, caseId, emailThreadId }: CreateRepairWizardProps) {
    const [step, setStep] = useState(1);
    const [orderSearch, setOrderSearch] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [slaDeadline, setSlaDeadline] = useState<Date | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [otherCategoryDetails, setOtherCategoryDetails] = useState("");
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
            title: "",
            description: "",
            priority: "medium",
            estimatedCost: 0,
            productSku: "",
            productName: "",
            issueCategory: "",
            assignedUserId: "none",
            customerId: "none",
            orderId: "none",
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
                title: "Reparatie aangemaakt",
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
        setOrderSearch("");
        setSlaDeadline(null);
        setSelectedFiles([]);
        setOtherCategoryDetails("");
        reset();
        onOpenChange(false);
    };

    const handleNext = () => {
        if (step === 2 && !watch("title")) {
            toast({ title: "Titel is verplicht", variant: "destructive" });
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

        const repairData = {
            title: data.title,
            description: data.description || undefined,
            priority: data.priority,
            estimatedCost: data.estimatedCost ? Math.round(data.estimatedCost * 100) : undefined,
            assignedUserId: (data.assignedUserId && data.assignedUserId !== "none") ? data.assignedUserId : undefined,
            slaDeadline: slaDeadline ? slaDeadline.toISOString() : undefined,
            productSku: data.productSku || undefined,
            productName: data.productName || undefined,
            issueCategory: data.issueCategory === "Overig" && otherCategoryDetails
                ? `Overig: ${otherCategoryDetails}`
                : data.issueCategory || undefined,
            customerId: selectedOrder?.customerId || undefined,
            orderId: selectedOrder?.id || undefined,
            customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim() : undefined,
            customerEmail: selectedCustomer?.email || selectedOrder?.customerEmail || undefined,
            orderNumber: selectedOrder?.orderNumber || undefined,
            status: "new",
            caseId: caseId,
            emailThreadId: emailThreadId,
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

    const filteredOrders = orders.filter((order) =>
        orderSearch
            ? order.orderNumber?.toLowerCase().includes(orderSearch.toLowerCase()) ||
            order.customerEmail?.toLowerCase().includes(orderSearch.toLowerCase())
            : true
    );

    const technicians = users.filter(u => u.role === 'TECHNICUS' || u.role === 'ADMIN');

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nieuwe Reparatie - Stap {step} van 4</DialogTitle>
                </DialogHeader>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center flex-1">
                            <div
                                className={`h-2 flex-1 rounded ${s <= step ? "bg-primary" : "bg-muted"}`}
                            />
                        </div>
                    ))}
                </div>

                {/* Step 1: Order Search */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium mb-2 block">Zoek Bestelling (Optioneel)</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Zoek op bestelnummer of email..."
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {filteredOrders.slice(0, 10).map((order) => (
                                <div
                                    key={order.id}
                                    className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedOrder?.id === order.id ? "border-primary bg-primary/5" : ""
                                        }`}
                                    onClick={() => {
                                        setSelectedOrder(order);
                                        setValue("orderId", order.id);
                                        setValue("customerId", order.customerId || "none");
                                    }}
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

                        {selectedOrder && (
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                                <p className="text-sm font-medium">Geselecteerd: Order #{selectedOrder.orderNumber}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Product & Issue Details */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Titel *</Label>
                            <Input
                                id="title"
                                placeholder="bijv. iPhone 12 scherm reparatie"
                                {...register("title", { required: "Titel is verplicht" })}
                            />
                            {errors.title && (
                                <p className="text-sm text-destructive">{errors.title.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="productSku">Artikelnummer</Label>
                                <Input
                                    id="productSku"
                                    placeholder="Artikelnummer"
                                    {...register("productSku")}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="productName">Product Naam</Label>
                                <Input
                                    id="productName"
                                    placeholder="Product naam"
                                    {...register("productName")}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Probleem Categorie</Label>
                            <Select
                                onValueChange={(value) => {
                                    setValue("issueCategory", value);
                                    if (value !== "Overig") {
                                        setOtherCategoryDetails("");
                                    }
                                }}
                                value={watch("issueCategory") || ""}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecteer categorie" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ISSUE_CATEGORIES.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {watch("issueCategory") === "Overig" && (
                            <div className="space-y-2">
                                <Label htmlFor="otherDetails">Specificeer het probleem</Label>
                                <Input
                                    id="otherDetails"
                                    placeholder="Beschrijf het probleem..."
                                    value={otherCategoryDetails}
                                    onChange={(e) => setOtherCategoryDetails(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="description">Beschrijving</Label>
                            <Textarea
                                id="description"
                                placeholder="Beschrijf het probleem en de vereisten..."
                                {...register("description")}
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Priority & Assignment */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Prioriteit</Label>
                                <Select
                                    onValueChange={(value) => setValue("priority", value as any)}
                                    value={watch("priority") || "medium"}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecteer prioriteit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Laag</SelectItem>
                                        <SelectItem value="medium">Gemiddeld</SelectItem>
                                        <SelectItem value="high">Hoog</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="estimatedCost">Geschatte Kosten (€)</Label>
                                <Input
                                    id="estimatedCost"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...register("estimatedCost", {
                                        valueAsNumber: true,
                                        min: { value: 0, message: "Kosten moeten positief zijn" }
                                    })}
                                />
                                {errors.estimatedCost && (
                                    <p className="text-sm text-destructive">{errors.estimatedCost.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Technicus</Label>
                            <Select
                                onValueChange={(value) => setValue("assignedUserId", value)}
                                value={watch("assignedUserId") || "none"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecteer technicus" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Niet toegewezen</SelectItem>
                                    {technicians.map((tech) => (
                                        <SelectItem key={tech.id} value={tech.id}>
                                            {tech.firstName || ''} {tech.lastName || ''} ({tech.username})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>SLA Deadline</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        className="w-full justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {slaDeadline ? format(slaDeadline, "PPP") : "Deadline instellen"}
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
                )}

                {/* Step 4: Photos & Review */}
                {step === 4 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-600 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <h3 className="font-medium">Controleer en Voltooien</h3>
                        </div>

                        {/* Review Summary */}
                        <div className="space-y-3">
                            {selectedOrder && (
                                <div className="p-4 bg-muted/50 rounded-lg">
                                    <h4 className="font-medium mb-2">Bestelling</h4>
                                    <p className="text-sm">Order #{selectedOrder.orderNumber}</p>
                                    <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
                                </div>
                            )}

                            <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">Product Details</h4>
                                <div className="text-sm space-y-1">
                                    <p><span className="font-medium">Titel:</span> {watch("title") || "Niet ingevuld"}</p>
                                    {watch("productSku") && <p><span className="font-medium">SKU:</span> {watch("productSku")}</p>}
                                    {watch("productName") && <p><span className="font-medium">Product:</span> {watch("productName")}</p>}
                                    {watch("issueCategory") && (
                                        <p><span className="font-medium">Categorie:</span> {watch("issueCategory")}</p>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">Prioriteit & Toewijzing</h4>
                                <div className="text-sm space-y-1">
                                    <p><span className="font-medium">Prioriteit:</span> {watch("priority")}</p>
                                    {watch("estimatedCost") > 0 && (
                                        <p><span className="font-medium">Geschatte kosten:</span> €{watch("estimatedCost").toFixed(2)}</p>
                                    )}
                                    {slaDeadline && (
                                        <p><span className="font-medium">Deadline:</span> {format(slaDeadline, "PPP")}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <Label>Foto's/Bijlagen ({selectedFiles.length}/10)</Label>
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Sleep bestanden hierheen of klik om te uploaden
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    JPG, PNG, PDF tot 10MB per bestand (max 10 bestanden)
                                </p>
                                <Input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="mt-2"
                                    accept="image/*,.pdf"
                                />
                            </div>

                            {selectedFiles.length > 0 && (
                                <div className="space-y-2 mt-2">
                                    {selectedFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between border p-2 rounded">
                                            <span className="text-sm truncate">{file.name}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeFile(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={step === 1 ? handleClose : handleBack}
                        disabled={createRepairMutation.isPending}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        {step === 1 ? "Annuleren" : "Terug"}
                    </Button>

                    {step < 4 ? (
                        <Button onClick={handleNext}>
                            Volgende
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleSubmit(onSubmit)}
                            disabled={createRepairMutation.isPending}
                        >
                            {createRepairMutation.isPending ? "Aanmaken..." : "Reparatie Aanmaken"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
