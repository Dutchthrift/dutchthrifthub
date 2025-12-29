import { Navigation } from "@/components/layout/navigation";
import { ReturnsStatsWidget } from "@/components/widgets/returns-stats-widget";
import { RecentReturnsWidget } from "@/components/widgets/recent-returns-widget";
import { RecentOrdersWidget } from "@/components/widgets/recent-orders-widget";
import { RecentRepairsWidget } from "@/components/widgets/recent-repairs-widget";
import { PersonalTodosWidget } from "@/components/widgets/personal-todos-widget";
import { BusinessMetricsWidget } from "@/components/widgets/business-metrics-widget";
import { useQuery } from "@tanstack/react-query";

interface SessionUser {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export default function Dashboard() {
  const { data: session } = useQuery<{ user: SessionUser }>({
    queryKey: ["/api/auth/session"],
  });

  const userName = session?.user?.firstName || session?.user?.username || "daar";

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Navigation />

      <main className="flex-1 space-y-6 p-8 pt-6">
        {/* Page Header */}
        <div className="flex items-center justify-between" data-testid="dashboard-header">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-orange-500">
              Welkom terug, {userName}! 👋
            </h2>
            <p className="text-muted-foreground mt-1 text-lg">
              Hier is je bedrijfsoverzicht voor vandaag.
            </p>
          </div>
        </div>

        {/* Stats Grid - 4 Colored Cards */}
        <ReturnsStatsWidget />

        {/* Main Content Grid - 4 Info Blocks */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Recent Orders */}
          <RecentOrdersWidget />

          {/* Recent Returns */}
          <RecentReturnsWidget />

          {/* Recent Repairs */}
          <RecentRepairsWidget />

          {/* Personal Todos */}
          <PersonalTodosWidget />
        </div>

        {/* Business Performance Metrics */}
        <BusinessMetricsWidget />
      </main>
    </div>
  );
}
