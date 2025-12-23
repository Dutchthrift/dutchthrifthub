import { useState, useEffect } from "react";
import { Navigation } from "@/components/layout/navigation";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Package,
  CreditCard,
  Truck,
  Eye,
  MoreHorizontal,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Clock,
  User as UserIcon,
  FileText
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Order } from "@/lib/types";
import type { User } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PickingListModal } from '@/components/picking/picking-list-modal';

type SortField = 'orderNumber' | 'customer' | 'totalAmount' | 'status' | 'paymentStatus' | 'createdAt' | 'orderDate';
type SortDirection = 'asc' | 'desc';

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('orderDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPickingList, setShowPickingList] = useState(false); // New State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const { data: ordersData, isLoading } = useQuery<{ orders: Order[], total: number } | Order[]>({
    queryKey: ["/api/orders", currentPage, pageSize, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      const response = await fetch(`/api/orders?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      return response.json();
    },
  });

  const { data: orderStats } = useQuery<{
    total: number;
    totalAmount: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
  }>({
    queryKey: ["/api/orders/stats"],
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

  // Handle both paginated and non-paginated data structures
  const orders = Array.isArray(ordersData) ? ordersData : ordersData?.orders || [];
  const totalOrders = Array.isArray(ordersData) ? ordersData.length : ordersData?.total || 0;
  const totalPages = Math.ceil(totalOrders / pageSize);

  // Check for orderId in URL and fetch/open order details
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');

    if (orderId) {
      // First check if the order is already in the loaded orders
      const existingOrder = orders.find(o => o.id === orderId);
      if (existingOrder) {
        setSelectedOrder(existingOrder);
        setShowOrderDetails(true);
        setLocation('/orders');
      } else {
        // Fetch the specific order by ID
        fetch(`/api/orders/${orderId}`)
          .then(response => {
            if (!response.ok) throw new Error('Order not found');
            return response.json();
          })
          .then(order => {
            setSelectedOrder(order);
            setShowOrderDetails(true);
            setLocation('/orders');
          })
          .catch(error => {
            console.error('Failed to fetch order:', error);
            toast({
              title: "Order niet gevonden",
              description: "De gevraagde order kon niet worden gevonden.",
              variant: "destructive",
            });
            setLocation('/orders');
          });
      }
    }
  }, [location, orders, setLocation, toast]);

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      // Test connection first
      const testResponse = await fetch('/api/shopify/test');
      const testResult = await testResponse.json();
      if (!testResult.success) {
        throw new Error(testResult.message || 'Shopify connection failed');
      }

      // Sync both customers and orders (incremental)
      const [customersResponse, ordersResponse] = await Promise.all([
        fetch("/api/customers/sync", { method: "POST" }),
        fetch("/api/orders/sync", { method: "POST" })
      ]);

      if (!customersResponse.ok) throw new Error("Failed to sync customers");
      if (!ordersResponse.ok) throw new Error("Failed to sync orders");

      const customersData = await customersResponse.json();
      const ordersData = await ordersResponse.json();

      return { customersData, ordersData };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Shopify sync voltooid",
        description: `Gesynchroniseerd: ${data.customersData.synced || 0} klanten en ${data.ordersData.synced || 0} orders`,
      });
    },
    onError: (error) => {
      toast({
        title: "Sync mislukt",
        description: error instanceof Error ? error.message : "Failed to sync from Shopify",
        variant: "destructive",
      });
    }
  });

  const importCSVMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/orders/import-csv', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'CSV import failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/stats"] });
      setShowImportDialog(false);
      setSelectedFile(null);
      toast({
        title: "CSV Import Succesvol",
        description: `Geïmporteerd: ${data.created} aangemaakt, ${data.updated} bijgewerkt, ${data.skipped} overgeslagen`,
      });
    },
    onError: (error) => {
      toast({
        title: "CSV Import Mislukt",
        description: error instanceof Error ? error.message : "CSV import is mislukt",
        variant: "destructive",
      });
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: string) => {
    setPageSize(parseInt(size));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const handleTrackShipment = (order: Order) => {
    // Check if there's tracking information in the order data
    const trackingNumber = (order.orderData as any)?.fulfillments?.[0]?.tracking_number;
    const trackingUrl = (order.orderData as any)?.fulfillments?.[0]?.tracking_url;

    if (trackingUrl) {
      window.open(trackingUrl, '_blank', 'noopener,noreferrer');
    } else if (trackingNumber) {
      toast({
        title: "Trackingnummer",
        description: `Trackingnummer: ${trackingNumber}`,
      });
    } else {
      toast({
        title: "Geen trackinginformatie",
        description: "Deze order heeft nog geen trackinginformatie.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadInvoice = (order: Order) => {
    // For now, open the Shopify order page or show a message
    const shopifyOrderId = order.shopifyOrderId;
    if (shopifyOrderId) {
      toast({
        title: "Factuur Downloaden",
        description: "Factuur download functionaliteit wordt binnenkort toegevoegd.",
      });
    } else {
      toast({
        title: "Geen factuur beschikbaar",
        description: "Deze order heeft geen gekoppelde factuur.",
        variant: "destructive",
      });
    }
  };

  const handleTeamNotes = (order: Order) => {
    // Set the order for notes display
    setSelectedOrder(order);
    setShowOrderDetails(true);
    // Future: Could scroll to notes section or open a separate dialog
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === 'asc' ?
      <ChevronUp className="ml-2 h-4 w-4" /> :
      <ChevronDown className="ml-2 h-4 w-4" />;
  };

  const filteredAndSortedOrders = orders?.filter(order => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (searchQuery &&
      !String(order.orderNumber).toLowerCase().includes(searchQuery.toLowerCase()) &&
      !order.customerEmail?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortField) {
      case 'orderNumber':
        aVal = parseInt(a.orderNumber.replace(/[^0-9]/g, '')) || 0;
        bVal = parseInt(b.orderNumber.replace(/[^0-9]/g, '')) || 0;
        break;
      case 'customer':
        const aCustomer = (a.orderData as any)?.customer ?
          `${(a.orderData as any).customer.first_name} ${(a.orderData as any).customer.last_name}` :
          'Guest';
        const bCustomer = (b.orderData as any)?.customer ?
          `${(b.orderData as any).customer.first_name} ${(b.orderData as any).customer.last_name}` :
          'Guest';
        aVal = aCustomer.toLowerCase();
        bVal = bCustomer.toLowerCase();
        break;
      case 'totalAmount':
        aVal = a.totalAmount || 0;
        bVal = b.totalAmount || 0;
        break;
      case 'status':
        aVal = a.status?.toLowerCase() || '';
        bVal = b.status?.toLowerCase() || '';
        break;
      case 'paymentStatus':
        aVal = a.paymentStatus?.toLowerCase() || '';
        bVal = b.paymentStatus?.toLowerCase() || '';
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt || '').getTime();
        bVal = new Date(b.createdAt || '').getTime();
        break;
      case 'orderDate':
        aVal = new Date(a.orderDate || a.createdAt || '').getTime();
        bVal = new Date(b.orderDate || b.createdAt || '').getTime();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
      case "delivered":
        return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30";
      case "processing":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30";
      case "shipped":
        return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30";
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30";
      case "cancelled":
      case "refunded":
        return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "pending":
        return <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "refunded":
        return <CreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
      default:
        return <CreditCard className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusCounts = {
    all: orderStats?.total || 0,
    pending: orderStats?.pending || 0,
    processing: orderStats?.processing || 0,
    shipped: orderStats?.shipped || 0,
    delivered: orderStats?.delivered || 0,
  };

  return (
    <div className="min-h-screen bg-background animate-fade-in" data-testid="orders-page">
      <Navigation />

      <main className="container mx-auto px-4 py-6">
        <div className="bg-card rounded-lg p-6 mb-6 border" data-testid="orders-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
              <p className="text-muted-foreground">Bekijk en beheer klantorders van Shopify</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
                data-testid="sync-shopify-button"
              >
                <RefreshCw className={`h-4 w-4 mr-1 sm:mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncAllMutation.isPending ? "Synchroniseren..." : "Synchroniseer Shopify"}</span>
                <span className="sm:hidden">{syncAllMutation.isPending ? "Sync..." : "Sync"}</span>
              </Button>
              <Button onClick={() => setShowPickingList(true)} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Order Picken
              </Button>
            </div>
          </div>
        </div>

        <PickingListModal open={showPickingList} onOpenChange={setShowPickingList} />

        {/* Stats Cards - Repairs page gradient style */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5 mb-6 sm:mb-8">
          <Card
            className={`bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-slate-200 dark:border-slate-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${statusFilter === 'all' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('all')}
            data-testid="orders-stats-all"
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                {orderStats?.total || 0}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Totaal Orders</div>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${statusFilter === 'pending' ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('pending')}
            data-testid="orders-stats-pending"
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{statusCounts.pending}</div>
              <div className="text-sm text-amber-600 dark:text-amber-400">In afwachting</div>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${statusFilter === 'processing' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('processing')}
            data-testid="orders-stats-processing"
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statusCounts.processing}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">In behandeling</div>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${statusFilter === 'shipped' ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('shipped')}
            data-testid="orders-stats-shipped"
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{statusCounts.shipped}</div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Verzonden</div>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${statusFilter === 'delivered' ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('delivered')}
            data-testid="orders-stats-delivered"
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{statusCounts.delivered}</div>
              <div className="text-sm text-green-600 dark:text-green-400">Afgeleverd</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        {/* Filters and Search */}
        <Card className="mb-6 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Zoek orders, klanten..."
                  className="pl-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                  data-testid="orders-search-input"
                />
              </div>

              {/* Status Tabs */}
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="w-full flex overflow-x-auto scrollbar-hide h-auto bg-zinc-100/50 dark:bg-zinc-800/50 p-1">
                  <TabsTrigger value="all" data-testid="filter-all-orders" className="text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-sm">Alle</TabsTrigger>
                  <TabsTrigger value="pending" data-testid="filter-pending-orders" className="text-xs sm:text-sm data-[state=active]:bg-amber-100 dark:data-[state=active]:bg-amber-900/30 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400">In afwachting</TabsTrigger>
                  <TabsTrigger value="processing" data-testid="filter-processing-orders" className="text-xs sm:text-sm data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400">In behandeling</TabsTrigger>
                  <TabsTrigger value="shipped" data-testid="filter-shipped-orders" className="text-xs sm:text-sm data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400">Verzonden</TabsTrigger>
                  <TabsTrigger value="delivered" data-testid="filter-delivered-orders" className="text-xs sm:text-sm data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-900/30 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400">Afgeleverd</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Page Size and Filters */}
              <div className="flex items-center justify-between gap-2">
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-full sm:w-40 bg-white dark:bg-zinc-950" data-testid="page-size-selector">
                    <SelectValue placeholder="Paginagrootte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 per pagina</SelectItem>
                    <SelectItem value="50">50 per pagina</SelectItem>
                    <SelectItem value="100">100 per pagina</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon" data-testid="advanced-filters-button" className="bg-white dark:bg-zinc-950">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table - Desktop */}
        <Card data-testid="orders-table" className="hidden md:block">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-4 bg-muted rounded w-32"></div>
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : filteredAndSortedOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen orders gevonden
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('orderNumber')}
                      data-testid="sort-order-header"
                    >
                      <div className="flex items-center">
                        Order
                        {getSortIcon('orderNumber')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('customer')}
                      data-testid="sort-customer-header"
                    >
                      <div className="flex items-center">
                        Klant
                        {getSortIcon('customer')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('totalAmount')}
                      data-testid="sort-total-header"
                    >
                      <div className="flex items-center">
                        Totaal
                        {getSortIcon('totalAmount')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('status')}
                      data-testid="sort-status-header"
                    >
                      <div className="flex items-center">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('paymentStatus')}
                      data-testid="sort-payment-header"
                    >
                      <div className="flex items-center">
                        Betaling
                        {getSortIcon('paymentStatus')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('orderDate')}
                      data-testid="sort-date-header"
                    >
                      <div className="flex items-center">
                        Datum
                        {getSortIcon('orderDate')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      data-testid={`order-row-${order.id}`}
                      className="cursor-pointer hover:bg-muted/50 animate-slide-in"
                      onClick={() => handleViewDetails(order)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <span
                            className="text-primary font-medium"
                            data-testid={`order-number-${order.id}`}
                          >
                            {order.orderNumber}
                          </span>
                          {(order.orderData as any)?.line_items?.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {(order.orderData as any).line_items.length} {(order.orderData as any).line_items.length === 1 ? 'artikel' : 'artikelen'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">
                            {(order.orderData as any)?.customer ?
                              `${(order.orderData as any).customer.first_name} ${(order.orderData as any).customer.last_name}` :
                              'Gast'
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          €{((order.totalAmount || 0) / 100).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(order.status)} hover:opacity-90 transition-opacity`}>
                          {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {getPaymentStatusIcon(order.paymentStatus || 'pending')}
                          <span className="text-sm">
                            {order.paymentStatus ? order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1) : 'Pending'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(order.orderDate || order.createdAt || '').toLocaleString('nl-NL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`order-actions-${order.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(order)} data-testid={`view-details-${order.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Bekijk Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTrackShipment(order)} data-testid={`track-shipment-${order.id}`}>
                              <Truck className="mr-2 h-4 w-4" />
                              Volg Verzending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadInvoice(order)} data-testid={`download-invoice-${order.id}`}>
                              <Download className="mr-2 h-4 w-4" />
                              Download Factuur
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTeamNotes(order)} data-testid={`team-notes-${order.id}`}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Team Notities
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Orders Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-3 bg-muted rounded w-32"></div>
                  <div className="h-3 bg-muted rounded w-20"></div>
                </CardContent>
              </Card>
            ))
          ) : filteredAndSortedOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Geen orders gevonden
              </CardContent>
            </Card>
          ) : (
            filteredAndSortedOrders.map((order) => (
              <Card
                key={order.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors animate-slide-in"
                onClick={() => handleViewDetails(order)}
                data-testid={`order-card-${order.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-medium text-primary mb-1" data-testid={`order-number-${order.id}`}>
                        {order.orderNumber}
                      </div>
                      <div className="text-sm font-normal">
                        {(order.orderData as any)?.customer ?
                          `${(order.orderData as any).customer.first_name} ${(order.orderData as any).customer.last_name}` :
                          'Gast'
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">€{((order.totalAmount || 0) / 100).toFixed(2)}</div>
                      {(order.orderData as any)?.line_items?.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(order.orderData as any).line_items.length} {(order.orderData as any).line_items.length === 1 ? 'artikel' : 'artikelen'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${getStatusColor(order.status)} hover:opacity-90 transition-opacity`}>
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {order.paymentStatus ? order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1) : 'Pending'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(order.orderDate || order.createdAt || '').toLocaleDateString('nl-NL')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Toont {((currentPage - 1) * pageSize) + 1} tot {Math.min(currentPage * pageSize, totalOrders)} van {totalOrders} orders
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                data-testid="prev-page-button"
              >
                <ChevronLeft className="h-4 w-4" />
                Vorige
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      data-testid={`page-${page}-button`}
                    >
                      {page}
                    </Button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    {currentPage < totalPages - 2 && <span className="px-2">...</span>}
                    <Button
                      variant={currentPage === totalPages ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      data-testid={`page-${totalPages}-button`}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                data-testid="next-page-button"
              >
                Volgende
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Order Details Dialog */}
        <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
          <DialogContent className="w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            {selectedOrder && (
              <>
                {/* Header - centered design */}
                <DialogHeader className="pb-2 border-b text-center">
                  <DialogTitle className="text-sm font-semibold flex items-center justify-center gap-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <span>Order {selectedOrder.orderNumber}</span>
                    <Badge className={`${getStatusColor(selectedOrder.status)} text-[10px] font-normal px-1.5 py-0`}>
                      {selectedOrder.status?.charAt(0).toUpperCase() + selectedOrder.status?.slice(1)}
                    </Badge>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedOrder.orderDate || selectedOrder.createdAt || '').toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })} om {new Date(selectedOrder.orderDate || selectedOrder.createdAt || '').toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} • <span className="font-medium text-foreground">€{((selectedOrder.totalAmount || 0) / 100).toFixed(2)}</span>
                  </p>
                </DialogHeader>

                {/* Horizontal Status Timeline - centered */}
                <div className="py-3 border-b">
                  <div className="flex items-center justify-center px-4">
                    {[
                      { value: 'pending', label: 'Geplaatst', color: 'text-amber-500' },
                      { value: 'processing', label: 'In behandeling', color: 'text-blue-500' },
                      { value: 'shipped', label: 'Verzonden', color: 'text-purple-500' },
                      { value: 'delivered', label: 'Afgeleverd', color: 'text-emerald-500' },
                    ].map((status, idx, arr) => {
                      const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
                      const currentIdx = statusOrder.indexOf(selectedOrder.status || 'pending');
                      const isCompleted = idx <= currentIdx;
                      const isCurrent = statusOrder[currentIdx] === status.value;
                      return (
                        <div key={status.value} className="flex items-center">
                          <div className={`flex flex-col items-center gap-1 ${isCurrent ? 'scale-110' : ''}`}>
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isCompleted ? status.color + ' border-current' : 'border-gray-300 dark:border-gray-600'}`}>
                              {isCompleted && <div className={`h-2 w-2 rounded-full ${status.color} bg-current`} />}
                            </div>
                            <span className={`text-[10px] whitespace-nowrap ${isCurrent ? 'font-semibold ' + status.color : 'text-muted-foreground'}`}>
                              {status.label}
                            </span>
                          </div>
                          {idx < arr.length - 1 && (
                            <div className={`w-6 sm:w-10 h-0.5 mx-1 ${idx < currentIdx ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Main Content - Mobile First Layout */}
                <div className="py-3 space-y-4">
                  {/* Customer & Shipping - Show FIRST on mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 order-first lg:order-none">
                    {/* Customer Info - Compact */}
                    <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200/50 dark:border-purple-800/30">
                      <div className="flex items-center gap-2 mb-2">
                        <UserIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-medium text-purple-900 dark:text-purple-100">Klant</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                            {(selectedOrder.orderData as any)?.customer?.first_name?.[0] || 'G'}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {(selectedOrder.orderData as any)?.customer ?
                                `${(selectedOrder.orderData as any).customer.first_name} ${(selectedOrder.orderData as any).customer.last_name}` :
                                'Gast'
                              }
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground break-all pl-9">{selectedOrder.customerEmail}</div>
                        {(selectedOrder.orderData as any)?.customer?.phone && (
                          <div className="text-xs text-muted-foreground pl-9">{(selectedOrder.orderData as any).customer.phone}</div>
                        )}
                      </div>
                    </div>

                    {/* Shipping Address - Compact */}
                    {(selectedOrder.orderData as any)?.shipping_address && (
                      <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 rounded-lg border border-cyan-200/50 dark:border-cyan-800/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          <span className="text-xs font-medium text-cyan-900 dark:text-cyan-100">Verzendadres</span>
                        </div>
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium">{(selectedOrder.orderData as any).shipping_address.name}</div>
                          <div>{(selectedOrder.orderData as any).shipping_address.address1}</div>
                          {(selectedOrder.orderData as any).shipping_address.address2 && (
                            <div>{(selectedOrder.orderData as any).shipping_address.address2}</div>
                          )}
                          <div>{(selectedOrder.orderData as any).shipping_address.city}, {(selectedOrder.orderData as any).shipping_address.zip}</div>
                          <div>{(selectedOrder.orderData as any).shipping_address.country}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Items - Compact */}
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-900 dark:text-blue-100">Orderartikelen</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {(selectedOrder.orderData as any)?.line_items?.length || 0} {((selectedOrder.orderData as any)?.line_items?.length || 0) === 1 ? 'artikel' : 'artikelen'}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {(selectedOrder.orderData as any)?.line_items?.map((item: any, index: number) => (
                        <div key={index} className="flex items-center gap-3 p-2 bg-white/50 dark:bg-zinc-800/50 rounded-md">
                          <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-700 rounded flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs truncate" title={item.title}>{item.title}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {item.variant_title && <span className="mr-2">{item.variant_title}</span>}
                              <span>×{item.quantity}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-medium text-xs">€{item.price}</div>
                            {item.quantity > 1 && (
                              <div className="text-[10px] text-muted-foreground">Totaal: €{(parseFloat(item.price) * item.quantity).toFixed(2)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Summary - Inline Compact */}
                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Betaling</span>
                      <Badge variant="outline" className="text-[10px] ml-auto capitalize">
                        {selectedOrder.paymentStatus || 'Pending'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Methode</span>
                        <div className="font-medium">{(selectedOrder.orderData as any)?.payment_gateway_names?.[0] || 'Onbekend'}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Subtotaal</span>
                        <div className="font-medium">€{((selectedOrder.totalAmount || 0) / 100).toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Verzending</span>
                        <div className="font-medium">€0.00</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Totaal</span>
                        <div className="font-semibold text-primary">€{((selectedOrder.totalAmount || 0) / 100).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Notes - At the bottom, renamed from "Team Notities" */}
                  <Collapsible>
                    <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-lg border border-slate-200/50 dark:border-slate-800/30">
                      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                        <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">Notities</span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        {currentUser && (
                          <NotesPanel
                            entityType="order"
                            entityId={selectedOrder.id}
                            currentUser={currentUser}
                          />
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* CSV Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Orders Importeren uit CSV</DialogTitle>
              <DialogDescription>
                Upload een Shopify order export CSV-bestand om orders in het systeem te importeren. Het systeem maakt automatisch orders en klanten aan of werkt ze bij.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  disabled={importCSVMutation.isPending}
                  data-testid="csv-file-input"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Geselecteerd: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportDialog(false);
                    setSelectedFile(null);
                  }}
                  disabled={importCSVMutation.isPending}
                  data-testid="cancel-import-button"
                >
                  Annuleren
                </Button>
                <Button
                  onClick={() => selectedFile && importCSVMutation.mutate(selectedFile)}
                  disabled={!selectedFile || importCSVMutation.isPending}
                  data-testid="confirm-import-button"
                >
                  {importCSVMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Importeren...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importeer Orders
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div >
  );
}
