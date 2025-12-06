import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Package2,
  Archive,
  X
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { PurchaseOrder, Supplier } from "@shared/schema";
import { PurchaseOrderForm } from "@/components/purchase-orders/purchase-order-form";
import { PurchaseOrderDetailModal } from "@/components/purchase-orders/purchase-order-detail-modal";
import { PurchaseOrdersKanban } from "@/components/purchase-orders/purchase-orders-kanban";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { SupplierImportDialog } from "@/components/purchase-orders/supplier-import-dialog";
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
      return (
        po.title?.toLowerCase().includes(query) ||
        po.poNumber?.toLowerCase().includes(query) ||
        supplier?.name?.toLowerCase().includes(query)
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
            <div className="flex items-center gap-2">
              {canCreate && <SupplierImportDialog />}
              <Button
                variant={showArchived ? "outline" : "ghost"}
                onClick={() => setShowArchived(!showArchived)}
                data-testid="button-toggle-archived"
              >
                <Archive className="h-4 w-4 mr-2" />
                {showArchived ? "Toon Actief" : "Toon Archief"}
              </Button>
              {canCreate && (
                <Button onClick={() => setShowNewPO(true)} data-testid="button-new-po">
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuwe Order
                </Button>
              )}
            </div>
          </div>

          {/* Stats Bar - Same style as Returns page */}
          <div className="flex flex-wrap items-center gap-6 p-4 bg-muted/50 rounded-lg mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Totaal:</span>
              <span className="text-sm font-semibold">
                {statusCounts.all}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Aangekocht:</span>
              <span className="text-sm font-semibold text-blue-600">
                {statusCounts.aangekocht}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ontvangen:</span>
              <span className="text-sm font-semibold text-emerald-600">
                {statusCounts.ontvangen}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Verwerkt:</span>
              <span className="text-sm font-semibold text-muted-foreground">
                {statusCounts.verwerkt}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Totale Waarde:</span>
              <span className="text-sm font-semibold text-green-600">
                €{totalAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Zoek op titel, PO nummer, leverancier..."
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Gearchiveerde Orders ({filteredPOs.length})
            </h2>
            {filteredPOs.length === 0 ? (
              <div className="text-center py-12">
                <Package2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Geen gearchiveerde orders</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Gearchiveerde inkoop orders verschijnen hier
                </p>
              </div>
            ) : (
              <PurchaseOrdersTable
                purchaseOrders={filteredPOs}
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
            )}
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
