import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/layout/navigation";
import { Package, Plus, Filter, Search, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CreateReturnModal } from "@/components/forms/create-return-modal";

type Return = {
  id: string;
  returnNumber: string;
  status: string;
  customerId: string | null;
  orderId: string | null;
  returnReason: string | null;
  trackingNumber: string | null;
  requestedAt: string;
  refundAmount: number | null;
  refundStatus: string | null;
  priority: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_TABS = [
  { value: "all", label: "Alle" },
  { value: "nieuw_onderweg", label: "Nieuw / Onderweg" },
  { value: "ontvangen_controle", label: "Ontvangen (controle)" },
  { value: "akkoord_terugbetaling", label: "Akkoord / Terugbetaling" },
  { value: "vermiste_pakketten", label: "Vermiste Pakketten" },
  { value: "wachten_klant", label: "Wachten op Klant" },
  { value: "opnieuw_versturen", label: "Opnieuw Versturen" },
  { value: "klaar", label: "Klaar" },
  { value: "niet_ontvangen", label: "Niet Ontvangen" },
];

const STATUS_COLORS: Record<string, string> = {
  nieuw_onderweg: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  ontvangen_controle: "bg-primary/10 text-primary border-primary/20",
  akkoord_terugbetaling: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  vermiste_pakketten: "bg-destructive/10 text-destructive border-destructive/20",
  wachten_klant: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  opnieuw_versturen: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  klaar: "bg-muted text-muted-foreground border-muted",
  niet_ontvangen: "bg-muted text-muted-foreground border-muted",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  medium: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  high: "bg-primary/10 text-primary border-primary/20",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Returns() {
  const [currentStatus, setCurrentStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch all returns (filtering done client-side)
  const { data: allReturns = [], isLoading } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
  });

  // Filter by status
  const returns = currentStatus === "all" 
    ? allReturns 
    : allReturns.filter(ret => ret.status === currentStatus);

  // Filter returns by search query and priority
  const filteredReturns = returns.filter((ret) => {
    const matchesSearch =
      !searchQuery ||
      ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = priorityFilter === "all" || ret.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  // Count returns by status
  const statusCounts = returns.reduce(
    (acc, ret) => {
      acc[ret.status] = (acc[ret.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const formatCurrency = (cents: number | null) => {
    if (!cents) return "-";
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getStatusLabel = (status: string) => {
    const tab = STATUS_TABS.find((t) => t.value === status);
    return tab?.label || status;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6">
        {/* Header Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Retouren</h1>
                  <p className="text-sm text-muted-foreground">
                    Beheer alle productretouren
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  data-testid="button-create-return"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuw Retour
                </Button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Totaal:</span>
                <span className="text-sm font-semibold">
                  {returns.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Nieuw:</span>
                <span className="text-sm font-semibold text-primary">
                  {statusCounts.nieuw_onderweg || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Wachten op klant:</span>
                <span className="text-sm font-semibold text-chart-1">
                  {statusCounts.wachten_klant || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Klaar:</span>
                <span className="text-sm font-semibold">
                  {statusCounts.klaar || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Filters Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Tabs value={currentStatus} onValueChange={setCurrentStatus} className="w-full">
              <TabsList className="mb-4 flex-wrap h-auto">
                {STATUS_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    data-testid={`tab-${tab.value}`}
                  >
                    {tab.label}
                    {tab.value !== "all" && statusCounts[tab.value] > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-2 h-5 min-w-[20px] rounded-full px-1.5 text-xs"
                      >
                        {statusCounts[tab.value]}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Zoek op retournummer of tracking..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-returns"
                />
              </div>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-priority-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Prioriteit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle prioriteiten</SelectItem>
                  <SelectItem value="low">Laag</SelectItem>
                  <SelectItem value="medium">Normaal</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredReturns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="text-lg font-medium mb-1">
                Geen retouren gevonden
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || priorityFilter !== "all"
                  ? "Probeer een andere zoekopdracht of filter"
                  : "Er zijn nog geen retouren in dit overzicht"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredReturns.map((ret) => (
              <Link
                key={ret.id}
                href={`/returns/${ret.id}`}
                className="block"
                data-testid={`card-return-${ret.id}`}
              >
                <Card className="transition-all hover:border-primary/40 hover:shadow-soft cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-semibold">
                            {ret.returnNumber}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={STATUS_COLORS[ret.status] || ""}
                          >
                            {getStatusLabel(ret.status)}
                          </Badge>
                          {ret.priority && ret.priority !== "medium" && (
                            <Badge 
                              variant="outline"
                              className={PRIORITY_COLORS[ret.priority] || ""}
                            >
                              {ret.priority === "low"
                                ? "Laag"
                                : ret.priority === "high"
                                ? "Hoog"
                                : ret.priority === "urgent"
                                ? "Urgent"
                                : ret.priority}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {ret.trackingNumber && (
                            <div className="flex items-center gap-1">
                              <Package className="h-4 w-4" />
                              <span>{ret.trackingNumber}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(ret.requestedAt), "dd MMM yyyy")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {ret.refundAmount && (
                          <div className="text-lg font-semibold">
                            {formatCurrency(ret.refundAmount)}
                          </div>
                        )}
                        {ret.refundStatus && (
                          <div className="text-xs text-muted-foreground">
                            {ret.refundStatus === "pending"
                              ? "In afwachting"
                              : ret.refundStatus === "processing"
                              ? "Verwerken"
                              : ret.refundStatus === "completed"
                              ? "Voltooid"
                              : ret.refundStatus === "failed"
                              ? "Mislukt"
                              : ret.refundStatus}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <CreateReturnModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
