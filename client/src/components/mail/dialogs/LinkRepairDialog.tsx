import { LinkEntityDialog } from "./LinkEntityDialog";
import { Badge } from "@/components/ui/badge";

interface Repair {
    id: string;
    repairNumber: string; // Assuming repairs have a number
    title: string;
    status: string;
    deviceType: string;
    createdAt: string;
}

interface LinkRepairDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLink: (repair: Repair) => Promise<void>;
}

export function LinkRepairDialog({ open, onOpenChange, onLink }: LinkRepairDialogProps) {
    const searchRepairs = async (query: string): Promise<Repair[]> => {
        // If no query, fetch latest 20 repairs
        const searchParam = query ? `search=${encodeURIComponent(query)}&` : '';
        const res = await fetch(`/api/repairs?${searchParam}limit=20`);
        if (!res.ok) throw new Error("Failed to search repairs");
        const data = await res.json();
        return Array.isArray(data) ? data : (data.data || data.repairs || []);
    };

    return (
        <LinkEntityDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Reparatie Koppelen"
            description="Zoek een reparatie om te koppelen aan deze email."
            searchPlaceholder="Zoek op reparatie nummer of apparaat..."
            onLink={onLink}
            searchFn={searchRepairs}
            renderItem={(repair, isSelected) => (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">#{repair.repairNumber || repair.id.substring(0, 8)}</span>
                        <Badge variant="outline">{repair.status}</Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{repair.title || repair.deviceType}</span>
                        <span>{new Date(repair.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            )}
        />
    );
}
