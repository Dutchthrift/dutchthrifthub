import { LinkEntityDialog } from "./LinkEntityDialog";
import { Badge } from "@/components/ui/badge";

interface Return {
    id: string;
    returnNumber: string; // Assuming returns have a number or ID
    status: string;
    reason: string;
    createdAt: string;
}

interface LinkReturnDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLink: (returnItem: Return) => Promise<void>;
}

export function LinkReturnDialog({ open, onOpenChange, onLink }: LinkReturnDialogProps) {
    const searchReturns = async (query: string): Promise<Return[]> => {
        // If no query, fetch latest 20 returns
        const searchParam = query ? `search=${encodeURIComponent(query)}&` : '';
        const res = await fetch(`/api/returns?${searchParam}limit=20`);
        if (!res.ok) throw new Error("Failed to search returns");
        const data = await res.json();
        return Array.isArray(data) ? data : (data.data || data.returns || []);
    };

    return (
        <LinkEntityDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Retour Koppelen"
            description="Zoek een retour om te koppelen aan deze email."
            searchPlaceholder="Zoek op retour nummer..."
            onLink={onLink}
            searchFn={searchReturns}
            renderItem={(returnItem, isSelected) => (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">#{returnItem.returnNumber || returnItem.id.substring(0, 8)}</span>
                        <Badge variant="outline">{returnItem.status}</Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{returnItem.reason}</span>
                        <span>{new Date(returnItem.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            )}
        />
    );
}
