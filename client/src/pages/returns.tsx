import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package, Plus, Filter, Search, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { value: "all", label: "Alle", color: "bg-gray-500" },
  { value: "nieuw_onderweg", label: "Nieuw / Onderweg", color: "bg-blue-500" },
  { value: "ontvangen_controle", label: "Ontvangen (controle)", color: "bg-orange-500" },
  { value: "akkoord_terugbetaling", label: "Akkoord / Terugbetaling", color: "bg-green-500" },
  { value: "vermiste_pakketten", label: "Vermiste Pakketten", color: "bg-red-500" },
  { value: "wachten_klant", label: "Wachten op Klant", color: "bg-yellow-500" },
  { value: "opnieuw_versturen", label: "Opnieuw Versturen", color: "bg-purple-500" },
  { value: "klaar", label: "Klaar", color: "bg-gray-400" },
  { value: "niet_ontvangen", label: "Niet Ontvangen", color: "bg-gray-600" },
];

const STATUS_COLORS: Record<string, string> = {
  nieuw_onderweg: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ontvangen_controle: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  akkoord_terugbetaling: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  vermiste_pakketten: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  wachten_klant: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  opnieuw_versturen: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  klaar: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  niet_ontvangen: "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Returns() {
  const [currentStatus, setCurrentStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Fetch returns with filters
  const { data: returns = [], isLoading } = useQuery<Return[]>({
    queryKey: ["/api/returns", currentStatus !== "all" ? { status: currentStatus } : {}],
  });

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
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
              <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Retouren</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Beheer alle productretouren
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/returns/new">
              <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-create-return">
                <Plus className="h-4 w-4 mr-2" />
                Nieuw Retour
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Totaal:</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {returns.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Nieuw:</span>
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {statusCounts.nieuw_onderweg || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Wachten op klant:</span>
            <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
              {statusCounts.wachten_klant || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Klaar:</span>
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              {statusCounts.klaar || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <Tabs value={currentStatus} onValueChange={setCurrentStatus} className="w-full">
          <div className="px-6">
            <TabsList className="h-12 w-full justify-start gap-1 bg-transparent p-0">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative h-full rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-orange-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-orange-600"
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
          </div>
        </Tabs>

        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-t border-gray-200 dark:border-gray-800">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Zoek op retoournummer of tracking..."
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Geen retouren gevonden
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery || priorityFilter !== "all"
                ? "Probeer een andere zoekopdracht of filter"
                : "Er zijn nog geen retouren in dit overzicht"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReturns.map((ret) => (
              <Link
                key={ret.id}
                href={`/returns/${ret.id}`}
                className="block"
                data-testid={`card-return-${ret.id}`}
              >
                <div className="group rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-all hover:border-orange-300 hover:shadow-sm dark:hover:border-orange-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                          {ret.returnNumber}
                        </span>
                        <Badge className={STATUS_COLORS[ret.status] || ""}>
                          {getStatusLabel(ret.status)}
                        </Badge>
                        {ret.priority && ret.priority !== "medium" && (
                          <Badge className={PRIORITY_COLORS[ret.priority] || ""}>
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
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(ret.refundAmount)}
                        </div>
                      )}
                      {ret.refundStatus && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
