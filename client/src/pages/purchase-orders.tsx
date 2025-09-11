import { useState } from "react";
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
  RefreshCw,
  Package2,
  Eye,
  MoreHorizontal,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Calendar,
  Building2,
  Euro
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { PurchaseOrder } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchaseOrderSchema } from "@shared/schema";
import type { z } from "zod";
import { InternalNotes } from "@/components/notes/internal-notes";

type PurchaseOrderFormData = z.infer<typeof insertPurchaseOrderSchema>;

type SortField = 'title' | 'supplierName' | 'supplierNumber' | 'purchaseDate' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

export default function PurchaseOrders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('purchaseDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const { toast } = useToast();

  const { data: purchaseOrders, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(insertPurchaseOrderSchema),
    defaultValues: {
      title: "",
      supplierNumber: "",
      supplierName: "",
      purchaseDate: new Date(),
      amount: 0,
      currency: "EUR",
      status: "pending",
      photos: [],
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      const response = await apiRequest("POST", "/api/purchase-orders", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Inkoop order aangemaakt", description: "De inkoop order is succesvol aangemaakt." });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Fout bij aanmaken", 
        description: error.message || "Er is een fout opgetreden bij het aanmaken van de inkoop order.",
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PurchaseOrderFormData> }) => {
      const response = await apiRequest("PATCH", `/api/purchase-orders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Inkoop order bijgewerkt", description: "De inkoop order is succesvol bijgewerkt." });
      setIsEditDialogOpen(false);
      setSelectedPurchaseOrder(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Fout bij bijwerken", 
        description: error.message || "Er is een fout opgetreden bij het bijwerken van de inkoop order.",
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/purchase-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Inkoop order verwijderd", description: "De inkoop order is succesvol verwijderd." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fout bij verwijderen", 
        description: error.message || "Er is een fout opgetreden bij het verwijderen van de inkoop order.",
        variant: "destructive"
      });
    },
  });

  const onSubmit = (data: PurchaseOrderFormData) => {
    if (selectedPurchaseOrder) {
      updateMutation.mutate({ id: selectedPurchaseOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (purchaseOrder: PurchaseOrder) => {
    setSelectedPurchaseOrder(purchaseOrder);
    form.reset({
      title: purchaseOrder.title,
      supplierNumber: purchaseOrder.supplierNumber,
      supplierName: purchaseOrder.supplierName,
      purchaseDate: new Date(purchaseOrder.purchaseDate),
      amount: purchaseOrder.amount,
      currency: purchaseOrder.currency || "EUR",
      status: purchaseOrder.status || "pending",
      photos: purchaseOrder.photos || [],
      notes: purchaseOrder.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Weet je zeker dat je deze inkoop order wilt verwijderen?")) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'ordered': return 'default';
      case 'received': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'In afwachting';
      case 'ordered': return 'Besteld';
      case 'received': return 'Ontvangen';
      case 'cancelled': return 'Geannuleerd';
      default: return status;
    }
  };

  const filteredPurchaseOrders = purchaseOrders?.filter(po => {
    const matchesSearch = !searchQuery || 
      po.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const sortedPurchaseOrders = [...filteredPurchaseOrders].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortField) {
      case 'title':
        aValue = a.title;
        bValue = b.title;
        break;
      case 'supplierName':
        aValue = a.supplierName;
        bValue = b.supplierName;
        break;
      case 'supplierNumber':
        aValue = a.supplierNumber;
        bValue = b.supplierNumber;
        break;
      case 'purchaseDate':
        aValue = new Date(a.purchaseDate).getTime();
        bValue = new Date(b.purchaseDate).getTime();
        break;
      case 'amount':
        aValue = a.amount;
        bValue = b.amount;
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      default:
        aValue = a.title;
        bValue = b.title;
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount / 100);
  };

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navigation />
      
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Inkoop Orders
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Beheer al je inkoop orders en leveranciers
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-purchase-order">
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuwe Inkoop Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nieuwe Inkoop Order</DialogTitle>
                  <DialogDescription>
                    Maak een nieuwe inkoop order aan
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titel</FormLabel>
                          <FormControl>
                            <Input data-testid="input-title" placeholder="Beschrijving van de inkoop" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="supplierNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leverancier nummer</FormLabel>
                            <FormControl>
                              <Input data-testid="input-supplier-number" placeholder="L001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="supplierName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leverancier naam</FormLabel>
                            <FormControl>
                              <Input data-testid="input-supplier-name" placeholder="Leverancier BV" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="purchaseDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Datum inkoop</FormLabel>
                            <FormControl>
                              <Input 
                                data-testid="input-purchase-date"
                                type="date" 
                                value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inkoop bedrag (€)</FormLabel>
                            <FormControl>
                              <Input 
                                data-testid="input-amount"
                                type="number" 
                                step="0.01"
                                placeholder="0.00"
                                value={field.value / 100}
                                onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder="Selecteer status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">In afwachting</SelectItem>
                              <SelectItem value="ordered">Besteld</SelectItem>
                              <SelectItem value="received">Ontvangen</SelectItem>
                              <SelectItem value="cancelled">Geannuleerd</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Opmerkingen</FormLabel>
                          <FormControl>
                            <Textarea 
                              data-testid="textarea-notes"
                              placeholder="Eventuele opmerkingen..."
                              className="min-h-[80px]"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateDialogOpen(false);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Annuleren
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createMutation.isPending}
                        data-testid="button-save"
                      >
                        {createMutation.isPending ? "Aanmaken..." : "Aanmaken"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <TabsList data-testid="tabs-status-filter">
              <TabsTrigger value="all" onClick={() => setStatusFilter("all")}>
                Alle ({purchaseOrders?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="pending" onClick={() => setStatusFilter("pending")}>
                In afwachting ({purchaseOrders?.filter(po => po.status === 'pending').length || 0})
              </TabsTrigger>
              <TabsTrigger value="ordered" onClick={() => setStatusFilter("ordered")}>
                Besteld ({purchaseOrders?.filter(po => po.status === 'ordered').length || 0})
              </TabsTrigger>
              <TabsTrigger value="received" onClick={() => setStatusFilter("received")}>
                Ontvangen ({purchaseOrders?.filter(po => po.status === 'received').length || 0})
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  data-testid="input-search"
                  placeholder="Zoek inkoop orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package2 className="h-5 w-5" />
                  Inkoop Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">Orders laden...</p>
                  </div>
                ) : sortedPurchaseOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Geen inkoop orders</h3>
                    <p className="text-gray-500 mb-4">Je hebt nog geen inkoop orders aangemaakt</p>
                    <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first">
                      <Plus className="h-4 w-4 mr-2" />
                      Eerste inkoop order aanmaken
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer select-none" 
                            onClick={() => handleSort('title')}
                          >
                            <div className="flex items-center gap-1">
                              Titel
                              {sortField === 'title' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none" 
                            onClick={() => handleSort('supplierName')}
                          >
                            <div className="flex items-center gap-1">
                              Leverancier
                              {sortField === 'supplierName' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none" 
                            onClick={() => handleSort('purchaseDate')}
                          >
                            <div className="flex items-center gap-1">
                              Datum
                              {sortField === 'purchaseDate' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none" 
                            onClick={() => handleSort('amount')}
                          >
                            <div className="flex items-center gap-1">
                              Bedrag
                              {sortField === 'amount' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none" 
                            onClick={() => handleSort('status')}
                          >
                            <div className="flex items-center gap-1">
                              Status
                              {sortField === 'status' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="w-[100px]">Acties</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPurchaseOrders.map((purchaseOrder) => (
                          <TableRow key={purchaseOrder.id} data-testid={`row-purchase-order-${purchaseOrder.id}`}>
                            <TableCell className="font-medium">
                              <div className="space-y-1">
                                <div className="font-medium" data-testid={`text-title-${purchaseOrder.id}`}>
                                  {purchaseOrder.title}
                                </div>
                                <div className="text-sm text-gray-500" data-testid={`text-supplier-number-${purchaseOrder.id}`}>
                                  #{purchaseOrder.supplierNumber}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                <span data-testid={`text-supplier-name-${purchaseOrder.id}`}>
                                  {purchaseOrder.supplierName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span data-testid={`text-date-${purchaseOrder.id}`}>
                                  {formatDate(purchaseOrder.purchaseDate)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Euro className="h-4 w-4 text-gray-400" />
                                <span className="font-mono" data-testid={`text-amount-${purchaseOrder.id}`}>
                                  {formatAmount(purchaseOrder.amount)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={getStatusBadgeVariant(purchaseOrder.status || 'pending')}
                                data-testid={`badge-status-${purchaseOrder.id}`}
                              >
                                {getStatusLabel(purchaseOrder.status || 'pending')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0"
                                    data-testid={`button-actions-${purchaseOrder.id}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleEdit(purchaseOrder)}
                                    data-testid={`action-edit-${purchaseOrder.id}`}
                                  >
                                    <Edit3 className="h-4 w-4 mr-2" />
                                    Bewerken
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(purchaseOrder.id)}
                                    className="text-red-600"
                                    data-testid={`action-delete-${purchaseOrder.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Verwijderen
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Inkoop Order Bewerken</DialogTitle>
              <DialogDescription>
                Wijzig de gegevens van de inkoop order
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titel</FormLabel>
                      <FormControl>
                        <Input placeholder="Beschrijving van de inkoop" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="supplierNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leverancier nummer</FormLabel>
                        <FormControl>
                          <Input placeholder="L001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="supplierName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leverancier naam</FormLabel>
                        <FormControl>
                          <Input placeholder="Leverancier BV" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Datum inkoop</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inkoop bedrag (€)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00"
                            value={field.value / 100}
                            onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">In afwachting</SelectItem>
                          <SelectItem value="ordered">Besteld</SelectItem>
                          <SelectItem value="received">Ontvangen</SelectItem>
                          <SelectItem value="cancelled">Geannuleerd</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opmerkingen</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Eventuele opmerkingen..."
                          className="min-h-[80px]"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setSelectedPurchaseOrder(null);
                      form.reset();
                    }}
                  >
                    Annuleren
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Bijwerken..." : "Bijwerken"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}