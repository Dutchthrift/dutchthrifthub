import { LinkEntityDialog } from "./LinkEntityDialog";
import { Badge } from "@/components/ui/badge";

interface Case {
    id: string;
    caseNumber: number;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
}

interface LinkCaseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLink: (caseItem: Case) => Promise<void>;
}

export function LinkCaseDialog({ open, onOpenChange, onLink }: LinkCaseDialogProps) {
    const searchCases = async (query: string): Promise<Case[]> => {
        // If no query, fetch latest 20 cases
        const searchParam = query ? `q=${encodeURIComponent(query)}&` : '';
        const res = await fetch(`/api/cases?${searchParam}limit=20`);
        if (!res.ok) throw new Error("Failed to search cases");
        const data = await res.json();
        return Array.isArray(data) ? data : (data.data || data.cases || []);
    };

    return (
        <LinkEntityDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Case Koppelen"
            description="Zoek een case om te koppelen aan deze email."
            searchPlaceholder="Zoek op case nummer of titel..."
            onLink={onLink}
            searchFn={searchCases}
            renderItem={(caseItem, isSelected) => (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">#{caseItem.caseNumber} {caseItem.title}</span>
                        <Badge variant={caseItem.status === 'resolved' ? 'secondary' : 'default'}>
                            {caseItem.status}
                        </Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{caseItem.priority}</Badge>
                        <span>{new Date(caseItem.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            )}
        />
    );
}
