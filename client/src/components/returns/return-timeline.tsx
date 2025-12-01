import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Package, User, Image, FileText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ReturnTimelineProps {
    returnId: string;
    returnData: any;
}

export function ReturnTimeline({ returnId, returnData }: ReturnTimelineProps) {
    const events = [];

    // Return created
    if (returnData.createdAt) {
        events.push({
            icon: <Package className="h-4 w-4" />,
            title: "Return Created",
            description: `Return ${returnData.returnNumber} was created`,
            timestamp: returnData.createdAt,
            type: "created",
        });
    }

    // Status changes (we'll track this in future with proper activity logging)
    if (returnData.receivedAt) {
        events.push({
            icon: <Package className="h-4 w-4" />,
            title: "Return Received",
            description: "Return package was received and logged",
            timestamp: returnData.receivedAt,
            type: "received",
        });
    }

    // Assignment
    if (returnData.assignedUserId) {
        events.push({
            icon: <User className="h-4 w-4" />,
            title: "User Assigned",
            description: "Return was assigned to a team member",
            timestamp: returnData.updatedAt,
            type: "assigned",
        });
    }

    // Photos
    if (returnData.photoUrls && returnData.photoUrls.length > 0) {
        events.push({
            icon: <Image className="h-4 w-4" />,
            title: "Photos Uploaded",
            description: `${returnData.photoUrls.length} photo(s) added`,
            timestamp: returnData.updatedAt,
            type: "photos",
        });
    }

    // Completed
    if (returnData.completedAt) {
        events.push({
            icon: <Activity className="h-4 w-4" />,
            title: "Return Completed",
            description: "Return was marked as complete",
            timestamp: returnData.completedAt,
            type: "completed",
        });
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
                {events.length > 0 ? (
                    <div className="space-y-4">
                        {events.map((event, index) => (
                            <div key={index} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
                                        {event.icon}
                                    </div>
                                    {index < events.length - 1 && (
                                        <div className="w-px flex-1 bg-border mt-2" />
                                    )}
                                </div>
                                <div className="flex-1 pb-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-medium">{event.title}</h4>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{event.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {format(new Date(event.timestamp), "PPP 'at' p")}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
