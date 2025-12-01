import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SanitizedEmailContent } from "./sanitized-email-content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface EmailMessageBodyProps {
    messageId: string;
    uid: number;
    initialBody: string | null;
    isHtml: boolean;
}

export function EmailMessageBody({ messageId, uid, initialBody, isHtml }: EmailMessageBodyProps) {
    const [body, setBody] = useState<string | null>(initialBody);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchedIsHtml, setFetchedIsHtml] = useState(isHtml);

    useEffect(() => {
        // If we have a body, use it.
        // If initialBody is empty/null and we have a UID, fetch it.
        if ((!initialBody || initialBody.trim() === "") && uid) {
            fetchBody();
        } else {
            setBody(initialBody);
            setFetchedIsHtml(isHtml);
        }
    }, [messageId, uid, initialBody, isHtml]);

    const fetchBody = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/emails/${uid}/body`);
            if (!response.ok) {
                throw new Error("Failed to fetch email body");
            }
            const data = await response.json();
            setBody(data.body);
            setFetchedIsHtml(data.isHtml);
        } catch (err) {
            console.error("Error fetching email body:", err);
            setError("Failed to load email content.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-2 py-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[80%]" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="my-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center gap-2">
                    {error}
                    <button
                        onClick={fetchBody}
                        className="underline hover:text-destructive-foreground font-medium"
                    >
                        Retry
                    </button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <SanitizedEmailContent
            body={body || ""}
            isHtml={fetchedIsHtml}
        />
    );
}
