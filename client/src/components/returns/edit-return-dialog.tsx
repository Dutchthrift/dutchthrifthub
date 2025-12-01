import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const editReturnSchema = z.object({
    returnReason: z.enum(["wrong_item", "damaged", "defective", "size_issue", "changed_mind", "other"]).optional(),
    otherReason: z.string().optional(),
    trackingNumber: z.string().optional(),
    customerNotes: z.string().optional(),
    internalNotes: z.string().optional(),
    conditionNotes: z.string().optional(),
});

type EditReturnFormValues = z.infer<typeof editReturnSchema>;

interface EditReturnDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    returnData: any;
    onSave: (data: EditReturnFormValues) => void;
    isSaving: boolean;
}

export function EditReturnDialog({
    open,
    onOpenChange,
    returnData,
    onSave,
    isSaving,
}: EditReturnDialogProps) {
    const form = useForm<EditReturnFormValues>({
        resolver: zodResolver(editReturnSchema),
        defaultValues: {
            returnReason: returnData.returnReason || undefined,
            otherReason: returnData.otherReason || "",
            trackingNumber: returnData.trackingNumber || "",
            customerNotes: returnData.customerNotes || "",
            internalNotes: returnData.internalNotes || "",
            conditionNotes: returnData.conditionNotes || "",
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        onSave(data);
    });

    const returnReason = form.watch("returnReason");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Return</DialogTitle>
                    <DialogDescription>
                        Update return details for {returnData.returnNumber}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Return Reason */}
                    <div className="space-y-2">
                        <Label htmlFor="returnReason">Return Reason</Label>
                        <Select
                            value={form.watch("returnReason") || ""}
                            onValueChange={(value) => form.setValue("returnReason", value as any)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                <SelectItem value="damaged">Damaged</SelectItem>
                                <SelectItem value="defective">Defective</SelectItem>
                                <SelectItem value="size_issue">Size Issue</SelectItem>
                                <SelectItem value="changed_mind">Changed Mind</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Other Reason (if "other" selected) */}
                    {returnReason === "other" && (
                        <div className="space-y-2">
                            <Label htmlFor="otherReason">Other Reason</Label>
                            <Input
                                id="otherReason"
                                {...form.register("otherReason")}
                                placeholder="Please specify..."
                            />
                        </div>
                    )}

                    {/* Tracking Number */}
                    <div className="space-y-2">
                        <Label htmlFor="trackingNumber">Tracking Number</Label>
                        <Input
                            id="trackingNumber"
                            {...form.register("trackingNumber")}
                            placeholder="Enter tracking number"
                        />
                    </div>

                    {/* Customer Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="customerNotes">Customer Notes</Label>
                        <Textarea
                            id="customerNotes"
                            {...form.register("customerNotes")}
                            placeholder="Notes from the customer..."
                            rows={3}
                        />
                    </div>

                    {/* Internal Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="internalNotes">Internal Notes</Label>
                        <Textarea
                            id="internalNotes"
                            {...form.register("internalNotes")}
                            placeholder="Internal notes (not visible to customer)..."
                            rows={3}
                        />
                    </div>

                    {/* Condition Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="conditionNotes">Condition Notes</Label>
                        <Textarea
                            id="conditionNotes"
                            {...form.register("conditionNotes")}
                            placeholder="Notes about the condition after inspection..."
                            rows={3}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
