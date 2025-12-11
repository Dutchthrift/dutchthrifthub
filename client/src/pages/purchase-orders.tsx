import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Plus,
  Package2,
  Archive,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { PurchaseOrder, Supplier } from "@shared/schema";
import { PurchaseOrderForm } from "@/components/purchase-orders/purchase-order-form";
import { PurchaseOrderDetailModal } from "@/components/purchase-orders/purchase-order-detail-modal";
import { PurchaseOrdersKanban } from "@/components/purchase-orders/purchase-orders-kanban";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PurchaseOrders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewPO, setShowNewPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState<string | null>(null);
  // Archive filters and pagination
  const [archiveYear, setArchiveYear] = useState<string>("all");
  const [archiveQuarter, setArchiveQuarter] = useState<string>("all");
  const [archivePage, setArchivePage] = useState(1);
  const archiveItemsPerPage = 10;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const canCreate = user?.role === "ADMIN" || user?.role === "SUPPORT";

  const { data: purchaseOrders, isLoading: isLoadingPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Sync selectedPO with updated data when purchaseOrders changes
  useEffect(() => {
    if (selectedPO && purchaseOrders) {
      const updatedPO = purchaseOrders.find(po => po.id === selectedPO.id);
      if (updatedPO) {
        setSelectedPO(updatedPO);
      }
    }
  }, [purchaseOrders, selectedPO?.id]);

  // Filter by archived status and search
  const filteredPOs = purchaseOrders?.filter(po => {
    if (showArchived && !po.archived) return false;
    if (!showArchived && po.archived) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const supplier = suppliers?.find(s => s.id === po.supplierId);

      // Format amount for search (e.g., "600" or "600.00" or "€600")
      const amountInEuros = (po.totalAmount || 0) / 100;
      const amountStr = amountInEuros.toString();
      const amountFormatted = amountInEuros.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Clean query for amount comparison (remove € symbol if present)
      const cleanQuery = query.replace('€', '').trim();

      return (
        po.title?.toLowerCase().includes(query) ||
        po.poNumber?.toLowerCase().includes(query) ||
        supplier?.name?.toLowerCase().includes(query) ||
        amountStr.includes(cleanQuery) ||
        amountFormatted.includes(cleanQuery)
      );
    }
    return true;
  }) || [];

  // Analytics calculations (exclude archived orders)
  const activePOs = purchaseOrders?.filter(po => !po.archived) || [];

  const statusCounts = {
    all: activePOs.length,
    aangekocht: activePOs.filter(po => po.status === 'aangekocht').length,
    ontvangen: activePOs.filter(po => po.status === 'ontvangen').length,
    verwerkt: activePOs.filter(po => po.status === 'verwerkt').length,
  };

  const totalAmount = activePOs.reduce((sum, po) => sum + ((po.totalAmount || 0) / 100), 0);

  const handlePOClick = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowDetailModal(true);
  };

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/purchase-orders/${id}`, { archived: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Gearchiveerd",
        description: "Inkoop order is gearchiveerd",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon order niet archiveren",
        variant: "destructive",
      });
    },
  });

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/purchase-orders/${id}`, { archived: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Hersteld",
        description: "Inkoop order is hersteld uit archief",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon order niet herstellen",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/purchase-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Verwijderd",
        description: "Inkoop order is verwijderd",
      });
      if (selectedPO?.id === deleteMutation.variables) {
        setShowDetailModal(false);
        setSelectedPO(null);
      }
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon order niet verwijderen",
        variant: "destructive",
      });
    },
  });

  const handlePOArchive = (id: string) => {
    archiveMutation.mutate(id);
  };

  const handlePOUnarchive = (id: string) => {
    unarchiveMutation.mutate(id);
  };

  const handlePODelete = (id: string) => {
    setPoToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (poToDelete) {
      deleteMutation.mutate(poToDelete);
      setDeleteConfirmOpen(false);
      setPoToDelete(null);
    }
  };

  const isLoading = isLoadingPOs || isLoadingSuppliers;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-6">
        {/* Header Card */}
        <div className="bg-card rounded-lg p-6 mb-6 border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
                <Package2 className="h-8 w-8" />
                Inkoop Orders
              </h1>
              <p className="text-muted-foreground">Beheer inkoop orders en leveranciers</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant={showArchived ? "outline" : "ghost"}
                onClick={() => setShowArchived(!showArchived)}
                className="flex-1 sm:flex-none text-sm"
                data-testid="button-toggle-archived"
              >
                <Archive className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{showArchived ? "Toon Actief" : "Toon Archief"}</span>
                <span className="sm:hidden">{showArchived ? "Actief" : "Archief"}</span>
              </Button>
              {canCreate && (
                <Button onClick={() => setShowNewPO(true)} className="flex-1 sm:flex-none text-sm" data-testid="button-new-po">
                  <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Nieuwe Order</span>
                  <span className="sm:hidden">Nieuw</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{statusCounts.all}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Totaal</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statusCounts.aangekocht}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Aangekocht</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{statusCounts.ontvangen}</div>
              <div className="text-sm text-emerald-600 dark:text-emerald-400">Ontvangen</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/50 dark:to-gray-900/30 border-gray-200 dark:border-gray-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{statusCounts.verwerkt}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Verwerkt</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800 col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">€{totalAmount.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}</div>
              <div className="text-sm text-green-600 dark:text-green-400">Totale Waarde</div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Zoek op titel, PO nummer, leverancier, bedrag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-po"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Kanban View for Active Orders, Table for Archived */}
        {showArchived ? (
          <div>
            {/* Archive Header with Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Gearchiveerde Orders
              </h2>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={archiveYear} onValueChange={(v) => { setArchiveYear(v); setArchivePage(1); }}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue placeholder="Jaar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle jaren</SelectItem>
                    {Array.from(new Set(filteredPOs.map(po => new Date(po.orderDate || po.createdAt || '').getFullYear()))).sort((a, b) => b - a).map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={archiveQuarter} onValueChange={(v) => { setArchiveQuarter(v); setArchivePage(1); }}>
                  <SelectTrigger className="w-[90px] h-8 text-xs">
                    <SelectValue placeholder="Kwartaal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(() => {
              // Filter by year and quarter
              const dateFilteredPOs = filteredPOs.filter(po => {
                const date = new Date(po.orderDate || po.createdAt || '');
                const year = date.getFullYear();
                const quarter = Math.ceil((date.getMonth() + 1) / 3);

                if (archiveYear !== 'all' && year !== parseInt(archiveYear)) return false;
                if (archiveQuarter !== 'all' && quarter !== parseInt(archiveQuarter)) return false;
                return true;
              });

              // Pagination
              const totalPages = Math.ceil(dateFilteredPOs.length / archiveItemsPerPage);
              const paginatedPOs = dateFilteredPOs.slice(
                (archivePage - 1) * archiveItemsPerPage,
                archivePage * archiveItemsPerPage
              );

              return dateFilteredPOs.length === 0 ? (
                <div className="text-center py-12">
                  <Package2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Geen gearchiveerde orders</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {archiveYear !== 'all' || archiveQuarter !== 'all'
                      ? 'Geen orders gevonden voor de geselecteerde periode'
                      : 'Gearchiveerde inkoop orders verschijnen hier'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground mb-3">
                    {dateFilteredPOs.length} order{dateFilteredPOs.length !== 1 ? 's' : ''} gevonden
                  </div>
                  <PurchaseOrdersTable
                    purchaseOrders={paginatedPOs}
                    suppliers={suppliers || []}
                    onPOClick={handlePOClick}
                    getStatusColor={(status: string) => {
                      switch (status) {
                        case "aangekocht": return "text-blue-600 bg-blue-100 dark:bg-blue-900";
                        case "ontvangen": return "text-green-600 bg-green-100 dark:bg-green-900";
                        case "verwerkt": return "text-gray-600 bg-gray-100 dark:bg-gray-800";
                        default: return "text-gray-600 bg-gray-100";
                      }
                    }}
                    onPOOpen={(id: string) => {
                      const po = purchaseOrders?.find(p => p.id === id);
                      if (po) handlePOClick(po);
                    }}
                    onPOArchive={handlePOArchive}
                    onPOUnarchive={handlePOUnarchive}
                    onPODelete={handlePODelete}
                    onPOStatusChange={() => { }}
                  />

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Pagina {archivePage} van {totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setArchivePage(p => Math.max(1, p - 1))}
                          disabled={archivePage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (archivePage <= 3) {
                              pageNum = i + 1;
                            } else if (archivePage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = archivePage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={archivePage === pageNum ? "default" : "outline"}
                                size="sm"
                                className="w-8 h-8 p-0"
                                onClick={() => setArchivePage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setArchivePage(p => Math.min(totalPages, p + 1))}
                          disabled={archivePage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <PurchaseOrdersKanban
            purchaseOrders={filteredPOs}
            suppliers={suppliers || []}
            isLoading={isLoading}
            onViewPO={handlePOClick}
            onArchivePO={handlePOArchive}
            onUnarchivePO={handlePOUnarchive}
            onDeletePO={handlePODelete}
          />
        )}
      </main>

      {/* Create/Edit Dialog */}
      {showNewPO && (
        <PurchaseOrderForm
          open={showNewPO}
          onClose={() => setShowNewPO(false)}
          suppliers={suppliers || []}
          purchaseOrders={purchaseOrders || []}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPO && (
        <PurchaseOrderDetailModal
          purchaseOrder={selectedPO}
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPO(null);
          }}
          suppliers={suppliers || []}
          purchaseOrders={purchaseOrders || []}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Inkoop order verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze inkoop order wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
