import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { User, Return, ReturnItem } from "@shared/schema";
import { Navigation } from "@/components/layout/navigation";
import { queryClient } from "@/lib/queryClient";
import { Package, Plus, Filter, Search, Calendar, ExternalLink, Truck, Image as ImageIcon, FileText, Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { CreateReturnModal } from "@/components/forms/create-return-modal";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ReturnsKanban } from "@/components/returns/returns-kanban";
import { useToast } from "@/hooks/use-toast";

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
  const { data: allReturns = [], isLoading } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
  });

  // Fetch enriched return details when a return is selected
  const { data: enrichedReturnData, isLoading: isLoadingDetails } = useQuery<EnrichedReturnData>({
    queryKey: ["/api/returns", selectedReturn?.id],
    enabled: !!selectedReturn?.id && showReturnDetails,
    initialData: selectedReturn ? { return: selectedReturn } as EnrichedReturnData : undefined,
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

  const handleViewDetails = (returnItem: Return) => {
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
              {paginatedReturns.map((returnItem) => (
                <Card 
                  key={returnItem.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleViewDetails(returnItem)}
                  data-testid={`archived-return-card-${returnItem.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold font-mono">{returnItem.returnNumber}</h3>
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
                                {returnItem.returnReason === "defect" ? "Defect" :
                                 returnItem.returnReason === "wrong_item" ? "Verkeerd artikel" :
                                 returnItem.returnReason === "not_as_described" ? "Niet zoals beschreven" :
                                 returnItem.returnReason === "no_longer_needed" ? "Niet meer nodig" :
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
            onEditReturn={(returnItem) => {
              setSelectedReturn(returnItem);
              setIsEditing(true);
            }}
            onDeleteReturn={(returnItem) => {
              if (confirm(`Weet je zeker dat je retour ${returnItem.returnNumber} wilt verwijderen?`)) {
                toast({
                  title: "Functie niet beschikbaar",
                  description: "Verwijderen van retouren is nog niet geïmplementeerd.",
                  variant: "destructive",
                });
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

      <CreateReturnModal 
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

      <CreateReturnModal 
        open={isEditing} 
        onOpenChange={setIsEditing}
        editReturn={selectedReturn}
        onReturnCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
          setShowReturnDetails(false);
        }}
      />

      {/* Return Details Dialog */}
      <Dialog open={showReturnDetails} onOpenChange={setShowReturnDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg font-medium">Retour Details {selectedReturn?.returnNumber}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Volledige retourinformatie en order details
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                data-testid="button-edit-return"
                className="h-8"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs">Bewerken</span>
              </Button>
            </div>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : enrichedReturnData && (
            <div className="space-y-2.5">
              {/* Return Overview & Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Return Information */}
                <div className="border rounded-lg p-3">
                  <h3 className="text-sm font-medium mb-2">Retour Informatie</h3>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-muted-foreground">Retournummer:</span>
                      <span className="text-sm">{enrichedReturnData.return.returnNumber}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <Badge variant="outline" className={`text-xs h-5 ${STATUS_COLORS[enrichedReturnData.return.status] || ""}`}>
                        {getStatusLabel(enrichedReturnData.return.status)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs text-muted-foreground">Prioriteit:</span>
                      <Badge variant="outline" className={`text-xs h-5 ${PRIORITY_COLORS[enrichedReturnData.return.priority || 'medium'] || ""}`}>
                        {enrichedReturnData.return.priority === "low" ? "Laag" : 
                         enrichedReturnData.return.priority === "high" ? "Hoog" : 
                         enrichedReturnData.return.priority === "urgent" ? "Urgent" : "Normaal"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-muted-foreground">Reden:</span>
                      <span className="text-sm text-right max-w-[180px]">
                        {enrichedReturnData.return.returnReason === "defect" ? "Defect" :
                         enrichedReturnData.return.returnReason === "wrong_item" ? "Verkeerd artikel" :
                         enrichedReturnData.return.returnReason === "not_as_described" ? "Niet zoals beschreven" :
                         enrichedReturnData.return.returnReason === "no_longer_needed" ? "Niet meer nodig" :
                         enrichedReturnData.return.returnReason === "other" ? enrichedReturnData.return.otherReason || "Anders" :
                         enrichedReturnData.return.returnReason || "-"}
                      </span>
                    </div>
                    <Separator className="my-1.5" />
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-muted-foreground">Aangevraagd:</span>
                      <span className="text-sm">
                        {format(new Date(enrichedReturnData.return.requestedAt), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    {enrichedReturnData.return.receivedAt && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-muted-foreground">Ontvangen:</span>
                        <span className="text-sm">
                          {format(new Date(enrichedReturnData.return.receivedAt), "dd MMM yyyy HH:mm")}
                        </span>
                      </div>
                    )}
                    {enrichedReturnData.assignedUser && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-muted-foreground">Toegewezen aan:</span>
                        <span className="text-sm">{enrichedReturnData.assignedUser.fullName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Information */}
                <div className="border rounded-lg p-3">
                  <h3 className="text-sm font-medium mb-2">Klantinformatie</h3>
                  <div className="space-y-1.5">
                    {enrichedReturnData.customer ? (
                      <>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-muted-foreground">Naam:</span>
                          <span className="text-sm">
                            {enrichedReturnData.customer.firstName} {enrichedReturnData.customer.lastName}
                          </span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-muted-foreground">Email:</span>
                          <span className="text-sm">{enrichedReturnData.customer.email}</span>
                        </div>
                        {enrichedReturnData.customer.phone && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-muted-foreground">Telefoon:</span>
                            <span className="text-sm">{enrichedReturnData.customer.phone}</span>
                          </div>
                        )}
                      </>
                    ) : enrichedReturnData.order?.orderData?.customer ? (
                      <>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-muted-foreground">Naam:</span>
                          <span className="text-sm">
                            {enrichedReturnData.order.orderData.customer.first_name} {enrichedReturnData.order.orderData.customer.last_name}
                          </span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-muted-foreground">Email:</span>
                          <span className="text-sm">{enrichedReturnData.order.orderData.customer.email}</span>
                        </div>
                        {enrichedReturnData.order.orderData.customer.phone && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-muted-foreground">Telefoon:</span>
                            <span className="text-sm">{enrichedReturnData.order.orderData.customer.phone}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">Geen klantinformatie beschikbaar</div>
                    )}
                    {enrichedReturnData.return.customerNotes && (
                      <>
                        <Separator className="my-1.5" />
                        <div>
                          <span className="text-xs text-muted-foreground block mb-0.5">Klant notities:</span>
                          <p className="text-xs">{enrichedReturnData.return.customerNotes}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Information from Shopify */}
              {enrichedReturnData.order && (
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Originele Order Informatie</h3>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => window.open(`/orders?orderId=${enrichedReturnData.order.id}`, '_blank')}
                      data-testid="button-view-order"
                      className="h-6 text-xs p-0"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Bekijk Order
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Ordernummer</span>
                      <p className="text-sm">#{enrichedReturnData.order.orderNumber}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Orderdatum</span>
                      <p className="text-sm">
                        {enrichedReturnData.order.orderDate ? 
                          format(new Date(enrichedReturnData.order.orderDate), "dd MMM yyyy") : 
                          "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Status</span>
                      <p className="text-sm capitalize">{enrichedReturnData.order.status}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-0.5">Totaal bedrag</span>
                      <p className="text-sm">
                        {formatCurrency(enrichedReturnData.order.totalAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Return Items */}
              {enrichedReturnData.returnItems && enrichedReturnData.returnItems.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h3 className="text-sm font-medium mb-2">Geretourneerde Artikelen</h3>
                  <div className="space-y-1.5">
                    {enrichedReturnData.returnItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/30 transition-colors" data-testid={`return-item-${item.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.productName}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.sku && (
                              <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>
                            )}
                            <span className="text-xs text-muted-foreground">Aantal: {item.quantity}</span>
                            {item.condition && (
                              <Badge variant="outline" className="text-xs h-4 px-1.5">
                                {item.condition === "unopened" ? "Ongeopend" :
                                 item.condition === "opened_unused" ? "Geopend" :
                                 item.condition === "used" ? "Gebruikt" :
                                 item.condition === "damaged" ? "Beschadigd" :
                                 item.condition}
                              </Badge>
                            )}
                            {item.restockable && (
                              <Badge variant="outline" className="text-xs h-4 px-1.5 bg-chart-2/10 text-chart-2 border-chart-2/20">
                                Herstelbaar
                              </Badge>
                            )}
                          </div>
                        </div>
                        {item.unitPrice && (
                          <div className="text-right ml-3">
                            <div className="text-sm font-medium">{formatCurrency(item.unitPrice)}</div>
                            <div className="text-xs text-muted-foreground">
                              Totaal: {formatCurrency(item.unitPrice * item.quantity)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracking Information */}
              {enrichedReturnData.tracking && (
                <div className="border rounded-lg p-3">
                  <h3 className="text-sm font-medium mb-2">Tracking Informatie</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* Return Tracking */}
                    <div className="p-2.5 bg-muted/30 rounded border">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">Retour Tracking</span>
                      </div>
                      {enrichedReturnData.tracking.returnTracking?.trackingNumber ? (
                        <>
                          <p className="font-mono text-xs">{enrichedReturnData.tracking.returnTracking.trackingNumber}</p>
                          {enrichedReturnData.tracking.returnTracking.expectedReturnDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Verwacht: {format(new Date(enrichedReturnData.tracking.returnTracking.expectedReturnDate), "dd MMM yyyy")}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Geen tracking beschikbaar</p>
                      )}
                    </div>

                    {/* Order Tracking */}
                    <div className="p-2.5 bg-muted/30 rounded border">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">Originele Order Tracking</span>
                      </div>
                      {enrichedReturnData.tracking.orderTracking ? (
                        <>
                          <p className="font-mono text-xs">{enrichedReturnData.tracking.orderTracking.trackingNumber}</p>
                          {enrichedReturnData.tracking.orderTracking.trackingCompany && (
                            <p className="text-xs text-muted-foreground">{enrichedReturnData.tracking.orderTracking.trackingCompany}</p>
                          )}
                          {enrichedReturnData.tracking.orderTracking.trackingUrl && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto mt-0.5 text-xs"
                              onClick={() => window.open(enrichedReturnData.tracking.orderTracking!.trackingUrl, '_blank')}
                              data-testid="button-track-shipment"
                            >
                              <ExternalLink className="h-3 w-3 mr-0.5" />
                              Track verzending
                            </Button>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Geen tracking beschikbaar</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Photos & Evidence */}
              {enrichedReturnData.photos && enrichedReturnData.photos.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Foto's & Bewijs
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {enrichedReturnData.photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square rounded overflow-hidden border">
                        <img 
                          src={photo} 
                          alt={`Return photo ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(photo, '_blank')}
                          data-testid={`return-photo-${index}`}
                        />
                      </div>
                    ))}
                  </div>
                  {enrichedReturnData.return.conditionNotes && (
                    <div className="mt-2.5 p-2.5 bg-muted/30 rounded border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">Conditie Notities</span>
                      </div>
                      <p className="text-xs">{enrichedReturnData.return.conditionNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Internal Notes */}
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-medium mb-2">Interne Notities</h3>
                {currentUser && (
                  <NotesPanel 
                    entityType="return" 
                    entityId={enrichedReturnData.return.id}
                    currentUser={currentUser}
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
