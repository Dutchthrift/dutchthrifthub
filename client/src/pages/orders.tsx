import { useState } from "react";
import { Navigation } from "@/components/layout/navigation";
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
  ChevronRight
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Order } from "@/lib/types";
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
import { InternalNotes } from "@/components/notes/internal-notes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type SortField = 'orderNumber' | 'customer' | 'totalAmount' | 'status' | 'paymentStatus' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('orderNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const { toast } = useToast();

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
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
  }>({
    queryKey: ["/api/orders/stats"],
  });

  // Handle both paginated and non-paginated data structures
  const orders = Array.isArray(ordersData) ? ordersData : ordersData?.orders || [];
  const totalOrders = Array.isArray(ordersData) ? ordersData.length : ordersData?.total || 0;
  const totalPages = Math.ceil(totalOrders / pageSize);

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

  const fullSyncMutation = useMutation({
    mutationFn: async () => {
      // Test connection first
      const testResponse = await fetch('/api/shopify/test');
      const testResult = await testResponse.json();
      if (!testResult.success) {
        throw new Error(testResult.message || 'Shopify connection failed');
      }

      // Perform full sync of ALL data
      const response = await fetch("/api/shopify/sync-all", { method: "POST" });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to perform full sync");
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/stats"] });
      
      const customerMsg = `${data.customers.total} klanten (${data.customers.created} nieuw, ${data.customers.updated} bijgewerkt)`;
      const orderMsg = `${data.orders.total} orders (${data.orders.created} nieuw, ${data.orders.updated} bijgewerkt)`;
      
      toast({
        title: "Volledige Shopify import voltooid",
        description: `Import voltooid: ${customerMsg}, ${orderMsg}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Volledige import mislukt",
        description: error instanceof Error ? error.message : "Failed to import all data from Shopify",
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
        !order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
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
      default:
        return 0;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }) || [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
      case "delivered":
        return "default";
      case "processing":
      case "shipped":
        return "secondary";
      case "pending":
        return "outline";
      case "cancelled":
      case "refunded":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CreditCard className="h-4 w-4 text-chart-2" />;
      case "pending":
        return <CreditCard className="h-4 w-4 text-chart-4" />;
      case "refunded":
        return <CreditCard className="h-4 w-4 text-destructive" />;
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
    <div className="min-h-screen bg-background" data-testid="orders-page">
      <Navigation />
      
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6" data-testid="orders-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
            <p className="text-muted-foreground">View and manage customer orders from Shopify</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" data-testid="export-orders-button">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  disabled={syncAllMutation.isPending || fullSyncMutation.isPending}
                  data-testid="sync-shopify-button"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${(syncAllMutation.isPending || fullSyncMutation.isPending) ? 'animate-spin' : ''}`} />
                  {syncAllMutation.isPending ? "Sync nieuwe..." : 
                   fullSyncMutation.isPending ? "Importeer alles..." : "Sync Shopify"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => syncAllMutation.mutate()}
                  disabled={syncAllMutation.isPending || fullSyncMutation.isPending}
                  data-testid="sync-new-orders"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync nieuwe orders
                  <div className="text-xs text-muted-foreground ml-2">
                    (Laatste 250 orders)
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => fullSyncMutation.mutate()}
                  disabled={syncAllMutation.isPending || fullSyncMutation.isPending}
                  data-testid="import-all-orders"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Importeer alle orders
                  <div className="text-xs text-muted-foreground ml-2">
                    (Alle orders uit Shopify)
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
          <Card data-testid="orders-stats-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.all}</div>
            </CardContent>
          </Card>
          
          <Card data-testid="orders-stats-pending">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Package className="h-4 w-4 text-chart-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.pending}</div>
            </CardContent>
          </Card>

          <Card data-testid="orders-stats-processing">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.processing}</div>
            </CardContent>
          </Card>

          <Card data-testid="orders-stats-shipped">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shipped</CardTitle>
              <Truck className="h-4 w-4 text-chart-2" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.shipped}</div>
            </CardContent>
          </Card>

          <Card data-testid="orders-stats-delivered">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <Package className="h-4 w-4 text-chart-2" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.delivered}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search orders, customers..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // Reset to first page when searching
                    }}
                    data-testid="orders-search-input"
                  />
                </div>
                
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList>
                    <TabsTrigger value="all" data-testid="filter-all-orders">All</TabsTrigger>
                    <TabsTrigger value="pending" data-testid="filter-pending-orders">Pending</TabsTrigger>
                    <TabsTrigger value="processing" data-testid="filter-processing-orders">Processing</TabsTrigger>
                    <TabsTrigger value="shipped" data-testid="filter-shipped-orders">Shipped</TabsTrigger>
                    <TabsTrigger value="delivered" data-testid="filter-delivered-orders">Delivered</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="flex items-center space-x-2">
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-32" data-testid="page-size-selector">
                    <SelectValue placeholder="Page size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button variant="outline" size="icon" data-testid="advanced-filters-button">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card data-testid="orders-table">
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
                      onClick={() => handleSort('createdAt')}
                      data-testid="sort-date-header"
                    >
                      <div className="flex items-center">
                        Date
                        {getSortIcon('createdAt')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <span>#{order.orderNumber}</span>
                          {(order.orderData as any)?.line_items?.length > 1 && (
                            <Badge variant="outline" className="text-xs">
                              +{(order.orderData as any).line_items.length - 1}
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
                        <Badge variant={getStatusVariant(order.status)}>
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
                          {new Date(order.createdAt || '').toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
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
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details #{selectedOrder?.orderNumber}</DialogTitle>
              <DialogDescription>
                Complete order information and history
              </DialogDescription>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-6">
                {/* Order Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Order Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Number:</span>
                        <span className="font-medium">#{selectedOrder.orderNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-medium">€{((selectedOrder.totalAmount || 0) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={getStatusVariant(selectedOrder.status)}>
                          {selectedOrder.status?.charAt(0).toUpperCase() + selectedOrder.status?.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Status:</span>
                        <span className="font-medium">
                          {selectedOrder.paymentStatus ? selectedOrder.paymentStatus.charAt(0).toUpperCase() + selectedOrder.paymentStatus.slice(1) : 'Pending'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Date:</span>
                        <span className="font-medium">
                          {new Date(selectedOrder.createdAt || '').toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Customer Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">
                          {(selectedOrder.orderData as any)?.customer ? 
                            `${(selectedOrder.orderData as any).customer.first_name} ${(selectedOrder.orderData as any).customer.last_name}` :
                            'Guest'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{selectedOrder.customerEmail}</span>
                      </div>
                      {(selectedOrder.orderData as any)?.customer?.phone && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium">{(selectedOrder.orderData as any).customer.phone}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Line Items */}
                {(selectedOrder.orderData as any)?.line_items && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Order Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(selectedOrder.orderData as any).line_items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium">{item.title}</div>
                              {item.variant_title && (
                                <div className="text-sm text-muted-foreground">{item.variant_title}</div>
                              )}
                              <div className="text-sm text-muted-foreground">Quantity: {item.quantity}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">€{parseFloat(item.price).toFixed(2)}</div>
                              <div className="text-sm text-muted-foreground">
                                Total: €{(parseFloat(item.price) * item.quantity).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Shipping Address */}
                {(selectedOrder.orderData as any)?.shipping_address && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Shipping Address</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
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

                {/* Team Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Team Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InternalNotes 
                      entityType="order" 
                      entityId={selectedOrder.id}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
