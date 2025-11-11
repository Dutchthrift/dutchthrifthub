import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { InfoBanner } from "@/components/ui/info-banner";
import { KeyValue } from "@/components/ui/key-value";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { Loader2, Package, DollarSign, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Return, User as UserType } from "@shared/schema";

export default function ReturnDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: returnData, isLoading: isLoadingReturn } = useQuery<Return>({
    queryKey: ["/api/returns", id],
    queryFn: async () => {
      const response = await fetch(`/api/returns/${id}`);
      if (!response.ok) throw new Error("Failed to fetch return");
      return response.json();
    },
  });

  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error("Not authenticated");
      const data = await response.json();
      return data.user;
    },
  });

  if (isLoadingReturn) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="p-6">
        <InfoBanner variant="error">
          Return not found
        </InfoBanner>
      </div>
    );
  }

  const statusMap: Record<string, { variant: any; label: string }> = {
    pending: { variant: "return_in_progress", label: "Return in Progress" },
    received: { variant: "received_control", label: "Received" },
    approved: { variant: "approved_refund", label: "Approved" },
    rejected: { variant: "closed_not_received", label: "Rejected" },
    refunded: { variant: "paid", label: "Refunded" },
  };

  const statusInfo = statusMap[returnData.status] || { variant: "default", label: returnData.status };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={`Return #${returnData.returnNumber}`}
        subtitle={returnData.createdAt ? `Created ${formatDistanceToNow(new Date(returnData.createdAt), { addSuffix: true })}` : ""}
        badge={<StatusChip variant={statusInfo.variant} label={statusInfo.label} />}
      />

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Return Status Banner */}
            <InfoBanner variant="brand" title="Return in Progress">
              This return is currently being processed. The customer will be notified once it's complete.
            </InfoBanner>

            {/* Return Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Return Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <KeyValue label="Return Number" value={returnData.returnNumber} />
                <KeyValue label="Order ID" value={returnData.orderId || "N/A"} />
                <KeyValue label="Status" value={<StatusChip variant={statusInfo.variant} label={statusInfo.label} />} />
                <KeyValue label="Reason" value={returnData.returnReason || returnData.otherReason || "Not specified"} />
                {returnData.trackingNumber && (
                  <KeyValue label="Tracking Number" value={returnData.trackingNumber} />
                )}
              </CardContent>
            </Card>

            {/* Payment Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment & Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <KeyValue label="Refund Amount" value={returnData.refundAmount ? `€${(returnData.refundAmount / 100).toFixed(2)}` : "€0.00"} valueClassName="text-green-600 dark:text-green-400 font-semibold" />
                <KeyValue label="Refund Status" value={returnData.refundStatus || "Pending"} />
                {returnData.completedAt && (
                  <KeyValue label="Completed" value={formatDistanceToNow(new Date(returnData.completedAt), { addSuffix: true })} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Customer Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KeyValue vertical label="Customer ID" value={returnData.customerId || "Not provided"} />
              </CardContent>
            </Card>

            {/* Universal Notes Panel */}
            {currentUser && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes & Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <NotesPanel
                    entityType="return"
                    entityId={id!}
                    currentUser={currentUser}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
