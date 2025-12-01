import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    Package,
    User as UserIcon,
    Calendar,
    Mail,
    ShoppingCart,
    Image as ImageIcon,
    Activity,
    FileText,
    Archive,
    Edit,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { NotesPanel } from "@/components/notes/NotesPanel";
import type { User } from "@shared/schema";
import { ReturnQuickActions } from "@/components/returns/return-quick-actions";
import { ReturnPhotoGallery } from "@/components/returns/return-photo-gallery";
import { ReturnTimeline } from "@/components/returns/return-timeline";
import { EditReturnDialog } from "@/components/returns/edit-return-dialog";

interface ReturnItem {
    id: string;
    returnId: string;
    productName: string;
    sku: string | null;
    quantity: number;
    reason: string;
    condition: string | null;
    refundAmount: number | null;
    notes: string | null;
    unitPrice: number | null;
    restockable: boolean | null;
}

interface Return {
    id: string;
    returnNumber: string;
    customerId: string;
    orderId: string | null;
    status: string;
    returnReason: string;
    otherReason: string | null;
    priority: string;
    assignedUserId: string | null;
    trackingNumber: string | null;
    receivedAt: string | null;
    requestedAt: string;
    completedAt: string | null;
    refundAmount: number | null;
    refundMethod: string | null;
    refundStatus: string | null;
    photoUrls: string[] | null;
    customerNotes: string | null;
    createdAt: string;
    updatedAt: string;
    isArchived: boolean | null;
}

interface EnrichedReturnData {
    return: Return;
    order: any;
    customer: any;
    returnItems: ReturnItem[];
    assignedUser: {
        id: string;
        fullName: string;
        email: string;
    } | null;
}

const STATUS_OPTIONS = [
    { value: "nieuw_onderweg", label: "Nieuw/Onderweg" },
    { value: "ontvangen_controle", label: "Ontvangen - Controle" },
    { value: "akkoord_terugbetaling", label: "Akkoord - Terugbetaling" },
    { value: "vermiste_pakketten", label: "Vermiste Pakketten" },
    { value: "wachten_klant", label: "Wachten op Klant" },
    { value: "opnieuw_versturen", label: "Opnieuw Versturen" },
    { value: "klaar", label: "Klaar" },
    { value: "niet_ontvangen", label: "Niet Ontvangen" },
];

function getStatusColor(status: string) {
    switch (status) {
        case "nieuw_onderweg":
            return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200";
        case "ontvangen_controle":
            return "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-200";
        case "akkoord_terugbetaling":
        case "klaar":
            return "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200";
        case "vermiste_pakketten":
            return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200";
        case "wachten_klant":
            return "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200";
        case "opnieuw_versturen":
            return "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200";
        default:
            return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200";
    }
}

function getPriorityColor(priority: string) {
    switch (priority) {
        case "urgent":
            return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200";
        case "high":
            return "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-200";
        case "medium":
            return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200";
        default:
            return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200";
    }
}

export default function ReturnDetailPage() {
    const params = useParams();
    const returnId = params.id;
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [showEditDialog, setShowEditDialog] = useState(false);

    const { data: enrichedData, isLoading } = useQuery<EnrichedReturnData>({
        queryKey: ["/api/returns", returnId],
        enabled: !!returnId,
    });

    const { data: currentUser } = useQuery<User>({
        queryKey: ["/api/auth/session"],
        queryFn: async () => {
            const response = await fetch("/api/auth/session");
            if (!response.ok) throw new Error("Not authenticated");
            const data = await response.json();
            return data.user;
        },
    });

    const updateReturnMutation = useMutation({
        mutationFn: async (data: Partial<Return>) => {
            const response = await fetch(`/api/returns/${returnId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            if (!response.ok) throw new Error("Failed to update return");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
            queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
            toast({ title: "Return updated successfully" });
            setShowEditDialog(false);
        },
        onError: () => {
            toast({
                title: "Update failed",
                description: "Failed to update return",
                variant: "destructive",
            });
        },
    });

    if (isLoading || !enrichedData) {
        return (
            <div className="flex flex-col h-screen bg-background">
                <Navigation />
                <main className="flex-1 overflow-y-auto">
                    <div className="container mx-auto p-6 max-w-7xl">
                        <div className="animate-pulse space-y-4">
                            <div className="h-8 bg-muted rounded w-1/4"></div>
                            <div className="h-64 bg-muted rounded"></div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const returnData = enrichedData.return;
    const statusLabel = STATUS_OPTIONS.find((s) => s.value === returnData.status)?.label || returnData.status;

    const formatCurrency = (cents: number | null) => {
        if (!cents) return "-";
        return `€${(cents / 100).toFixed(2)}`;
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            <Navigation />

            <main className="flex-1 overflow-y-auto">
                <div className="container mx-auto p-6 max-w-7xl">
                    {/* Header with Breadcrumb */}
                    <div className="mb-6">
                        <Button
                            variant="ghost"
                            onClick={() => setLocation("/returns")}
                            className="mb-4"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Returns
                        </Button>

                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-3xl font-bold">{returnData.returnNumber}</h1>
                                <p className="text-muted-foreground mt-1">
                                    Created {format(new Date(returnData.createdAt), "PPP")}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowEditDialog(true)}
                                >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Return
                                </Button>
                                <Badge className={getPriorityColor(returnData.priority)}>
                                    {returnData.priority.charAt(0).toUpperCase() + returnData.priority.slice(1)}
                                </Badge>
                                <Badge className={getStatusColor(returnData.status)}>
                                    {statusLabel}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Bar */}
                    <ReturnQuickActions
                        returnData={returnData}
                        onUpdate={(data) => updateReturnMutation.mutate(data)}
                        isUpdating={updateReturnMutation.isPending}
                    />

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Return Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Return Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <span className="text-sm text-muted-foreground">Return Number</span>
                                    <p className="font-medium">{returnData.returnNumber}</p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">Reason</span>
                                    <p className="font-medium">
                                        {returnData.returnReason === "wrong_item" ? "Wrong Item" :
                                            returnData.returnReason === "damaged" ? "Damaged" :
                                                returnData.returnReason === "defective" ? "Defective" :
                                                    returnData.returnReason === "size_issue" ? "Size Issue" :
                                                        returnData.returnReason === "changed_mind" ? "Changed Mind" :
                                                            returnData.returnReason === "other" ? returnData.otherReason || "Other" :
                                                                returnData.returnReason}
                                    </p>
                                </div>
                                {returnData.trackingNumber && (
                                    <div>
                                        <span className="text-sm text-muted-foreground">Tracking Number</span>
                                        <p className="font-mono text-sm">{returnData.trackingNumber}</p>
                                    </div>
                                )}
                                {returnData.receivedAt && (
                                    <div>
                                        <span className="text-sm text-muted-foreground">Received</span>
                                        <p className="font-medium">{format(new Date(returnData.receivedAt), "PPP")}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Customer Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <UserIcon className="h-4 w-4" />
                                    Customer
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {enrichedData.customer ? (
                                    <>
                                        <div>
                                            <span className="text-sm text-muted-foreground">Name</span>
                                            <p className="font-medium">
                                                {enrichedData.customer.firstName} {enrichedData.customer.lastName}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-muted-foreground">Email</span>
                                            <p className="font-medium">{enrichedData.customer.email}</p>
                                        </div>
                                        {enrichedData.customer.phone && (
                                            <div>
                                                <span className="text-sm text-muted-foreground">Phone</span>
                                                <p className="font-medium">{enrichedData.customer.phone}</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No customer information</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Order Information */}
                        {enrichedData.order && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" />
                                        Original Order
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <span className="text-sm text-muted-foreground">Order Number</span>
                                        <p className="font-medium">#{enrichedData.order.orderNumber}</p>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Order Date</span>
                                        <p className="font-medium">
                                            {enrichedData.order.orderDate
                                                ? format(new Date(enrichedData.order.orderDate), "PPP")
                                                : "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Total Amount</span>
                                        <p className="font-medium">{formatCurrency(enrichedData.order.totalAmount)}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => window.open(`/orders?orderId=${enrichedData.order.id}`, "_blank")}
                                    >
                                        View Order
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Tabs Section */}
                    <Tabs defaultValue="items" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="items">
                                <Package className="h-4 w-4 mr-2" />
                                Items ({enrichedData.returnItems?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="photos">
                                <ImageIcon className="h-4 w-4 mr-2" />
                                Photos
                            </TabsTrigger>
                            <TabsTrigger value="notes">
                                <FileText className="h-4 w-4 mr-2" />
                                Notes
                            </TabsTrigger>
                            <TabsTrigger value="timeline">
                                <Activity className="h-4 w-4 mr-2" />
                                Timeline
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="items">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Return Items</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {enrichedData.returnItems && enrichedData.returnItems.length > 0 ? (
                                        <div className="space-y-3">
                                            {enrichedData.returnItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-4 border rounded-lg"
                                                >
                                                    <div className="flex-1">
                                                        <h4 className="font-medium">{item.productName}</h4>
                                                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                            {item.sku && <span>SKU: {item.sku}</span>}
                                                            <span>Qty: {item.quantity}</span>
                                                            {item.condition && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {item.condition}
                                                                </Badge>
                                                            )}
                                                            {item.restockable && (
                                                                <Badge variant="outline" className="text-xs bg-green-50">
                                                                    Restockable
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {item.unitPrice && (
                                                        <div className="text-right">
                                                            <p className="font-medium">{formatCurrency(item.unitPrice)}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                Total: {formatCurrency(item.unitPrice * item.quantity)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">No items</p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="photos">
                            <ReturnPhotoGallery returnId={returnId!} photos={returnData.photoUrls || []} />
                        </TabsContent>

                        <TabsContent value="notes">
                            {currentUser && (
                                <NotesPanel
                                    entityType="return"
                                    entityId={returnId!}
                                    currentUser={currentUser}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="timeline">
                            <ReturnTimeline returnId={returnId!} returnData={returnData} />
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            {/* Edit Return Dialog */}
            <EditReturnDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                returnData={returnData}
                onSave={(data) => updateReturnMutation.mutate(data)}
                isSaving={updateReturnMutation.isPending}
            />
        </div>
    );
}
