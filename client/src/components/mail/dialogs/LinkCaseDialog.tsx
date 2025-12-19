import { LinkEntityDialog } from "./LinkEntityDialog";
import { Badge } from "@/components/ui/badge";

interface Case {
    id: string;
    caseNumber: number;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    customer?: {
        firstName: string;
        lastName: string;
    };
    order?: {
        orderNumber: string;
    };
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
            renderItem={(caseItem, isSelected) => {
                const customerName = caseItem.customer ?
                    `${caseItem.customer.firstName} ${caseItem.customer.lastName}` : '';
                const orderInfo = caseItem.order ? `Order #${caseItem.order.orderNumber}` : '';
                const extraInfo = [customerName, orderInfo].filter(Boolean).join(' - ');

                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                            <span className="font-medium">#{caseItem.caseNumber} {caseItem.title}</span>
                            <Badge variant={caseItem.status === 'resolved' ? 'secondary' : 'default'} className="ml-2 shrink-0">
                                {caseItem.status}
                            </Badge>
                        </div>
                        {extraInfo && (
                            <div className="text-sm font-medium text-primary/80">
                                {extraInfo}
                            </div>
                        )}
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-[10px] h-5">{caseItem.priority}</Badge>
                            <span>{new Date(caseItem.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                );
            }}
        />
    );
}
