import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    ShoppingCart,
    Truck,
    FileText,
    Activity,
    Edit2,
    Save,
    X,
    Plus,
    Trash2,
    Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ReturnDetailModalContentProps {
    enrichedData: any;
    onUpdate: (data: any) => Promise<void>;
    isUpdating: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    nieuw_onderweg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400",
    ontvangen_controle: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400",
    akkoord_terugbetaling: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400",
    vermiste_pakketten: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400",
    wachten_klant: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400",
    opnieuw_versturen: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400",
    klaar: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
    niet_ontvangen: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

const PRIORITY_COLORS: Record<string, string> = {
    low: "bg-blue-50 text-blue-700 border-blue-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    urgent: "bg-red-50 text-red-700 border-red-200",
};

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

const PRIORITY_OPTIONS = [
    { value: "low", label: "Laag" },
    { value: "medium", label: "Normaal" },
    { value: "high", label: "Hoog" },
    { value: "urgent", label: "Urgent" },
];

const REASON_OPTIONS = [
    { value: "wrong_item", label: "Verkeerd artikel" },
    { value: "damaged", label: "Beschadigd" },
    { value: "defective", label: "Defect" },
    { value: "size_issue", label: "Maat probleem" },
    { value: "changed_mind", label: "Bedacht" },
    { value: "other", label: "Anders" },
];

export function ReturnDetailModalContent({
    enrichedData,
    onUpdate,
    isUpdating,
}: ReturnDetailModalContentProps) {
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedData, setEditedData] = useState<any>({});
    const [editedItems, setEditedItems] = useState<any[]>([]);

    const returnData = enrichedData.return;
    const customer = enrichedData.customer || enrichedData.order?.orderData?.customer;
    const order = enrichedData.order;
    const items = isEditMode ? editedItems : (enrichedData.returnItems || []);

    const handleEditStart = () => {
        setIsEditMode(true);
        setEditedData({
            status: returnData.status,
            priority: returnData.priority || "medium",
            returnReason: returnData.returnReason,
            trackingNumber: returnData.trackingNumber || "",
            customerNotes: returnData.customerNotes || "",
            internalNotes: returnData.internalNotes || "",
            conditionNotes: returnData.conditionNotes || "",
            receivedAt: returnData.receivedAt,
            expectedReturnDate: returnData.expectedReturnDate,
        });
        // Store original quantity for validation
        setEditedItems((enrichedData.returnItems || []).map(item => ({
            ...item,
            originalQuantity: item.quantity, // Store original quantity as max
        })));
    };

    const handleSave = async () => {
        await onUpdate({
            ...editedData,
            items: editedItems.map(item => ({
                id: item.id,
                productName: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                condition: item.condition,
                unitPrice: item.unitPrice,
            })),
        });
        setIsEditMode(false);
        setEditedData({});
        setEditedItems([]);
    };

    const handleCancel = () => {
        setIsEditMode(false);
        setEditedData({});
        setEditedItems([]);
    };

    const handleRemoveItem = (itemId: string) => {
        setEditedItems(editedItems.filter(item => item.id !== itemId));
    };

    const handleUpdateItem = (itemId: string, field: string, value: any) => {
        setEditedItems(editedItems.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
        ));
    };

    const getStatusLabel = (status: string) => {
        return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
    };

    const getPriorityLabel = (priority: string) => {
        return PRIORITY_OPTIONS.find(p => p.value === priority)?.label || priority;
    };

    const getReasonLabel = (reason: string) => {
        return REASON_OPTIONS.find(r => r.value === reason)?.label || reason;
    };

    return (
        <div className="space-y-4">
            {/* Header with Status and Edit Button */}
            <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                    {isEditMode ? (
                        <>
                            <Select
                                value={editedData.status}
                                onValueChange={(value) => setEditedData({ ...editedData, status: value })}
                            >
                                <SelectTrigger className="h-7 text-xs w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={editedData.priority}
                                onValueChange={(value) => setEditedData({ ...editedData, priority: value })}
                            >
                                <SelectTrigger className="h-7 text-xs w-[120px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIORITY_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    ) : (
                        <>
                            <Badge className={`${STATUS_COLORS[returnData.status]} px-3 py-1 text-xs`}>
                                {getStatusLabel(returnData.status)}
                            </Badge>
                            <Badge variant="outline" className={`${PRIORITY_COLORS[returnData.priority || 'medium']} px-2 py-0.5 text-xs`}>
                                {getPriorityLabel(returnData.priority || 'medium')}
                            </Badge>
                        </>
                    )}
                </div>
                <div className="flex gap-2">
                    {isEditMode ? (
                        <>
                            <Button size="sm" variant="outline" onClick={handleCancel} disabled={isUpdating}>
                                <X className="h-4 w-4 mr-1" />
                                Annuleren
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                                <Save className="h-4 w-4 mr-1" />
                                {isUpdating ? "Opslaan..." : "Opslaan"}
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" variant="outline" onClick={handleEditStart}>
                            <Edit2 className="h-4 w-4 mr-1" />
                            Bewerken
                        </Button>
                    )}
                </div>
            </div>

            {/* Info Cards Row */}
            <div className="grid grid-cols-3 gap-3">
                {/* Return Info Card */}
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Retour</h3>
                    </div>
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                            <span className="text-blue-600/70 dark:text-blue-400/70">Nummer:</span>
                            <span className="font-mono text-blue-900 dark:text-blue-100">{returnData.returnNumber}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-blue-600/70 dark:text-blue-400/70">Reden:</span>
                            {isEditMode ? (
                                <Select
                                    value={editedData.returnReason}
                                    onValueChange={(value) => setEditedData({ ...editedData, returnReason: value })}
                                >
                                    <SelectTrigger className="h-6 text-xs w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REASON_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <span className="text-blue-900 dark:text-blue-100 text-right max-w-[120px] truncate">
                                    {getReasonLabel(returnData.returnReason)}
                                </span>
                            )}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-blue-600/70 dark:text-blue-400/70">Aangevraagd:</span>
                            <span className="text-blue-900 dark:text-blue-100">{format(new Date(returnData.requestedAt), "dd MMM")}</span>
                        </div>
                    </div>
                </div>

                {/* Customer Info Card */}
                <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">Klant</h3>
                    </div>
                    {customer ? (
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-green-600/70 dark:text-green-400/70">Naam:</span>
                                <span className="text-green-900 dark:text-green-100 text-right max-w-[120px] truncate">
                                    {customer.firstName || customer.first_name} {customer.lastName || customer.last_name}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-green-600/70 dark:text-green-400/70">Email:</span>
                                <span className="text-green-900 dark:text-green-100 text-right max-w-[120px] truncate">{customer.email}</span>
                            </div>
                            {(customer.phone) && (
                                <div className="flex justify-between">
                                    <span className="text-green-600/70 dark:text-green-400/70">Telefoon:</span>
                                    <span className="text-green-900 dark:text-green-100">{customer.phone}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-green-600/70 dark:text-green-400/70">Geen klantinfo</p>
                    )}
                </div>

                {/* Order Info Card */}
                <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">Bestelling</h3>
                    </div>
                    {order ? (
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-purple-600/70 dark:text-purple-400/70">Nummer:</span>
                                <span className="font-mono text-purple-900 dark:text-purple-100">#{order.orderNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-purple-600/70 dark:text-purple-400/70">Bedrag:</span>
                                <span className="text-purple-900 dark:text-purple-100">€{((order.totalAmount || 0) / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-purple-600/70 dark:text-purple-400/70">Datum:</span>
                                <span className="text-purple-900 dark:text-purple-100">
                                    {order.orderDate ? format(new Date(order.orderDate), "dd MMM") : "-"}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-purple-600/70 dark:text-purple-400/70">Geen orderinfo</p>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="items" className="text-xs">
                        <Package className="h-3.5 w-3.5 mr-1.5" />
                        Items ({items.length})
                    </TabsTrigger>
                    <TabsTrigger value="tracking" className="text-xs">
                        <Truck className="h-3.5 w-3.5 mr-1.5" />
                        Tracking
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="text-xs">
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Notities
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="text-xs">
                        <Activity className="h-3.5 w-3.5 mr-1.5" />
                        Timeline
                    </TabsTrigger>
                </TabsList>

                {/* Items Tab */}
                <TabsContent value="items" className="mt-3 space-y-2">
                    {items.length > 0 ? (
                        items.map((item: any) => (
                            <div key={item.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm truncate">{item.productName}</h4>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                            {item.sku && <span>SKU: {item.sku}</span>}
                                            {isEditMode ? (
                                                <>
                                                    <div className="flex items-center gap-1">
                                                        <span>Aantal:</span>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max={item.originalQuantity || item.quantity}
                                                            value={item.quantity}
                                                            onChange={(e) => {
                                                                const newQty = parseInt(e.target.value);
                                                                const maxQty = item.originalQuantity || item.quantity;
                                                                if (newQty >= 1 && newQty <= maxQty) {
                                                                    handleUpdateItem(item.id, 'quantity', newQty);
                                                                }
                                                            }}
                                                            className="h-6 w-16 text-xs"
                                                        />
                                                        <span className="text-xs text-muted-foreground">/ {item.originalQuantity || item.quantity}</span>
                                                    </div>
                                                    <Select
                                                        value={item.condition || "unopened"}
                                                        onValueChange={(value) => handleUpdateItem(item.id, 'condition', value)}
                                                    >
                                                        <SelectTrigger className="h-6 text-xs w-[100px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="unopened" className="text-xs">Ongeopend</SelectItem>
                                                            <SelectItem value="opened_unused" className="text-xs">Geopend</SelectItem>
                                                            <SelectItem value="used" className="text-xs">Gebruikt</SelectItem>
                                                            <SelectItem value="damaged" className="text-xs">Beschadigd</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Aantal: {item.quantity}</span>
                                                    {item.condition && (
                                                        <Badge variant="outline" className="text-xs h-5">
                                                            {item.condition === "unopened" ? "Ongeopend" :
                                                                item.condition === "opened_unused" ? "Geopend" :
                                                                    item.condition === "used" ? "Gebruikt" :
                                                                        item.condition === "damaged" ? "Beschadigd" : item.condition}
                                                        </Badge>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        {item.unitPrice && (
                                            <div>
                                                <p className="font-semibold text-sm">€{((item.unitPrice || 0) / 100).toFixed(2)}</p>
                                                <p className="text-xs text-muted-foreground">Totaal: €{((item.unitPrice * item.quantity) / 100).toFixed(2)}</p>
                                            </div>
                                        )}
                                        {isEditMode && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveItem(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Geen items
                        </div>
                    )}
                </TabsContent>

                {/* Tracking Tab */}
                <TabsContent value="tracking" className="mt-3 space-y-3">
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="trackingNumber" className="text-xs">Trackingnummer</Label>
                            {isEditMode ? (
                                <Input
                                    id="trackingNumber"
                                    value={editedData.trackingNumber}
                                    onChange={(e) => setEditedData({ ...editedData, trackingNumber: e.target.value })}
                                    className="mt-1"
                                    placeholder="Voer trackingnummer in"
                                />
                            ) : (
                                <p className="text-sm mt-1 font-mono">{returnData.trackingNumber || "-"}</p>
                            )}
                        </div>
                        <div>
                            <Label className="text-xs">Verwachte retourdatum</Label>
                            {isEditMode ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {editedData.expectedReturnDate ? format(new Date(editedData.expectedReturnDate), "PPP") : "Selecteer datum"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={editedData.expectedReturnDate ? new Date(editedData.expectedReturnDate) : undefined}
                                            onSelect={(date) => setEditedData({ ...editedData, expectedReturnDate: date?.toISOString() })}
                                        />
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <p className="text-sm mt-1">
                                    {returnData.expectedReturnDate ? format(new Date(returnData.expectedReturnDate), "dd MMM yyyy") : "-"}
                                </p>
                            )}
                        </div>
                        {returnData.receivedAt && (
                            <div>
                                <Label className="text-xs">Ontvangen op</Label>
                                <p className="text-sm mt-1">{format(new Date(returnData.receivedAt), "dd MMM yyyy HH:mm")}</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="mt-3 space-y-3">
                    <div>
                        <Label htmlFor="customerNotes" className="text-xs">Klant Notities</Label>
                        {isEditMode ? (
                            <Textarea
                                id="customerNotes"
                                value={editedData.customerNotes}
                                onChange={(e) => setEditedData({ ...editedData, customerNotes: e.target.value })}
                                className="mt-1"
                                rows={3}
                                placeholder="Notities van de klant..."
                            />
                        ) : (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{returnData.customerNotes || "-"}</p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="internalNotes" className="text-xs">Interne Notities</Label>
                        {isEditMode ? (
                            <Textarea
                                id="internalNotes"
                                value={editedData.internalNotes}
                                onChange={(e) => setEditedData({ ...editedData, internalNotes: e.target.value })}
                                className="mt-1"
                                rows={3}
                                placeholder="Interne notities (niet zichtbaar voor klant)..."
                            />
                        ) : (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{returnData.internalNotes || "-"}</p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="conditionNotes" className="text-xs">Conditie Notities</Label>
                        {isEditMode ? (
                            <Textarea
                                id="conditionNotes"
                                value={editedData.conditionNotes}
                                onChange={(e) => setEditedData({ ...editedData, conditionNotes: e.target.value })}
                                className="mt-1"
                                rows={3}
                                placeholder="Notities over de conditie na inspectie..."
                            />
                        ) : (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{returnData.conditionNotes || "-"}</p>
                        )}
                    </div>
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="mt-3">
                    <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2 pb-2 border-b">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                            <div className="flex-1">
                                <p className="font-medium">Retour aangevraagd</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(returnData.requestedAt), "dd MMM yyyy HH:mm")}</p>
                            </div>
                        </div>
                        {returnData.receivedAt && (
                            <div className="flex items-start gap-2 pb-2 border-b">
                                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                                <div className="flex-1">
                                    <p className="font-medium">Retour ontvangen</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(returnData.receivedAt), "dd MMM yyyy HH:mm")}</p>
                                </div>
                            </div>
                        )}
                        {returnData.status === "klaar" && (
                            <div className="flex items-start gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-500 mt-1.5"></div>
                                <div className="flex-1">
                                    <p className="font-medium">Retour afgehandeld</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(returnData.updatedAt || returnData.createdAt), "dd MMM yyyy HH:mm")}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
