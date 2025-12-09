import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Package,
    User,
    Mail,
    Phone,
    Truck,
    Edit2,
    Save,
    X,
    ExternalLink,
    Clock,
    CheckCircle2,
    Circle,
    MessageSquare,
    AlertTriangle,
    ShoppingBag,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import type { Return, ReturnItem, User as UserType } from "@shared/schema";
import { NotesPanel } from "@/components/notes/NotesPanel";

interface ReturnDetailModalContentProps {
    enrichedData: any;
    onUpdate: (data: any) => Promise<void>;
    isUpdating: boolean;
}

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
    nieuw: "bg-amber-500",
    onderweg: "bg-blue-500",
    ontvangen_controle: "bg-blue-500",
    akkoord_terugbetaling: "bg-green-500",
    vermiste_pakketten: "bg-red-500",
    wachten_klant: "bg-yellow-500",
    opnieuw_versturen: "bg-purple-500",
    klaar: "bg-gray-500",
    niet_ontvangen: "bg-gray-500",
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

export function ReturnDetailModalContent({
    enrichedData,
    onUpdate,
    isUpdating,
}: ReturnDetailModalContentProps) {
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedData, setEditedData] = useState<any>({});

    const ret = enrichedData.return;
    const order = enrichedData.order;
    const orderData = order?.orderData as any;
    const customer = orderData?.customer || enrichedData.customer;
    const shippingAddress = orderData?.shipping_address;
    const orderLineItems = orderData?.line_items || [];
    const returnItems: ReturnItem[] = enrichedData.returnItems || [];

    const { data: currentUser } = useQuery<UserType>({
        queryKey: ["/api/auth/session"],
        queryFn: async () => {
            const res = await fetch("/api/auth/session");
            if (!res.ok) throw new Error("Not authenticated");
            return (await res.json()).user;
        },
    });

    const { data: allReturns = [] } = useQuery<Return[]>({ queryKey: ["/api/returns"] });
    const customerReturns = allReturns.filter(r => r.customerId === ret.customerId && r.id !== ret.id);

    const handleEditStart = () => {
        setIsEditMode(true);
        setEditedData({ status: ret.status, trackingNumber: ret.trackingNumber || "" });
    };

    const handleSave = async () => {
        await onUpdate(editedData);
        setIsEditMode(false);
    };

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
        return returnItems.some(ri => ri.sku === lineItem.sku || ri.productName === lineItem.title || ri.productName === lineItem.name);
    };

    return (
        <div className="space-y-4">
            {/* HEADER */}
            <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-3">
                    <Badge className={`${STATUS_COLORS[ret.status]} text-white border-0`}>
                        {STATUS_OPTIONS.find(s => s.value === ret.status)?.label || ret.status}
                    </Badge>
                    {turnaroundDays !== null && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />{turnaroundDays}d
                        </span>
                    )}
                    {ret.requestedAt && (
                        <span className="text-xs text-muted-foreground">
                            {format(new Date(ret.requestedAt), "d MMM yyyy", { locale: nl })}
                        </span>
                    )}
                </div>
                <div className="flex gap-1">
                    {isEditMode ? (
                        <>
                            <Button size="sm" variant="ghost" onClick={() => setIsEditMode(false)} disabled={isUpdating}>
                                <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                                <Save className="h-4 w-4 mr-1" />{isUpdating ? "..." : "Opslaan"}
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" variant="ghost" onClick={handleEditStart}>
                            <Edit2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* STATUS TIMELINE */}
            <div className="py-2">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-muted -translate-y-1/2 z-0" />
                    <div
                        className="absolute left-0 top-1/2 h-0.5 bg-green-500 -translate-y-1/2 z-0 transition-all"
                        style={{ width: isSpecialStatus ? '0%' : `${Math.max(0, currentStatusIndex) / (STATUS_FLOW.length - 1) * 100}%` }}
                    />
                    {STATUS_FLOW.map((status, idx) => {
                        const isCompleted = currentStatusIndex >= idx;
                        const isCurrent = status.value === ret.status;
                        return (
                            <div key={status.value} className="flex flex-col items-center z-10">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isCompleted ? 'bg-green-500 border-green-500 text-white' : isCurrent ? 'bg-blue-500 border-blue-500 text-white animate-pulse' : 'bg-background border-muted-foreground/30'}`}>
                                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                                </div>
                                <span className={`text-[10px] mt-1 ${isCurrent ? 'font-bold' : 'text-muted-foreground'}`}>{status.label}</span>
                            </div>
                        );
                    })}
                </div>
                {isSpecialStatus && (
                    <div className="mt-2 text-center">
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {STATUS_OPTIONS.find(s => s.value === ret.status)?.label}
                        </Badge>
                    </div>
                )}
            </div>

            {/* RETURN REASON - Always Visible */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    📋 Retourreden: {ret.returnReason ? (REASON_LABELS[ret.returnReason] || ret.returnReason) : <span className="text-muted-foreground italic">Niet opgegeven</span>}
                </div>
                {ret.customerNotes && (
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 italic">"{ret.customerNotes}"</p>
                )}
            </div>

            {/* 2-COLUMN GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* LEFT: Customer + Tracking */}
                <div className="space-y-3">
                    <div className="p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{customerName}</span>
                            {customerReturns.length > 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-orange-500/10 text-orange-600">{customerReturns.length} retouren</Badge>
                            )}
                        </div>
                        <div className="space-y-1 text-sm">
                            {customerEmail && (
                                <a href={`mailto:${customerEmail}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                                    <Mail className="h-3 w-3" />{customerEmail}
                                </a>
                            )}
                            {customerPhone && (
                                <a href={`tel:${customerPhone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                                    <Phone className="h-3 w-3" />{customerPhone}
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Tracking</span>
                        </div>
                        {isEditMode ? (
                            <Input value={editedData.trackingNumber} onChange={(e) => setEditedData({ ...editedData, trackingNumber: e.target.value })} className="h-8 text-sm" placeholder="Trackingnummer" />
                        ) : carrier ? (
                            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => window.open(carrier.url, "_blank")}>
                                <span>{carrier.icon}</span>
                                <code className="text-xs flex-1 text-left">{ret.trackingNumber}</code>
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        ) : (
                            <span className="text-sm text-muted-foreground">Geen tracking</span>
                        )}
                    </div>
                </div>

                {/* RIGHT: Order Items */}
                <div className="p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">Order #{order?.orderNumber}</span>
                        </div>
                        {order?.createdAt && (
                            <span className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "d MMM", { locale: nl })}</span>
                        )}
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {orderLineItems.length > 0 ? orderLineItems.map((item: any, idx: number) => {
                            const isReturning = isReturnItem(item);
                            const returnItem = returnItems.find(ri => ri.sku === item.sku || ri.productName === item.title);
                            return (
                                <div key={idx} className={`p-2 rounded text-sm ${isReturning ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800' : 'bg-background border'}`}>
                                    <div className="flex items-start gap-2">
                                        {isReturning && <CheckCircle2 className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{item.title || item.name}</div>
                                            <div className="text-xs text-muted-foreground">{item.sku && `${item.sku} · `}×{returnItem?.quantity || item.quantity}{item.price && ` · ${fmt(item.price * 100)}`}</div>
                                            {isReturning && returnItem?.condition && (
                                                <Badge variant="outline" className="text-[10px] h-4 mt-1">{CONDITION_LABELS[returnItem.condition] || returnItem.condition}</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : returnItems.length > 0 ? returnItems.map((item) => (
                            <div key={item.id} className="p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-red-500 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{item.productName}</div>
                                        <div className="text-xs text-muted-foreground">{item.sku && `${item.sku} · `}×{item.quantity}{item.unitPrice && ` · ${fmt(item.unitPrice)}`}</div>
                                        {item.condition && <Badge variant="outline" className="text-[10px] h-4 mt-1">{CONDITION_LABELS[item.condition] || item.condition}</Badge>}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-sm text-muted-foreground text-center py-4">Geen items</div>
                        )}
                    </div>
                </div>
            </div>

            {/* NOTES */}
            <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Interne Notities</span>
                </div>
                {currentUser ? (
                    <NotesPanel entityType="return" entityId={ret.id} currentUser={currentUser} />
                ) : (
                    <div className="text-sm text-muted-foreground">Laden...</div>
                )}
            </div>
        </div>
    );
}
