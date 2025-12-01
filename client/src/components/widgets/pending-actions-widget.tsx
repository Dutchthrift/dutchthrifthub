import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, UserX } from "lucide-react";
import type { Return } from "@shared/schema";
import { useLocation } from "wouter";

export function PendingActionsWidget() {
    const [, setLocation] = useLocation();
    const { data: returns = [], isLoading } = useQuery<Return[]>({
        queryKey: ["/api/returns"],
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Pending Actions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 animate-pulse">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 bg-muted rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Calculate action items
    const toInspect = returns.filter(r => r.status === 'ontvangen_controle').length;
    const toRefund = returns.filter(r => r.status === 'akkoord_terugbetaling').length;
    const awaitingCustomer = returns.filter(r => r.status === 'wachten_klant').length;

    // Overdue returns (expected return date passed, not received)
    const now = new Date();
    const overdue = returns.filter(r =>
        r.status === 'nieuw_onderweg' &&
        r.expectedReturnDate &&
        new Date(r.expectedReturnDate) < now
    ).length;

    const actions = [
        {
            label: "Returns to Inspect",
            count: toInspect,
            icon: AlertCircle,
            color: "text-orange-600 dark:text-orange-400",
            bgColor: "bg-orange-50 dark:bg-orange-950/30",
            status: "ontvangen_controle",
        },
        {
            label: "Refunds to Process",
            count: toRefund,
            icon: CheckCircle,
            color: "text-green-600 dark:text-green-400",
            bgColor: "bg-green-50 dark:bg-green-950/30",
            status: "akkoord_terugbetaling",
        },
        {
            label: "Awaiting Customer",
            count: awaitingCustomer,
            icon: UserX,
            color: "text-yellow-600 dark:text-yellow-400",
            bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
            status: "wachten_klant",
        },
        {
            label: "Overdue Returns",
            count: overdue,
            icon: Clock,
            color: "text-red-600 dark:text-red-400",
            bgColor: "bg-red-50 dark:bg-red-950/30",
            status: "nieuw_onderweg",
        },
    ];

    const totalActions = toInspect + toRefund + awaitingCustomer + overdue;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Pending Actions
                    </CardTitle>
                    {totalActions > 0 && (
                        <Badge variant="destructive">{totalActions}</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {totalActions === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">All caught up! 🎉</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {actions.map((action) => (
                            action.count > 0 && (
                                <button
                                    key={action.label}
                                    onClick={() => setLocation('/returns')}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg ${action.bgColor} hover:opacity-80 transition-opacity cursor-pointer`}
                                >
                                    <div className="flex items-center gap-3">
                                        <action.icon className={`h-5 w-5 ${action.color}`} />
                                        <span className="text-sm font-medium">{action.label}</span>
                                    </div>
                                    <Badge variant="outline" className={action.color}>
                                        {action.count}
                                    </Badge>
                                </button>
                            )
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
