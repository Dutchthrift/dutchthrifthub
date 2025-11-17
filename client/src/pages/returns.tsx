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
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>Retour Details {selectedReturn?.returnNumber}</DialogTitle>
                <DialogDescription>
                  Volledige retourinformatie en order details
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                data-testid="button-edit-return"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Bewerken
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
            <div className="space-y-6">
              {/* Return Overview & Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Return Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Retour Informatie</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Retournummer:</span>
                      <span className="font-medium">{enrichedReturnData.return.returnNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className={STATUS_COLORS[enrichedReturnData.return.status] || ""}>
                        {getStatusLabel(enrichedReturnData.return.status)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prioriteit:</span>
                      <Badge variant="outline" className={PRIORITY_COLORS[enrichedReturnData.return.priority || 'medium'] || ""}>
                        {enrichedReturnData.return.priority === "low" ? "Laag" : 
                         enrichedReturnData.return.priority === "high" ? "Hoog" : 
                         enrichedReturnData.return.priority === "urgent" ? "Urgent" : "Normaal"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reden:</span>
                      <span className="font-medium text-right max-w-[200px]">
                        {enrichedReturnData.return.returnReason === "defect" ? "Defect" :
                         enrichedReturnData.return.returnReason === "wrong_item" ? "Verkeerd artikel" :
                         enrichedReturnData.return.returnReason === "not_as_described" ? "Niet zoals beschreven" :
                         enrichedReturnData.return.returnReason === "no_longer_needed" ? "Niet meer nodig" :
                         enrichedReturnData.return.returnReason === "other" ? enrichedReturnData.return.otherReason || "Anders" :
                         enrichedReturnData.return.returnReason || "-"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aangevraagd:</span>
                      <span className="font-medium">
                        {format(new Date(enrichedReturnData.return.requestedAt), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    {enrichedReturnData.return.receivedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ontvangen:</span>
                        <span className="font-medium">
                          {format(new Date(enrichedReturnData.return.receivedAt), "dd MMM yyyy HH:mm")}
                        </span>
                      </div>
                    )}
                    {enrichedReturnData.assignedUser && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Toegewezen aan:</span>
                        <span className="font-medium">{enrichedReturnData.assignedUser.fullName}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Klantinformatie</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {enrichedReturnData.customer ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Naam:</span>
                          <span className="font-medium">
                            {enrichedReturnData.customer.firstName} {enrichedReturnData.customer.lastName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{enrichedReturnData.customer.email}</span>
                        </div>
                        {enrichedReturnData.customer.phone && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Telefoon:</span>
                            <span className="font-medium">{enrichedReturnData.customer.phone}</span>
                          </div>
                        )}
                      </>
                    ) : enrichedReturnData.order?.orderData?.customer ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Naam:</span>
                          <span className="font-medium">
                            {enrichedReturnData.order.orderData.customer.first_name} {enrichedReturnData.order.orderData.customer.last_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{enrichedReturnData.order.orderData.customer.email}</span>
                        </div>
                        {enrichedReturnData.order.orderData.customer.phone && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Telefoon:</span>
                            <span className="font-medium">{enrichedReturnData.order.orderData.customer.phone}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground">Geen klantinformatie beschikbaar</div>
                    )}
                    {enrichedReturnData.return.customerNotes && (
                      <>
                        <Separator />
                        <div>
                          <span className="text-sm text-muted-foreground block mb-1">Klant notities:</span>
                          <p className="text-sm">{enrichedReturnData.return.customerNotes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Order Information from Shopify */}
              {enrichedReturnData.order && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Originele Order Informatie</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/orders?orderId=${enrichedReturnData.order.id}`, '_blank')}
                        data-testid="button-view-order"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Bekijk Order
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Ordernummer:</span>
                        <p className="font-medium">{enrichedReturnData.order.orderNumber}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Orderdatum:</span>
                        <p className="font-medium">
                          {enrichedReturnData.order.orderDate ? 
                            format(new Date(enrichedReturnData.order.orderDate), "dd MMM yyyy") : 
                            "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <p className="font-medium capitalize">{enrichedReturnData.order.status}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Totaal bedrag:</span>
                        <p className="font-medium">
                          {formatCurrency(enrichedReturnData.order.totalAmount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Financial Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financiële Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Origineel bedrag:</span>
                      <p className="text-lg font-semibold">
                        {formatCurrency(enrichedReturnData.financialComparison.originalAmount)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Terugbetaling:</span>
                      <p className="text-lg font-semibold">
                        {formatCurrency(enrichedReturnData.financialComparison.refundAmount)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {enrichedReturnData.return.refundStatus === "pending" ? "In afwachting" :
                         enrichedReturnData.return.refundStatus === "processing" ? "Verwerken" :
                         enrichedReturnData.return.refundStatus === "completed" ? "Voltooid" :
                         enrichedReturnData.return.refundStatus === "failed" ? "Mislukt" :
                         enrichedReturnData.return.refundStatus || "Pending"}
                      </span>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Verschil:</span>
                      <p className="text-lg font-semibold">
                        {formatCurrency(enrichedReturnData.financialComparison.difference)}
                      </p>
                    </div>
                  </div>
                  {enrichedReturnData.return.refundMethod && (
                    <div className="mt-4">
                      <span className="text-sm text-muted-foreground">Terugbetalingsmethode: </span>
                      <span className="font-medium capitalize">{enrichedReturnData.return.refundMethod}</span>
                    </div>
                  )}
                  {enrichedReturnData.return.shopifyRefundId && (
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">Shopify Refund ID: </span>
                      <span className="font-mono text-sm">{enrichedReturnData.return.shopifyRefundId}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Return Items */}
              {enrichedReturnData.returnItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Geretourneerde Artikelen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {enrichedReturnData.returnItems.map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg" data-testid={`return-item-${item.id}`}>
                          <div className="flex-1">
                            <div className="font-medium">{item.productName}</div>
                            {item.sku && (
                              <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                            )}
                            <div className="text-sm text-muted-foreground">Aantal: {item.quantity}</div>
                            {item.condition && (
                              <Badge variant="outline" className="mt-1">
                                {item.condition === "unopened" ? "Ongeopend" :
                                 item.condition === "opened_unused" ? "Geopend, ongebruikt" :
                                 item.condition === "used" ? "Gebruikt" :
                                 item.condition === "damaged" ? "Beschadigd" :
                                 item.condition}
                              </Badge>
                            )}
                            {item.restockable && (
                              <Badge variant="outline" className="mt-1 ml-2 bg-chart-2/10 text-chart-2 border-chart-2/20">
                                Kan opnieuw verkocht
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            {item.unitPrice && (
                              <>
                                <div className="font-medium">{formatCurrency(item.unitPrice)}</div>
                                <div className="text-sm text-muted-foreground">
                                  Totaal: {formatCurrency(item.unitPrice * item.quantity)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tracking Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tracking Informatie</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Return Tracking */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Retour Tracking</span>
                      </div>
                      {enrichedReturnData.tracking.returnTracking.trackingNumber ? (
                        <>
                          <p className="font-mono text-sm">{enrichedReturnData.tracking.returnTracking.trackingNumber}</p>
                          {enrichedReturnData.tracking.returnTracking.expectedReturnDate && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Verwacht: {format(new Date(enrichedReturnData.tracking.returnTracking.expectedReturnDate), "dd MMM yyyy")}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Geen tracking beschikbaar</p>
                      )}
                    </div>

                    {/* Order Tracking */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Originele Order Tracking</span>
                      </div>
                      {enrichedReturnData.tracking.orderTracking ? (
                        <>
                          <p className="font-mono text-sm">{enrichedReturnData.tracking.orderTracking.trackingNumber}</p>
                          {enrichedReturnData.tracking.orderTracking.trackingCompany && (
                            <p className="text-sm text-muted-foreground">{enrichedReturnData.tracking.orderTracking.trackingCompany}</p>
                          )}
                          {enrichedReturnData.tracking.orderTracking.trackingUrl && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto mt-1"
                              onClick={() => window.open(enrichedReturnData.tracking.orderTracking!.trackingUrl, '_blank')}
                              data-testid="button-track-shipment"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Track verzending
                            </Button>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Geen tracking beschikbaar</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Photos & Evidence */}
              {enrichedReturnData.photos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Foto's & Bewijs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {enrichedReturnData.photos.map((photo, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
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
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Conditie Notities</span>
                        </div>
                        <p className="text-sm">{enrichedReturnData.return.conditionNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Internal Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Interne Notities</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentUser && (
                    <NotesPanel 
                      entityType="return" 
                      entityId={enrichedReturnData.return.id}
                      currentUser={currentUser}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
