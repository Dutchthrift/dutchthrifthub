import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Plus } from "lucide-react";
import { format } from "date-fns";
import type { Return } from "@shared/schema";
import { useLocation } from "wouter";

// Extend Return type to include orderNumber which is sent by the backend
type ReturnWithOrder = Return & { orderNumber?: string };

const STATUS_COLORS: Record<string, string> = {
    nieuw: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-400",
    onderweg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400",
    nieuw_onderweg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400",
    ontvangen_controle: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400",
    akkoord_terugbetaling: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400",
    vermiste_pakketten: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400",
    wachten_klant: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400",
    opnieuw_versturen: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400",
    klaar: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400",
    niet_ontvangen: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
    nieuw: "Nieuw",
    onderweg: "Onderweg",
    nieuw_onderweg: "Onderweg",
    ontvangen_controle: "Controle",
    akkoord_terugbetaling: "Akkoord",
    vermiste_pakketten: "Vermist",
    wachten_klant: "Wacht op klant",
    opnieuw_versturen: "Opnieuw versturen",
    klaar: "Klaar",
    niet_ontvangen: "Niet ontvangen",
};

export function RecentReturnsWidget() {
    const [, setLocation] = useLocation();
    const { data: returns = [], isLoading } = useQuery<ReturnWithOrder[]>({
        queryKey: ["/api/returns"],
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Recente Retouren
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 animate-pulse">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-16 bg-muted rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Get last 5 returns, sorted by requested date
    const recentReturns = [...returns]
        .sort((a, b) => {
            const dateA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
            const dateB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
            return dateB - dateA;
        })
        .slice(0, 5);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Recente Retouren
                    </CardTitle>
                    <button
                        onClick={() => setLocation('/returns')}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Alles bekijken →
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Action Card */}
                <button
                    onClick={() => setLocation('/returns')}
                    className="w-full mb-3 p-3 rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50 border border-orange-200 dark:border-orange-800 hover:shadow-md transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Plus className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="text-sm font-medium text-orange-700 dark:text-orange-300 group-hover:text-orange-800 dark:group-hover:text-orange-200">
                            Nieuwe Retour
                        </span>
                    </div>
                </button>

                {recentReturns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Nog geen retouren</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentReturns.map((returnItem) => (
                            <button
                                key={returnItem.id}
                                onClick={() => setLocation('/returns')}
                                className="w-full h-[72px] flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-medium truncate text-primary">
                                            {(() => {
                                                // Priority 1: Use orderNumber from API if available
                                                if (returnItem.orderNumber) {
                                                    return returnItem.orderNumber.replace(/^#/, '');
                                                }
                                                // Priority 2: Extract from shopifyReturnName (e.g., "#9009-R1" -> "9009")
                                                if (returnItem.shopifyReturnName) {
                                                    return returnItem.shopifyReturnName.replace(/^#/, '').replace(/-R\d+$/, '');
                                                }
                                                // Priority 3: Extract number from RET-YYYY-XXX format
                                                const match = returnItem.returnNumber?.match(/\d{3,}$/);
                                                return match ? match[0] : returnItem.returnNumber;
                                            })()}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`${STATUS_COLORS[returnItem.status]} text-xs px-2 py-0`}
                                        >
                                            {STATUS_LABELS[returnItem.status] || returnItem.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-amber-600 dark:text-amber-500">
                                        {returnItem.requestedAt
                                            ? format(new Date(returnItem.requestedAt), "dd MMM yyyy")
                                            : "Geen datum"}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
