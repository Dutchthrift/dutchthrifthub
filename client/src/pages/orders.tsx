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
  ChevronsUpDown
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
import { InternalNotes } from "@/components/notes/internal-notes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type SortField = 'orderNumber' | 'customer' | 'totalAmount' | 'status' | 'paymentStatus' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('orderNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      // Test connection first
      const testResponse = await fetch('/api/shopify/test');
      const testResult = await testResponse.json();
      if (!testResult.success) {
        throw new Error(testResult.message || 'Shopify connection failed');
      }

      // Sync both customers and orders
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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
    all: orders?.length || 0,
    pending: orders?.filter(o => o.status === 'pending').length || 0,
    processing: orders?.filter(o => o.status === 'processing').length || 0,
    shipped: orders?.filter(o => o.status === 'shipped').length || 0,
    delivered: orders?.filter(o => o.status === 'delivered').length || 0,
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
            <Button 
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending}
              data-testid="sync-shopify-button"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
              {syncAllMutation.isPending ? "Synchroniseren..." : "Sync Shopify"}
            </Button>
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
                    onChange={(e) => setSearchQuery(e.target.value)}
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
              
              <Button variant="outline" size="icon" data-testid="advanced-filters-button">
                <Filter className="h-4 w-4" />
              </Button>
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Truck className="mr-2 h-4 w-4" />
                              Track Shipment
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem>
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
      </main>
    </div>
  );
}
