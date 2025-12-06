import { Navigation } from "@/components/layout/navigation";
import { ReturnsStatsWidget } from "@/components/widgets/returns-stats-widget";
import { PendingActionsWidget } from "@/components/widgets/pending-actions-widget";
import { RecentReturnsWidget } from "@/components/widgets/recent-returns-widget";
import { QuickActionsWidget } from "@/components/widgets/quick-actions-widget";
import { BusinessMetricsWidget } from "@/components/widgets/business-metrics-widget";
import { useQuery } from "@tanstack/react-query";

interface SessionUser {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export default function Home() {
  const { data: session } = useQuery<{ user: SessionUser }>({
    queryKey: ["/api/auth/session"],
  });

  const userName = session?.user?.firstName || session?.user?.username || "daar";

  return (
    <div className="min-h-screen bg-background" data-testid="home-page">
      <Navigation />

      <main className="flex-1 space-y-6 p-8 pt-6">
        {/* Page Header */}
        <div className="flex items-center justify-between" data-testid="page-header">
          <div>
            <h2 className="text-4xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
              Welkom terug, {userName}! 👋
            </h2>
            <p className="text-muted-foreground mt-1 text-lg">
              Hier is je bedrijfsoverzicht voor vandaag.
            </p>
          </div>
        </div>

        {/* Stats Grid - 4 Colored Cards */}
        <ReturnsStatsWidget />

        {/* Main Content Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pending Actions */}
          <PendingActionsWidget />

          {/* Recent Returns */}
          <RecentReturnsWidget />
        </div>

        {/* Quick Actions */}
        <QuickActionsWidget />

        {/* Business Performance Metrics */}
        <BusinessMetricsWidget />
      </main>
    </div>
  );
}
