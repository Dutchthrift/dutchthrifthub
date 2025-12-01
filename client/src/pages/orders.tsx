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
              title: "Order not found",
              description: "The requested order could not be found.",
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
        title: "CSV Import Successful",
        description: `Imported: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`,
      });
    },
    onError: (error) => {
      toast({
        title: "CSV Import Failed",
        description: error instanceof Error ? error.message : "Failed to import CSV",
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
        title: "Tracking Number",
        description: `Tracking number: ${trackingNumber}`,
      });
    } else {
      toast({
        title: "No tracking information",
        description: "This order doesn't have tracking information yet.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadInvoice = (order: Order) => {
    // For now, open the Shopify order page or show a message
    const shopifyOrderId = order.shopifyOrderId;
    if (shopifyOrderId) {
      toast({
        title: "Invoice Download",
        description: "Invoice download functionality will be implemented soon.",
      });
    } else {
      toast({
        title: "No invoice available",
        description: "This order doesn't have an associated invoice.",
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
              <h1 className="text-3xl font-medium tracking-tight">Orders</h1>
              <p className="text-muted-foreground font-light">View and manage customer orders from Shopify</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" data-testid="export-orders-button">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                data-testid="import-csv-button"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>

              <Button
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
                data-testid="sync-shopify-button"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                {syncAllMutation.isPending ? "Syncing..." : "Sync Shopify"}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card
            className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer border-l-4 border-l-primary ${statusFilter === 'all' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('all')}
            data-testid="orders-stats-all"
          >
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-primary/10 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {orderStats?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All time orders
              </p>
            </CardContent>
          </Card>

          <Card
            className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer border-l-4 border-l-amber-500 ${statusFilter === 'pending' ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('pending')}
            data-testid="orders-stats-pending"
          >
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-amber-500/10 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{statusCounts.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card
            className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer border-l-4 border-l-blue-500 ${statusFilter === 'processing' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('processing')}
            data-testid="orders-stats-processing"
          >
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-blue-500/10 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{statusCounts.processing}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Being prepared
              </p>
            </CardContent>
          </Card>

          <Card
            className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer border-l-4 border-l-purple-500 ${statusFilter === 'shipped' ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('shipped')}
            data-testid="orders-stats-shipped"
          >
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-purple-500/10 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Shipped</CardTitle>
              <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Truck className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{statusCounts.shipped}</div>
              <p className="text-xs text-muted-foreground mt-1">
                On the way
              </p>
            </CardContent>
          </Card>

          <Card
            className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer border-l-4 border-l-emerald-500 ${statusFilter === 'delivered' ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
            onClick={() => setStatusFilter('delivered')}
            data-testid="orders-stats-delivered"
          >
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-emerald-500/10 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{statusCounts.delivered}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Completed orders
              </p>
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
                  placeholder="Search orders, customers..."
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
                <TabsList className="w-full grid grid-cols-5 h-auto bg-zinc-100/50 dark:bg-zinc-800/50 p-1">
                  <TabsTrigger value="all" data-testid="filter-all-orders" className="text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-sm">All</TabsTrigger>
                  <TabsTrigger value="pending" data-testid="filter-pending-orders" className="text-xs sm:text-sm data-[state=active]:bg-amber-100 dark:data-[state=active]:bg-amber-900/30 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400">Pending</TabsTrigger>
                  <TabsTrigger value="processing" data-testid="filter-processing-orders" className="text-xs sm:text-sm data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400">Processing</TabsTrigger>
                  <TabsTrigger value="shipped" data-testid="filter-shipped-orders" className="text-xs sm:text-sm data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400">Shipped</TabsTrigger>
                  <TabsTrigger value="delivered" data-testid="filter-delivered-orders" className="text-xs sm:text-sm data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-900/30 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400">Delivered</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Page Size and Filters */}
              <div className="flex items-center justify-between gap-2">
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-full sm:w-40 bg-white dark:bg-zinc-950" data-testid="page-size-selector">
                    <SelectValue placeholder="Page size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
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
                No orders found
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
                        Customer
                        {getSortIcon('customer')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('totalAmount')}
                      data-testid="sort-total-header"
                    >
                      <div className="flex items-center">
                        Total
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
                        Payment
                        {getSortIcon('paymentStatus')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('orderDate')}
                      data-testid="sort-date-header"
                    >
                      <div className="flex items-center">
                        Date
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
                              {(order.orderData as any).line_items.length} {(order.orderData as any).line_items.length === 1 ? 'item' : 'items'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">
                            {(order.orderData as any)?.customer ?
                              `${(order.orderData as any).customer.first_name} ${(order.orderData as any).customer.last_name}` :
                              'Guest'
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
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTrackShipment(order)} data-testid={`track-shipment-${order.id}`}>
                              <Truck className="mr-2 h-4 w-4" />
                              Track Shipment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadInvoice(order)} data-testid={`download-invoice-${order.id}`}>
                              <Download className="mr-2 h-4 w-4" />
                              Download Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTeamNotes(order)} data-testid={`team-notes-${order.id}`}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Team Notes
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
                No orders found
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
                          'Guest'
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">€{((order.totalAmount || 0) / 100).toFixed(2)}</div>
                      {(order.orderData as any)?.line_items?.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(order.orderData as any).line_items.length} {(order.orderData as any).line_items.length === 1 ? 'item' : 'items'}
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
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalOrders)} of {totalOrders} orders
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
                Previous
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
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Order Details Dialog */}
        <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-white/95 backdrop-blur-md dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <DialogHeader className="border-b pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-medium tracking-tight flex items-center gap-3">
                    Order {selectedOrder?.orderNumber}
                    {selectedOrder && (
                      <Badge className={`${getStatusColor(selectedOrder.status)} text-sm font-normal px-3 py-1`}>
                        {selectedOrder.status?.charAt(0).toUpperCase() + selectedOrder.status?.slice(1)}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="mt-1 font-light">
                    Placed on {selectedOrder && new Date(selectedOrder.orderDate || selectedOrder.createdAt || '').toLocaleString('nl-NL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </DialogDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-medium text-primary">
                    €{((selectedOrder?.totalAmount || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground font-light">
                    Total Amount
                  </div>
                </div>
              </div>
            </DialogHeader>

            {selectedOrder && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Order Items & History */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Order Items */}
                  <Card className="bg-gradient-to-br from-blue-50/80 to-white/50 dark:from-blue-950/20 dark:to-zinc-900/50 border-2 border-blue-200/70 dark:border-blue-800/50 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <span className="p-1.5 bg-blue-500/10 rounded-lg">
                          <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </span>
                        Order Items
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(selectedOrder.orderData as any)?.line_items?.map((item: any, index: number) => (
                          <div key={index} className="flex items-start gap-4 p-3 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-700/50 transition-colors">
                            <div className="h-16 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <Package className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate" title={item.title}>{item.title}</h4>
                              <p className="text-sm text-muted-foreground font-light mt-1">
                                {item.variant_title && <span className="mr-2">{item.variant_title}</span>}
                                <span>Qty: {item.quantity}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-sm">€{item.price}</div>
                              <div className="text-xs text-muted-foreground font-light">Total: €{(parseFloat(item.price) * item.quantity).toFixed(2)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Timeline / History Placeholder */}
                  <Card className="bg-gradient-to-br from-indigo-50/80 to-white/50 dark:from-indigo-950/20 dark:to-zinc-900/50 border-2 border-indigo-200/70 dark:border-indigo-800/50 border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                        <span className="p-1.5 bg-indigo-500/10 rounded-lg">
                          <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </span>
                        Order History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative pl-4 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-6 my-2">
                        <div className="relative">
                          <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900 ${selectedOrder.status === 'delivered' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                          <div className="text-sm font-medium">Delivered</div>
                          <div className="text-xs text-muted-foreground font-light">Expected delivery</div>
                        </div>
                        <div className="relative">
                          <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900 ${['shipped', 'delivered'].includes(selectedOrder.status || '') ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                          <div className="text-sm font-medium">Shipped</div>
                          <div className="text-xs text-muted-foreground font-light">Order has been shipped</div>
                        </div>
                        <div className="relative">
                          <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900 ${['processing', 'shipped', 'delivered'].includes(selectedOrder.status || '') ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                          <div className="text-sm font-medium">Processing</div>
                          <div className="text-xs text-muted-foreground font-light">Order is being prepared</div>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900 bg-amber-500" />
                          <div className="text-sm font-medium">Order Placed</div>
                          <div className="text-xs text-muted-foreground font-light">
                            {new Date(selectedOrder.createdAt || '').toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Team Notes */}
                  <Card className="bg-gradient-to-br from-rose-50/80 to-white/50 dark:from-rose-950/20 dark:to-zinc-900/50 border-2 border-rose-200/70 dark:border-rose-800/50 border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-rose-900 dark:text-rose-100 flex items-center gap-2">
                        <span className="p-1.5 bg-rose-500/10 rounded-lg">
                          <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        </span>
                        Team Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {currentUser && (
                        <NotesPanel
                          entityType="order"
                          entityId={selectedOrder.id}
                          currentUser={currentUser}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - Customer & Payment Info */}
                <div className="space-y-6">
                  <Card className="bg-gradient-to-br from-purple-50/80 to-white/50 dark:from-purple-950/20 dark:to-zinc-900/50 border-2 border-purple-200/70 dark:border-purple-800/50 border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-purple-900 dark:text-purple-100 flex items-center gap-2">
                        <span className="p-1.5 bg-purple-500/10 rounded-lg">
                          <UserIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </span>
                        Customer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {(selectedOrder.orderData as any)?.customer?.first_name?.[0] || 'G'}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {(selectedOrder.orderData as any)?.customer ?
                              `${(selectedOrder.orderData as any).customer.first_name} ${(selectedOrder.orderData as any).customer.last_name}` :
                              'Guest'
                            }
                          </div>
                          <div className="text-xs text-muted-foreground font-light">Customer</div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-start gap-2 text-sm">
                          <div className="min-w-[20px] text-muted-foreground"><MessageSquare className="h-4 w-4" /></div>
                          <span className="font-light break-all">{selectedOrder.customerEmail}</span>
                        </div>
                        {(selectedOrder.orderData as any)?.customer?.phone && (
                          <div className="flex items-start gap-2 text-sm">
                            <div className="min-w-[20px] text-muted-foreground"><Truck className="h-4 w-4" /></div>
                            <span className="font-light">{(selectedOrder.orderData as any).customer.phone}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {(selectedOrder.orderData as any)?.shipping_address && (
                    <Card className="bg-gradient-to-br from-cyan-50/80 to-white/50 dark:from-cyan-950/20 dark:to-zinc-900/50 border-2 border-cyan-200/70 dark:border-cyan-800/50 border-l-4 border-l-cyan-500 shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg font-medium text-cyan-900 dark:text-cyan-100 flex items-center gap-2">
                          <span className="p-1.5 bg-cyan-500/10 rounded-lg">
                            <Truck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                          </span>
                          Shipping Address
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 text-sm font-light">
                          <div>{(selectedOrder.orderData as any).shipping_address.name}</div>
                          <div>{(selectedOrder.orderData as any).shipping_address.address1}</div>
                          {(selectedOrder.orderData as any).shipping_address.address2 && (
                            <div>{(selectedOrder.orderData as any).shipping_address.address2}</div>
                          )}
                          <div>
                            {(selectedOrder.orderData as any).shipping_address.city}, {(selectedOrder.orderData as any).shipping_address.zip}
                          </div>
                          <div>{(selectedOrder.orderData as any).shipping_address.country}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="bg-gradient-to-br from-emerald-50/80 to-white/50 dark:from-emerald-950/20 dark:to-zinc-900/50 border-2 border-emerald-200/70 dark:border-emerald-800/50 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-500/10 rounded-lg">
                          <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </span>
                        Payment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground font-light">Status</span>
                        <Badge variant="outline" className="font-normal capitalize">
                          {selectedOrder.paymentStatus || 'Pending'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground font-light">Method</span>
                        <span className="text-sm font-medium flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {(selectedOrder.orderData as any)?.payment_gateway_names?.[0] || 'Unknown'}
                        </span>
                      </div>
                      <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-light">Subtotal</span>
                          <span>€{((selectedOrder.totalAmount || 0) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-light">Shipping</span>
                          <span>€0.00</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium pt-2">
                          <span>Total</span>
                          <span className="text-primary">€{((selectedOrder.totalAmount || 0) / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}


          </DialogContent>
        </Dialog>

        {/* CSV Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Orders from CSV</DialogTitle>
              <DialogDescription>
                Upload a Shopify order export CSV file to import orders into the system. The system will automatically create or update orders and customers.
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
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
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
                  Cancel
                </Button>
                <Button
                  onClick={() => selectedFile && importCSVMutation.mutate(selectedFile)}
                  disabled={!selectedFile || importCSVMutation.isPending}
                  data-testid="confirm-import-button"
                >
                  {importCSVMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Orders
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
