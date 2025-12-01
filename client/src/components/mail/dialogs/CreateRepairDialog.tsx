import { CreateRepairWizard } from "@/components/repairs/create-repair-wizard";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface CreateRepairDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    emailThread?: {
        id: string;
        subject: string;
        customerEmail: string;
        customerId?: string;
    };
    caseId?: string;
}

export function CreateRepairDialog({
    open,
    onOpenChange,
    emailThread,
    caseId
}: CreateRepairDialogProps) {
    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['/api/users'],
        enabled: open,
    });

    return (
        <CreateRepairWizard
            open={open}
            onOpenChange={onOpenChange}
            users={users}
            caseId={caseId}
            emailThreadId={emailThread?.id}
        />
    );
}
