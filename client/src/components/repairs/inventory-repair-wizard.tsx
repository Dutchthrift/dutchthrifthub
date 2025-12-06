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
import { ChevronLeft, ChevronRight, CalendarIcon, Upload, X, CheckCircle, Package } from "lucide-react";
import { format } from "date-fns";
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
    estimatedCost: number;
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
            estimatedCost: 0,
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
                title: "Inkoopreparatie aangemaakt",
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
        if (step === 1 && !watch("productName") && !watch("brandModel")) {
            toast({ title: "Vul product/model in", variant: "destructive" });
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
            estimatedCost: data.estimatedCost ? Math.round(data.estimatedCost * 100) : undefined,
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-amber-600" />
                        Nieuwe Inkoopreparatie - Stap {step} van 3
                    </DialogTitle>
                </DialogHeader>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center flex-1">
                            <div
                                className={`h-2 flex-1 rounded ${s <= step ? "bg-amber-500" : "bg-muted"}`}
                            />
                        </div>
                    ))}
                </div>

                {/* Step 1: Product Details */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                <strong>Inkoopreparatie:</strong> Voor tweedehands ingekochte camera's en lenzen die gerepareerd moeten worden voor doorverkoop.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="title">Titel *</Label>
                            <Input
                                id="title"
                                placeholder="bijv. Canon 5D Mark III - Sluiter vervangen"
                                {...register("title", { required: "Titel is verplicht" })}
                            />
                            {errors.title && (
                                <p className="text-sm text-destructive">{errors.title.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="brandModel">Merk & Model *</Label>
                                <Input
                                    id="brandModel"
                                    placeholder="bijv. Canon EOS 5D Mark III"
                                    {...register("brandModel")}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="productName">Productnaam</Label>
                                <Input
                                    id="productName"
                                    placeholder="bijv. Full-frame DSLR"
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
                                placeholder="Beschrijf het probleem en wat er gerepareerd moet worden..."
                                {...register("description")}
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: Priority & Assignment */}
                {step === 2 && (
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
                            <Label>Deadline (optioneel)</Label>
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

                {/* Step 3: Photos & Review */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-600 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <h3 className="font-medium">Controleer en Voltooien</h3>
                        </div>

                        {/* Review Summary */}
                        <div className="space-y-3">
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Product Details
                                </h4>
                                <div className="text-sm space-y-1">
                                    <p><span className="font-medium">Titel:</span> {watch("title") || "Niet ingevuld"}</p>
                                    {watch("brandModel") && <p><span className="font-medium">Merk/Model:</span> {watch("brandModel")}</p>}
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

                    {step < 3 ? (
                        <Button onClick={handleNext} className="bg-amber-600 hover:bg-amber-700">
                            Volgende
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleSubmit(onSubmit)}
                            disabled={createRepairMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            {createRepairMutation.isPending ? "Aanmaken..." : "Inkoopreparatie Aanmaken"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
