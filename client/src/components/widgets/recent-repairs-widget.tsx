import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus } from "lucide-react";
import { format } from "date-fns";
import type { Repair } from "@shared/schema";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
    new: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-400",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400",
    waiting_parts: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400",
    completed: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400",
    returned: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
    new: "Nieuw",
    pending: "In wachtrij",
    in_progress: "In behandeling",
    waiting_parts: "Wacht op onderdelen",
    completed: "Afgerond",
    returned: "Geretourneerd",
};

export function RecentRepairsWidget() {
    const [, setLocation] = useLocation();
    const { data: repairs = [], isLoading } = useQuery<Repair[]>({
        queryKey: ["/api/repairs"],
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Recente Reparaties
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

    // Get last 5 repairs, sorted by created date
    const recentRepairs = [...repairs]
        .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        })
        .slice(0, 5);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-xl truncate">
                        <Wrench className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="truncate">Reparaties</span>
                    </CardTitle>
                    <button
                        onClick={() => setLocation('/repairs')}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0"
                    >
                        Bekijken →
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Action Card */}
                <button
                    onClick={() => setLocation('/repairs')}
                    className="w-full mb-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Plus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300 group-hover:text-purple-800 dark:group-hover:text-purple-200">
                            Nieuwe Reparatie
                        </span>
                    </div>
                </button>

                {recentRepairs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Wrench className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Nog geen reparaties</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentRepairs.map((repair) => (
                            <button
                                key={repair.id}
                                onClick={() => setLocation('/repairs')}
                                className="w-full h-[72px] flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-medium truncate text-primary">
                                            {repair.repairType === 'inventory'
                                                ? repair.repairNumber
                                                : (repair.orderNumber || repair.repairNumber || repair.id.slice(0, 8))}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`${STATUS_COLORS[repair.status] || ''} text-xs px-2 py-0`}
                                        >
                                            {STATUS_LABELS[repair.status] || repair.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {repair.productName || repair.title || "Geen product"}
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-500">
                                        {repair.createdAt
                                            ? format(new Date(repair.createdAt), "dd MMM yyyy")
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
