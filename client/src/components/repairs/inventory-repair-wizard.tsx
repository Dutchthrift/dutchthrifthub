import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
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
import {
    ChevronLeft,
    ChevronRight,
    CalendarIcon,
    Upload,
    X,
    CheckCircle,
    Package,
    Camera,
    Wrench,
    Settings
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { User } from "@shared/schema";

interface InventoryRepairWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: User[];
}

interface FormData {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    productName: string;
    brandModel: string;
    issueCategory: string;
    assignedUserId: string;
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
    "Algemene inspectie",
    "Overig",
];

const PRIORITY_OPTIONS = [
    { value: "low", label: "Laag", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { value: "medium", label: "Normaal", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    { value: "high", label: "Hoog", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

const STEP_ICONS = [Camera, Settings, CheckCircle];
const STEP_LABELS = ["Product", "Details", "Bevestig"];

export function InventoryRepairWizard({ open, onOpenChange, users }: InventoryRepairWizardProps) {
    const [step, setStep] = useState(1);
    const [slaDeadline, setSlaDeadline] = useState<Date | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [otherCategoryDetails, setOtherCategoryDetails] = useState("");
    const { toast } = useToast();

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
            productName: "",
            brandModel: "",
            issueCategory: "",
            assignedUserId: "none",
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
                title: "✅ Inkoopreparatie aangemaakt",
                description: "De inkoopreparatie is succesvol aangemaakt.",
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
        setSlaDeadline(null);
        setSelectedFiles([]);
        setOtherCategoryDetails("");
        reset();
        onOpenChange(false);
    };

    const handleNext = () => {
        if (step === 1 && !watch("brandModel")) {
            toast({ title: "Merk & Model is verplicht", variant: "destructive" });
            return;
        }
        if (step === 1 && !watch("title")) {
            toast({ title: "Titel is verplicht", variant: "destructive" });
            return;
        }
        setStep(step + 1);
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const onSubmit = (data: FormData) => {
        const repairData = {
            title: data.title,
            description: data.description || undefined,
            priority: data.priority,
            assignedUserId: (data.assignedUserId && data.assignedUserId !== "none") ? data.assignedUserId : undefined,
            slaDeadline: slaDeadline ? slaDeadline.toISOString() : undefined,
            productName: data.productName || data.brandModel || undefined,
            issueCategory: data.issueCategory === "Overig" && otherCategoryDetails
                ? `Overig: ${otherCategoryDetails}`
                : data.issueCategory || undefined,
            status: "new",
            repairType: "inventory",
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

    const technicians = users.filter(u => u.role === 'TECHNICUS' || u.role === 'ADMIN');

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-base font-semibold flex items-center gap-2">
                        <Package className="h-4 w-4 text-amber-500" />
                        Nieuwe Inkoopreparatie
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
                                        ${isActive ? 'bg-amber-500 text-white ring-2 ring-amber-200' : ''}
                                        ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : ''}
                                    `}>
                                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                                    </div>
                                    <span className={`text-[10px] mt-1 ${isActive ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
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

                {/* Step 1: Product Details */}
                {step === 1 && (
                    <div className="space-y-3">
                        {/* Info banner */}
                        <div className="p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                <strong>Inkoopreparatie:</strong> Voor ingekochte camera's en lenzen die gerepareerd moeten worden.
                            </p>
                        </div>

                        <div>
                            <Label className="text-xs">Titel *</Label>
                            <Input
                                placeholder="bijv. Canon 5D Mark III - Sluiter vervangen"
                                {...register("title", { required: "Titel is verplicht" })}
                                className="h-8 text-sm mt-1"
                            />
                            {errors.title && (
                                <p className="text-xs text-destructive mt-0.5">{errors.title.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Merk & Model *</Label>
                                <Input
                                    placeholder="bijv. Canon EOS 5D Mark III"
                                    {...register("brandModel")}
                                    className="h-8 text-sm mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Producttype</Label>
                                <Input
                                    placeholder="bijv. Full-frame DSLR"
                                    {...register("productName")}
                                    className="h-8 text-sm mt-1"
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs">Probleem Categorie</Label>
                            <Select
                                onValueChange={(value) => {
                                    setValue("issueCategory", value);
                                    if (value !== "Overig") {
                                        setOtherCategoryDetails("");
                                    }
                                }}
                                value={watch("issueCategory") || ""}
                            >
                                <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder="Selecteer categorie" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ISSUE_CATEGORIES.map((category) => (
                                        <SelectItem key={category} value={category} className="text-xs">
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {watch("issueCategory") === "Overig" && (
                            <div>
                                <Label className="text-xs">Specificeer probleem</Label>
                                <Input
                                    placeholder="Beschrijf het probleem..."
                                    value={otherCategoryDetails}
                                    onChange={(e) => setOtherCategoryDetails(e.target.value)}
                                    className="h-8 text-sm mt-1"
                                />
                            </div>
                        )}

                        <div>
                            <Label className="text-xs">Beschrijving</Label>
                            <Textarea
                                placeholder="Wat moet er gerepareerd worden..."
                                {...register("description")}
                                className="text-sm min-h-[60px] mt-1"
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: Priority & Assignment */}
                {step === 2 && (
                    <div className="space-y-3">
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
                    </div>
                )}

                {/* Step 3: Review & Photos */}
                {step === 3 && (
                    <div className="space-y-3">
                        {/* Product Info */}
                        <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Camera className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Product</span>
                            </div>
                            <p className="text-sm font-medium">{watch("title")}</p>
                            <p className="text-xs text-muted-foreground">{watch("brandModel")}</p>
                            {watch("issueCategory") && (
                                <p className="text-xs text-muted-foreground mt-1">Categorie: {watch("issueCategory")}</p>
                            )}
                        </div>

                        {/* Details */}
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Wrench className="h-4 w-4 text-purple-600" />
                                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Details</span>
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
                                    <p><span className="text-muted-foreground">Omschrijving:</span> {watch("description")}</p>
                                )}
                            </div>
                        </div>

                        {/* File Upload */}
                        <div>
                            <Label className="text-xs">Foto's (optioneel)</Label>
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center mt-1">
                                <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">
                                    Max 10 bestanden
                                </p>
                                <Input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="mt-2 h-8 text-xs"
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
                                                className="h-6 w-6 p-0"
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
                        <Button onClick={handleNext} size="sm" className="h-8 text-sm bg-amber-500 hover:bg-amber-600">
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
                            {createRepairMutation.isPending ? "Aanmaken..." : "✓ Aanmaken"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
