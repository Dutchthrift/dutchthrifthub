import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeft,
    Package,
    Edit,
    Save,
    X,
    User,
    Mail,
    Phone,
    Truck,
    ExternalLink,
    Clock,
    CheckCircle2,
    Circle,
    MessageSquare,
    AlertTriangle,
    ShoppingBag,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { NotesPanel } from "@/components/notes/NotesPanel";
import type { User as UserType, Return, ReturnItem } from "@shared/schema";
import { EditReturnDialog } from "@/components/returns/edit-return-dialog";

// Status flow for timeline
const STATUS_FLOW = [
    { value: "nieuw", label: "Nieuw" },
    { value: "onderweg", label: "Onderweg" },
    { value: "ontvangen_controle", label: "Ontvangen" },
    { value: "akkoord_terugbetaling", label: "Akkoord" },
    { value: "klaar", label: "Klaar" },
];

const STATUS_OPTIONS = [
    { value: "nieuw", label: "Nieuw" },
    { value: "onderweg", label: "Onderweg" },
    { value: "ontvangen_controle", label: "Ontvangen" },
    { value: "akkoord_terugbetaling", label: "Akkoord" },
    { value: "vermiste_pakketten", label: "Vermist" },
    { value: "wachten_klant", label: "Wacht op Klant" },
    { value: "opnieuw_versturen", label: "Opnieuw Versturen" },
    { value: "klaar", label: "Klaar" },
    { value: "niet_ontvangen", label: "Niet Ontvangen" },
];

const STATUS_COLORS: Record<string, string> = {
    nieuw: "bg-amber-500 border-amber-500",
    onderweg: "bg-blue-500 border-blue-500",
    ontvangen_controle: "bg-blue-500 border-blue-500",
    akkoord_terugbetaling: "bg-green-500 border-green-500",
    vermiste_pakketten: "bg-red-500 border-red-500",
    wachten_klant: "bg-yellow-500 border-yellow-500",
    opnieuw_versturen: "bg-purple-500 border-purple-500",
    klaar: "bg-gray-500 border-gray-500",
    niet_ontvangen: "bg-gray-500 border-gray-500",
};

const REASON_LABELS: Record<string, string> = {
    wrong_item: "Verkeerd artikel",
    damaged: "Beschadigd",
    defective: "Defect",
    size_issue: "Maat probleem",
    changed_mind: "Bedacht",
    other: "Anders",
};

const CONDITION_LABELS: Record<string, string> = {
    unopened: "Ongeopend",
    opened_unused: "Geopend",
    used: "Gebruikt",
    damaged: "Beschadigd",
};

const getCarrierInfo = (tn: string | null) => {
    if (!tn) return null;
    const upper = tn.toUpperCase();
    if (upper.startsWith("3S") || upper.startsWith("JVGL")) {
        return { name: "PostNL", icon: "🟠", url: `https://postnl.nl/tracktrace/?B=${tn}` };
    }
    if (upper.startsWith("JJD") || upper.length === 20) {
        return { name: "DHL", icon: "🟡", url: `https://www.dhl.com/nl-nl/home/tracking/tracking-parcel.html?submit=1&tracking-id=${tn}` };
    }
    if (upper.startsWith("1Z")) {
        return { name: "UPS", icon: "🟤", url: `https://www.ups.com/track?tracknum=${tn}` };
    }
    return { name: "Carrier", icon: "📦", url: `https://track24.net/?code=${tn}` };
};

interface EnrichedReturnData {
    return: Return;
    order: any;
    customer: any;
    returnItems: ReturnItem[];
    assignedUser: { id: string; fullName: string; email: string } | null;
}

export default function ReturnDetailPage() {
    const params = useParams();
    const returnId = params.id;
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedData, setEditedData] = useState<any>({});

    const { data: enrichedData, isLoading } = useQuery<EnrichedReturnData>({
        queryKey: ["/api/returns", returnId],
        enabled: !!returnId,
    });

    const { data: currentUser } = useQuery<UserType>({
        queryKey: ["/api/auth/session"],
        queryFn: async () => {
            const res = await fetch("/api/auth/session");
            if (!res.ok) throw new Error("Not authenticated");
            return (await res.json()).user;
        },
    });

    const { data: allReturns = [] } = useQuery<Return[]>({ queryKey: ["/api/returns"] });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<Return>) => {
            const res = await fetch(`/api/returns/${returnId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
            queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
            toast({ title: "Retour bijgewerkt" });
            setIsEditMode(false);
        },
        onError: () => toast({ title: "Update mislukt", variant: "destructive" }),
    });

    if (isLoading || !enrichedData) {
        return (
            <div className="flex flex-col h-screen bg-background">
                <Navigation />
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="animate-pulse space-y-4 max-w-5xl mx-auto">
                        <div className="h-8 bg-muted rounded w-1/4" />
                        <div className="h-48 bg-muted rounded" />
                    </div>
                </main>
            </div>
        );
    }

    const ret = enrichedData.return;
    const order = enrichedData.order;
    const orderData = order?.orderData as any;
    const customer = orderData?.customer || enrichedData.customer;
    const shippingAddress = orderData?.shipping_address;
    const orderLineItems = orderData?.line_items || [];
    const returnItems = enrichedData.returnItems || [];
    const customerReturns = allReturns.filter(r => r.customerId === ret.customerId && r.id !== ret.id);

    const customerName = customer
        ? `${customer.first_name || customer.firstName || ''} ${customer.last_name || customer.lastName || ''}`.trim()
        : "Onbekend";
    const customerEmail = customer?.email;
    const customerPhone = customer?.phone || shippingAddress?.phone;
    const carrier = getCarrierInfo(ret.trackingNumber);
    const turnaroundDays = ret.requestedAt
        ? differenceInDays(ret.completedAt ? new Date(ret.completedAt) : new Date(), new Date(ret.requestedAt))
        : null;

    const fmt = (c: number | null) => c ? `€${(c / 100).toFixed(2)}` : "";
    const currentStatusIndex = STATUS_FLOW.findIndex(s => s.value === ret.status);
    const isSpecialStatus = currentStatusIndex === -1;

    const isReturnItem = (lineItem: any) => {
        return returnItems.some(ri =>
            ri.sku === lineItem.sku || ri.productName === lineItem.title || ri.productName === lineItem.name
        );
    };

    const handleEditStart = () => {
        setIsEditMode(true);
        setEditedData({ status: ret.status, trackingNumber: ret.trackingNumber || "" });
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            <Navigation />

            <main className="flex-1 overflow-y-auto">
                <div className="container mx-auto p-4 max-w-5xl space-y-4">
                    {/* HEADER */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" onClick={() => setLocation("/returns")}>
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Terug
                            </Button>
                            <h1 className="text-xl font-bold font-mono">
                                {ret.shopifyReturnName || ret.returnNumber}
                            </h1>
                            <Badge className={`${STATUS_COLORS[ret.status]} text-white border-0`}>
                                {STATUS_OPTIONS.find(s => s.value === ret.status)?.label || ret.status}
                            </Badge>
                            {turnaroundDays !== null && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {turnaroundDays}d
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditMode ? (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => updateMutation.mutate(editedData)} disabled={updateMutation.isPending}>
                                        <Save className="h-4 w-4 mr-1" />
                                        {updateMutation.isPending ? "..." : "Opslaan"}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Select
                                        value={ret.status}
                                        onValueChange={(v) => updateMutation.mutate({ status: v as any })}
                                    >
                                        <SelectTrigger className="w-[160px] h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map(o => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={handleEditStart}>
                                        <Edit className="h-4 w-4 mr-1" />
                                        Bewerken
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* STATUS TIMELINE */}
                    <Card>
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between relative px-4">
                                <div className="absolute left-4 right-4 top-1/2 h-1 bg-muted -translate-y-1/2 z-0 rounded" />
                                <div
                                    className="absolute left-4 top-1/2 h-1 bg-green-500 -translate-y-1/2 z-0 rounded transition-all"
                                    style={{ width: isSpecialStatus ? '0%' : `${Math.max(0, currentStatusIndex) / (STATUS_FLOW.length - 1) * 100}%` }}
                                />

                                {STATUS_FLOW.map((status, idx) => {
                                    const isCompleted = currentStatusIndex >= idx;
                                    const isCurrent = status.value === ret.status;

                                    return (
                                        <div key={status.value} className="flex flex-col items-center z-10">
                                            <div className={`
                                                w-8 h-8 rounded-full flex items-center justify-center border-2
                                                ${isCompleted
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : isCurrent
                                                        ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                                                        : 'bg-background border-muted-foreground/30'}
                                            `}>
                                                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-4 w-4" />}
                                            </div>
                                            <span className={`text-xs mt-1 ${isCurrent ? 'font-bold' : 'text-muted-foreground'}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {isSpecialStatus && (
                                <div className="mt-3 text-center">
                                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        {STATUS_OPTIONS.find(s => s.value === ret.status)?.label}
                                    </Badge>
                                </div>
                            )}

                            {ret.requestedAt && (
                                <div className="mt-3 text-center text-sm text-muted-foreground">
                                    Aangevraagd: {format(new Date(ret.requestedAt), "d MMMM yyyy", { locale: nl })}
                                    {ret.receivedAt && ` · Ontvangen: ${format(new Date(ret.receivedAt), "d MMM", { locale: nl })}`}
                                    {ret.completedAt && ` · Afgerond: ${format(new Date(ret.completedAt), "d MMM", { locale: nl })}`}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* MAIN 2-COLUMN GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* LEFT: Customer + Tracking */}
                        <div className="space-y-4">
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{customerName}</span>
                                        {customerReturns.length > 0 && (
                                            <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600">
                                                {customerReturns.length} retouren
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {customerEmail && (
                                            <a href={`mailto:${customerEmail}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                                                <Mail className="h-4 w-4" />
                                                {customerEmail}
                                            </a>
                                        )}
                                        {customerPhone && (
                                            <a href={`tel:${customerPhone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                                                <Phone className="h-4 w-4" />
                                                {customerPhone}
                                            </a>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Truck className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">Tracking</span>
                                    </div>
                                    {isEditMode ? (
                                        <Input
                                            value={editedData.trackingNumber}
                                            onChange={(e) => setEditedData({ ...editedData, trackingNumber: e.target.value })}
                                            placeholder="Trackingnummer"
                                        />
                                    ) : carrier ? (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start gap-2"
                                            onClick={() => window.open(carrier.url, "_blank")}
                                        >
                                            <span className="text-lg">{carrier.icon}</span>
                                            <code className="flex-1 text-left">{ret.trackingNumber}</code>
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <span className="text-muted-foreground">Geen tracking</span>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
                                <CardContent className="p-4">
                                    <div className="font-medium text-amber-800 dark:text-amber-300">
                                        📋 Retourreden: {ret.returnReason ? (REASON_LABELS[ret.returnReason] || ret.returnReason) : <span className="text-muted-foreground italic">Niet opgegeven</span>}
                                    </div>
                                    {ret.customerNotes && (
                                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 italic">
                                            "{ret.customerNotes}"
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT: Order Items */}
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">Order #{order?.orderNumber}</span>
                                    </div>
                                    {order?.createdAt && (
                                        <span className="text-sm text-muted-foreground">
                                            {format(new Date(order.createdAt), "d MMM yyyy", { locale: nl })}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {orderLineItems.length > 0 ? (
                                        orderLineItems.map((item: any, idx: number) => {
                                            const isReturning = isReturnItem(item);
                                            const returnItem = returnItems.find(ri =>
                                                ri.sku === item.sku || ri.productName === item.title
                                            );

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-lg ${isReturning
                                                        ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                                                        : 'bg-muted/30 border'
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        {isReturning && (
                                                            <CheckCircle2 className="h-5 w-5 text-red-500 mt-0.5" />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium">{item.title || item.name}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {item.sku && `SKU: ${item.sku} · `}
                                                                ×{returnItem?.quantity || item.quantity}
                                                                {item.price && ` · ${fmt(item.price * 100)}`}
                                                            </div>
                                                            {isReturning && returnItem?.condition && (
                                                                <Badge variant="outline" className="text-xs mt-1">
                                                                    {CONDITION_LABELS[returnItem.condition] || returnItem.condition}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : returnItems.length > 0 ? (
                                        returnItems.map((item) => (
                                            <div key={item.id} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle2 className="h-5 w-5 text-red-500 mt-0.5" />
                                                    <div className="flex-1">
                                                        <div className="font-medium">{item.productName}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {item.sku && `${item.sku} · `}×{item.quantity}
                                                            {item.unitPrice && ` · ${fmt(item.unitPrice)}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-muted-foreground text-center py-4">Geen items</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* NOTES */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Interne Notities</span>
                            </div>
                            {currentUser && (
                                <NotesPanel
                                    entityType="return"
                                    entityId={returnId!}
                                    currentUser={currentUser}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            <EditReturnDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                returnData={ret}
                onSave={(data) => updateMutation.mutate(data)}
                isSaving={updateMutation.isPending}
            />
        </div>
    );
}
