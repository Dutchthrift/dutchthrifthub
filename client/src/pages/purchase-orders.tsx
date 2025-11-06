import { useState, useRef } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Plus,
  Filter, 
  Download, 
  Package2,
  Building2,
  Euro,
  TrendingUp,
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  List,
  LayoutGrid,
  X
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { PurchaseOrder, Supplier } from "@shared/schema";
import { PurchaseOrderForm } from "@/components/purchase-orders/purchase-order-form";
import { PurchaseOrderDetailModal } from "@/components/purchase-orders/purchase-order-detail-modal";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { PurchaseOrdersCards } from "@/components/purchase-orders/purchase-orders-cards";
import { SupplierImportDialog } from "@/components/purchase-orders/supplier-import-dialog";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PurchaseOrders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [showNewPO, setShowNewPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const canCreate = user?.role === "ADMIN" || user?.role === "SUPPORT";

  const { data: purchaseOrders, isLoading: isLoadingPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const filteredPOs = purchaseOrders?.filter(po => {
    if (statusFilter !== "all" && po.status !== statusFilter) return false;
    if (supplierFilter) {
      const supplier = suppliers?.find(s => s.id === po.supplierId);
      const supplierName = supplier?.name?.toLowerCase() || "";
      const supplierCode = supplier?.supplierCode?.toLowerCase() || "";
      const query = supplierFilter.toLowerCase();
      if (!supplierName.includes(query) && !supplierCode.includes(query)) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        po.title?.toLowerCase().includes(query) ||
        po.poNumber?.toLowerCase().includes(query) ||
        suppliers?.find(s => s.id === po.supplierId)?.name?.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  // Analytics calculations
  const statusCounts = {
    all: purchaseOrders?.length || 0,
    draft: purchaseOrders?.filter(po => po.status === 'draft').length || 0,
    sent: purchaseOrders?.filter(po => po.status === 'sent').length || 0,
    awaiting_delivery: purchaseOrders?.filter(po => po.status === 'awaiting_delivery').length || 0,
    received: purchaseOrders?.filter(po => po.status === 'fully_received').length || 0,
  };

  const totalAmount = purchaseOrders?.reduce((sum, po) => sum + ((po.totalAmount || 0) / 100), 0) || 0;
  
  const pendingDeliveries = purchaseOrders?.filter(po => 
    po.status === 'awaiting_delivery' && po.expectedDeliveryDate
  ).length || 0;

  const overdueDeliveries = purchaseOrders?.filter(po => {
    if (po.status !== 'awaiting_delivery' || !po.expectedDeliveryDate) return false;
    return new Date(po.expectedDeliveryDate) < new Date();
  }).length || 0;

  // Top supplier by spending
  const supplierSpending = purchaseOrders?.reduce((acc, po) => {
    if (po.supplierId) {
      acc[po.supplierId] = (acc[po.supplierId] || 0) + ((po.totalAmount || 0) / 100);
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const topSupplier = Object.entries(supplierSpending).sort((a, b) => b[1] - a[1])[0];
  const topSupplierName = topSupplier 
    ? suppliers?.find(s => s.id === topSupplier[0])?.name || 'Onbekend'
    : 'Geen';
  const topSupplierAmount = topSupplier ? topSupplier[1] : 0;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "sent": return "default";
      case "awaiting_delivery": return "outline";
      case "received": return "default";
      default: return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "text-gray-600 bg-gray-100 dark:bg-gray-800";
      case "sent": return "text-blue-600 bg-blue-100 dark:bg-blue-900";
      case "awaiting_delivery": return "text-orange-600 bg-orange-100 dark:bg-orange-900";
      case "received": return "text-green-600 bg-green-100 dark:bg-green-900";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const handlePOClick = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowDetailModal(true);
  };

  const isLoading = isLoadingPOs || isLoadingSuppliers;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="bg-card rounded-lg p-6 border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Package2 className="h-8 w-8" />
                Inkoop Orders
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Beheer inkoop orders en leveranciers
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canCreate && <SupplierImportDialog />}
              {canCreate && (
                <Button onClick={() => setShowNewPO(true)} data-testid="button-new-po">
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuwe Order
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                Totaal Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-orders">{statusCounts.all}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {statusCounts.draft} concept, {statusCounts.sent} verzonden
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                Totale Waarde
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-value">
                €{totalAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Alle orders gecombineerd
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Leveringen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-pending-deliveries">{pendingDeliveries}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {overdueDeliveries > 0 && (
                  <span className="text-red-600">{overdueDeliveries} te laat</span>
                )}
                {overdueDeliveries === 0 && "Alles op schema"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Top Leverancier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold truncate" data-testid="stat-top-supplier">{topSupplierName}</div>
              <p className="text-xs text-muted-foreground mt-1">
                €{topSupplierAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Zoek op titel, PO nummer, leverancier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-po"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="draft">Concept</SelectItem>
              <SelectItem value="sent">Verzonden</SelectItem>
              <SelectItem value="awaiting_delivery">Onderweg</SelectItem>
              <SelectItem value="received">Ontvangen</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-[200px]">
            <Input
              placeholder="Filter leverancier..."
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full"
              data-testid="input-supplier-filter"
            />
            {supplierFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSupplierFilter("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-pos">
              Alle ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger value="draft" data-testid="tab-draft">
              Concept ({statusCounts.draft})
            </TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent">
              Verzonden ({statusCounts.sent})
            </TabsTrigger>
            <TabsTrigger value="awaiting_delivery" data-testid="tab-awaiting-delivery">
              Onderweg ({statusCounts.awaiting_delivery})
            </TabsTrigger>
            <TabsTrigger value="received" data-testid="tab-received">
              Ontvangen ({statusCounts.received})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground">Laden...</div>
              </div>
            ) : filteredPOs.length === 0 ? (
              <div className="text-center py-12">
                <Package2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Geen orders gevonden</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {searchQuery ? "Probeer een andere zoekopdracht" : "Maak je eerste inkoop order aan"}
                </p>
              </div>
            ) : viewMode === "table" ? (
              <PurchaseOrdersTable
                purchaseOrders={filteredPOs}
                suppliers={suppliers || []}
                onPOClick={handlePOClick}
                getStatusColor={getStatusColor}
              />
            ) : (
              <PurchaseOrdersCards
                purchaseOrders={filteredPOs}
                suppliers={suppliers || []}
                onPOClick={handlePOClick}
                getStatusColor={getStatusColor}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      {showNewPO && (
        <PurchaseOrderForm
          open={showNewPO}
          onClose={() => setShowNewPO(false)}
          suppliers={suppliers || []}
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
        />
      )}
    </div>
  );
}
