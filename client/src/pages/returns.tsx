import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { User, Return, ReturnItem } from "@shared/schema";
import { Navigation } from "@/components/layout/navigation";
import { queryClient } from "@/lib/queryClient";
import { Package, Plus, Filter, Search, Calendar, ExternalLink, Truck, Image as ImageIcon, FileText, Archive, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CreateReturnWizard } from "@/components/returns/create-return-wizard";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ReturnsKanban } from "@/components/returns/returns-kanban";
import { EditReturnDialog } from "@/components/returns/edit-return-dialog";
import { ReturnDetailModalContent } from "@/components/returns/return-detail-modal-content";

// Extend Return type to include orderNumber which is sent by the backend
type ReturnWithOrder = Return & { orderNumber?: string };

type EnrichedReturnData = {
  return: Return;
  order: any;
  customer: any;
  returnItems: ReturnItem[];
  financialComparison: {
    refundAmount: number;
    originalAmount: number;
    difference: number;
  };
  tracking: {
    returnTracking: {
      trackingNumber: string | null;
      expectedReturnDate: string | null;
    };
    orderTracking: {
      trackingNumber: string;
      trackingUrl: string;
      trackingCompany: string;
    } | null;
  };
  photos: string[];
  notes: any[];
  assignedUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

const STATUS_TABS = [
  { value: "all", label: "Alle" },
  { value: "nieuw", label: "Nieuw (Te Beoordelen)" },
  { value: "onderweg", label: "Onderweg (Met Label)" },
  { value: "ontvangen_controle", label: "Ontvangen (controle)" },
  { value: "akkoord_terugbetaling", label: "Akkoord / Terugbetaling" },
  { value: "vermiste_pakketten", label: "Vermiste Pakketten" },
  { value: "wachten_klant", label: "Wachten op Klant" },
  { value: "opnieuw_versturen", label: "Opnieuw Versturen" },
  { value: "klaar", label: "Klaar" },
  { value: "niet_ontvangen", label: "Niet Ontvangen" },
];

const STATUS_COLORS: Record<string, string> = {
  nieuw: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  onderweg: "bg-primary/10 text-primary border-primary/20",
  nieuw_onderweg: "bg-chart-4/10 text-chart-4 border-chart-4/20", // deprecated
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
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReturnDetails, setShowReturnDetails] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch all returns (filtering done client-side)
  const { data: allReturns = [], isLoading } = useQuery<ReturnWithOrder[]>({
    queryKey: ["/api/returns"],
  });

  // Fetch enriched return details when a return is selected
  const { data: enrichedReturnData, isLoading: isLoadingDetails } = useQuery<EnrichedReturnData>({
    queryKey: ["/api/returns", selectedReturn?.id],
    enabled: !!selectedReturn?.id && showReturnDetails,
    staleTime: 0, // Always refetch in background
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error("Not authenticated");
      const data = await response.json();
      return data.user;
    },
  });

  // Check for returnId in URL and fetch/open return details
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnId = params.get('returnId');

    if (returnId) {
      const existingReturn = allReturns.find(r => r.id === returnId);
      if (existingReturn) {
        setSelectedReturn(existingReturn);
        setShowReturnDetails(true);
        setLocation('/returns');
      } else {
        fetch(`/api/returns/${returnId}`)
          .then(response => {
            if (!response.ok) throw new Error('Return not found');
            return response.json();
          })
          .then(returnData => {
            setSelectedReturn(returnData.return);
            setShowReturnDetails(true);
            setLocation('/returns');
          })
          .catch(error => {
            console.error('Failed to fetch return:', error);
            toast({
              title: "Retour niet gevonden",
              description: "De gevraagde retour kon niet worden gevonden.",
              variant: "destructive",
            });
            setLocation('/returns');
          });
      }
    }
  }, [location, allReturns, setLocation, toast]);

  // Filter by archived status
  const returns = allReturns.filter(ret =>
    showArchived ? ret.isArchived === true : ret.isArchived !== true
  );

  // Filter returns by search query and priority
  const filteredReturns = returns.filter((ret) => {
    const matchesSearch =
      !searchQuery ||
      ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = priorityFilter === "all" || ret.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  // Pagination for archived view
  const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);
  const paginatedReturns = showArchived
    ? filteredReturns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredReturns;

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

  // Helper function to get display identifier for return
  const getReturnDisplayId = (returnItem: Return) => {
    // Prefer Shopify return name (e.g. #9009-R1) over internal RET-2025-XXX
    return returnItem.shopifyReturnName || returnItem.orderNumber || returnItem.returnNumber;
  };

  const syncShopifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/shopify/sync-returns', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Sync failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Shopify Sync Voltooid",
        description: data.message || `${data.created} nieuwe returns geïmporteerd`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Mislukt",
        description: error.message || "Er is een fout opgetreden bij het synchroniseren",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (returnItem: Return) => {
    console.log('Opening return details for:', returnItem);
    setSelectedReturn(returnItem);
    setShowReturnDetails(true);
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
                  variant="outline"
                  onClick={() => syncShopifyMutation.mutate()}
                  disabled={syncShopifyMutation.isPending}
                  data-testid="button-sync-shopify"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncShopifyMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncShopifyMutation.isPending ? 'Synchroniseren...' : 'Sync Shopify'}
                </Button>
                <Button
                  variant={showArchived ? "outline" : "ghost"}
                  onClick={() => {
                    setShowArchived(!showArchived);
                    setCurrentPage(1);
                  }}
                  data-testid="button-toggle-archived"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {showArchived ? "Toon Actief" : "Toon Archief"}
                </Button>
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
                <span className="text-sm font-semibold text-chart-4">
                  {statusCounts.nieuw || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Onderweg:</span>
                <span className="text-sm font-semibold text-primary">
                  {statusCounts.onderweg || 0}
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

        {/* Filters Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
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
                {showArchived ? "Geen gearchiveerde retouren" : "Geen retouren gevonden"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || priorityFilter !== "all"
                  ? "Probeer een andere zoekopdracht of filter"
                  : showArchived
                    ? "Er zijn nog geen gearchiveerde retouren"
                    : "Er zijn nog geen retouren in dit overzicht"}
              </p>
            </CardContent>
          </Card>
        ) : showArchived ? (
          <>
            {/* Archived List View */}
            <div className="space-y-3">
              {paginatedReturns.map((returnItem: ReturnWithOrder) => (
                <Card
                  key={returnItem.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleViewDetails(returnItem)}
                  data-testid={`archived-return-card-${returnItem.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold font-mono">{getReturnDisplayId(returnItem)}</h3>
                          {returnItem.orderNumber && (
                            <span className="text-xs text-muted-foreground font-mono">
                              ({returnItem.returnNumber})
                            </span>
                          )}
                          <Badge variant="outline" className={STATUS_COLORS[returnItem.status] || ""}>
                            {getStatusLabel(returnItem.status)}
                          </Badge>
                          <Badge variant="outline" className={PRIORITY_COLORS[returnItem.priority || 'medium'] || ""}>
                            {returnItem.priority === "low" ? "Laag" :
                              returnItem.priority === "high" ? "Hoog" :
                                returnItem.priority === "urgent" ? "Urgent" : "Normaal"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Aangevraagd:</span>
                            <p className="font-medium">
                              {returnItem.requestedAt ? format(new Date(returnItem.requestedAt), "dd MMM yyyy") : "-"}
                            </p>
                          </div>
                          {returnItem.trackingNumber && (
                            <div>
                              <span className="text-muted-foreground">Tracking:</span>
                              <p className="font-medium font-mono">{returnItem.trackingNumber}</p>
                            </div>
                          )}
                          {returnItem.refundAmount && (
                            <div>
                              <span className="text-muted-foreground">Terugbetaling:</span>
                              <p className="font-medium">€{(returnItem.refundAmount / 100).toFixed(2)}</p>
                            </div>
                          )}
                          {returnItem.returnReason && (
                            <div>
                              <span className="text-muted-foreground">Reden:</span>
                              <p className="font-medium">
                                {returnItem.returnReason === "defective" ? "Defect" :
                                  returnItem.returnReason === "wrong_item" ? "Verkeerd artikel" :
                                    returnItem.returnReason === "damaged" ? "Beschadigd" :
                                      returnItem.returnReason === "size_issue" ? "Maat probleem" :
                                        returnItem.returnReason === "changed_mind" ? "Bedacht" :
                                          returnItem.returnReason === "other" ? returnItem.otherReason || "Anders" :
                                            returnItem.returnReason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Card className="mt-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Pagina {currentPage} van {totalPages} ({filteredReturns.length} resultaten)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Vorige
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Volgende
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <ReturnsKanban
            returns={filteredReturns}
            isLoading={isLoading}
            onViewReturn={handleViewDetails}
            onEditReturn={handleViewDetails}
            onDeleteReturn={async (returnItem) => {
              if (confirm(`Weet je zeker dat je retour ${returnItem.returnNumber} wilt verwijderen?`)) {
                try {
                  const response = await fetch(`/api/returns/${returnItem.id}`, {
                    method: "DELETE",
                    credentials: "include",
                  });

                  if (!response.ok) throw new Error("Failed to delete return");

                  await queryClient.invalidateQueries({ queryKey: ["/api/returns"] });

                  toast({
                    title: "Verwijderd",
                    description: `Retour ${returnItem.returnNumber} is verwijderd.`,
                  });
                } catch (error) {
                  toast({
                    title: "Fout",
                    description: "Er is een fout opgetreden bij het verwijderen.",
                    variant: "destructive",
                  });
                }
              }
            }}
            onArchiveReturn={async (returnItem) => {
              try {
                const response = await fetch(`/api/returns/${returnItem.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isArchived: true }),
                  credentials: "include",
                });

                if (!response.ok) throw new Error("Failed to archive return");

                await queryClient.invalidateQueries({ queryKey: ["/api/returns"] });

                toast({
                  title: "Gearchiveerd",
                  description: `Retour ${returnItem.returnNumber} is gearchiveerd.`,
                });
              } catch (error) {
                toast({
                  title: "Fout",
                  description: "Er is een fout opgetreden bij het archiveren.",
                  variant: "destructive",
                });
              }
            }}
          />
        )}
      </main>

      <CreateReturnWizard
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onReturnCreated={async (returnId) => {
          // Refetch returns to get the newly created one
          await queryClient.invalidateQueries({ queryKey: ["/api/returns"] });

          // Wait a bit for the query to update, then find and open the return
          setTimeout(() => {
            const newReturn = allReturns.find(r => r.id === returnId);
            if (newReturn) {
              setSelectedReturn(newReturn);
              setShowReturnDetails(true);
            }
          }, 100);
        }}
      />

      {/* Edit Return Dialog */}
      {selectedReturn && enrichedReturnData && (
        <EditReturnDialog
          open={isEditing}
          onOpenChange={setIsEditing}
          returnData={enrichedReturnData.return}
          onSave={async (data) => {
            try {
              const response = await fetch(`/api/returns/${selectedReturn.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
              });

              if (!response.ok) throw new Error("Failed to update return");

              await queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/returns", selectedReturn.id] });

              toast({
                title: "Bijgewerkt",
                description: "Retour is succesvol bijgewerkt.",
              });

              setIsEditing(false);
            } catch (error) {
              toast({
                title: "Fout",
                description: "Er is een fout opgetreden bij het bijwerken.",
                variant: "destructive",
              });
            }
          }}
          isSaving={false}
        />
      )}

      {/* Return Details Dialog */}
      <Dialog open={showReturnDetails} onOpenChange={setShowReturnDetails}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-semibold">
              {selectedReturn ? getReturnDisplayId(selectedReturn) : ''}
              {selectedReturn?.orderNumber && (
                <span className="text-sm text-muted-foreground font-normal ml-2">
                  ({selectedReturn.returnNumber})
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Volledige retourinformatie en order details
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : enrichedReturnData && (
            <ReturnDetailModalContent
              enrichedData={enrichedReturnData}
              onUpdate={async (data) => {
                try {
                  const response = await fetch(`/api/returns/${selectedReturn!.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                    credentials: "include",
                  });

                  if (!response.ok) throw new Error("Failed to update return");

                  await queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
                  await queryClient.invalidateQueries({ queryKey: ["/api/returns", selectedReturn!.id] });

                  toast({
                    title: "Bijgewerkt",
                    description: "Retour is succesvol bijgewerkt.",
                  });
                } catch (error) {
                  toast({
                    title: "Fout",
                    description: "Er is een fout opgetreden bij het bijwerken.",
                    variant: "destructive",
                  });
                  throw error;
                }
              }}
              isUpdating={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

