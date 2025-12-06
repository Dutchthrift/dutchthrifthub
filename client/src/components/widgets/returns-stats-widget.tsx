import { useQuery } from "@tanstack/react-query";
import { Package, AlertCircle, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Return, Order } from "@shared/schema";

export function ReturnsStatsWidget() {
    const { data: returns = [], isLoading: returnsLoading } = useQuery<Return[]>({
        queryKey: ["/api/returns"],
    });

    const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
        queryKey: ["/api/orders"],
    });

    const isLoading = returnsLoading || ordersLoading;

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                            <div className="space-y-2">
                                <div className="h-4 bg-muted rounded w-24"></div>
                                <div className="h-8 bg-muted rounded w-16"></div>
                                <div className="h-3 bg-muted rounded w-32"></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    // Calculate metrics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfLastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Order Data Preparation
    const todayOrders = orders.filter(o =>
        o.orderDate && new Date(o.orderDate) >= startOfToday
    );
    const yesterdayOrders = orders.filter(o =>
        o.orderDate &&
        new Date(o.orderDate) >= startOfYesterday &&
        new Date(o.orderDate) < startOfToday
    );

    const thisWeekOrders = orders.filter(o =>
        o.orderDate && new Date(o.orderDate) >= startOfWeek
    );
    const lastWeekOrders = orders.filter(o =>
        o.orderDate &&
        new Date(o.orderDate) >= startOfLastWeek &&
        new Date(o.orderDate) < startOfWeek
    );

    // 1. Orders Today
    const ordersTodayCount = todayOrders.length;
    const ordersYesterdayCount = yesterdayOrders.length;

    const ordersChange = ordersYesterdayCount > 0
        ? ((ordersTodayCount - ordersYesterdayCount) / ordersYesterdayCount) * 100
        : 0;

    // 2. Active Returns (Needs Action)
    const activeStatuses = ['nieuw_onderweg', 'ontvangen_controle', 'wachten_klant'];
    const activeReturns = returns.filter(r => activeStatuses.includes(r.status)).length;

    // Find oldest active return
    const oldestActiveReturn = returns
        .filter(r => activeStatuses.includes(r.status) && r.requestedAt)
        .sort((a, b) => new Date(a.requestedAt!).getTime() - new Date(b.requestedAt!).getTime())[0];

    const oldestAge = oldestActiveReturn
        ? Math.floor((now.getTime() - new Date(oldestActiveReturn.requestedAt!).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // 3. Today's Revenue
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 100;
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 100;

    const revenueChange = yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : 0;

    // 4. Weekly Growth
    const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 100;
    const lastWeekRevenue = lastWeekOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) / 100;

    const weeklyGrowth = lastWeekRevenue > 0
        ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
        : 0;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('nl-NL', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatChange = (value: number) => {
        return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    };

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Orders Today */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Bestellingen Vandaag</p>
                            <h3 className="text-3xl font-bold text-blue-900 dark:text-blue-100">{ordersTodayCount}</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                {formatChange(ordersChange)} t.o.v. gisteren
                            </p>
                        </div>
                        <Package className="h-12 w-12 text-blue-500 dark:text-blue-400 opacity-20" />
                    </div>
                </CardContent>
            </Card>

            {/* Active Returns */}
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Actieve Retouren</p>
                            <h3 className="text-3xl font-bold text-orange-900 dark:text-orange-100">{activeReturns}</h3>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                                {oldestAge > 0 ? `Oudste: ${oldestAge} dagen` : 'Alles bijgewerkt'}
                            </p>
                        </div>
                        <AlertCircle className="h-12 w-12 text-orange-500 dark:text-orange-400 opacity-20" />
                    </div>
                </CardContent>
            </Card>

            {/* Today's Revenue */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">Omzet Vandaag</p>
                            <h3 className="text-3xl font-bold text-green-900 dark:text-green-100">{formatCurrency(todayRevenue)}</h3>
                            <p className="text-xs text-green-600 dark:text-green-400">
                                {formatChange(revenueChange)} t.o.v. gisteren
                            </p>
                        </div>
                        <DollarSign className="h-12 w-12 text-green-500 dark:text-green-400 opacity-20" />
                    </div>
                </CardContent>
            </Card>

            {/* Weekly Growth */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Wekelijkse Groei</p>
                            <h3 className="text-3xl font-bold text-purple-900 dark:text-purple-100">{formatChange(weeklyGrowth)}</h3>
                            <p className="text-xs text-purple-600 dark:text-purple-400">
                                {formatCurrency(thisWeekRevenue)} deze week
                            </p>
                        </div>
                        <TrendingUp className="h-12 w-12 text-purple-500 dark:text-purple-400 opacity-20" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
