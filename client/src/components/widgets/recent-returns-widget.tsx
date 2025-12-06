import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { format } from "date-fns";
import type { Return } from "@shared/schema";
import { useLocation } from "wouter";

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

const STATUS_LABELS: Record<string, string> = {
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
    const { data: returns = [], isLoading } = useQuery<Return[]>({
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
                                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-medium truncate">
                                            {returnItem.returnNumber}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`${STATUS_COLORS[returnItem.status]} text-xs px-2 py-0`}
                                        >
                                            {STATUS_LABELS[returnItem.status] || returnItem.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
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
