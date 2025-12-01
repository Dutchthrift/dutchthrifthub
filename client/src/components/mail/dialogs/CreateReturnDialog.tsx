import { CreateReturnModal } from "@/components/forms/create-return-modal";

interface CreateReturnDialogProps {
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

export function CreateReturnDialog({
    open,
    onOpenChange,
    emailThread,
    caseId
}: CreateReturnDialogProps) {
    return (
        <CreateReturnModal
            open={open}
            onOpenChange={onOpenChange}
            customerId={emailThread?.customerId}
            caseId={caseId}
            emailThreadId={emailThread?.id}
            onReturnCreated={() => {
                // Optionally refresh queries or show success
                onOpenChange(false);
            }}
        />
    );
}
