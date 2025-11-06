import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, X, Search, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Customer, Order } from "@shared/schema";

interface RepairFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair?: any;
  users: User[];
}

interface FormData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  estimatedCost: number;
  productSku: string;
  productName: string;
  issueCategory: string;
  assignedUserId: string;
  customerId: string;
  orderId: string;
}

const ISSUE_CATEGORIES = [
  "Lensdefect - autofocus werkt niet",
  "Lensdefect - beeldstabilisatie defect",
  "Lensdefect - diafragma vastgelopen",
  "Lensdefect - schade aan lenselement",
  "Camera - sluiter defect",
  "Camera - sensor vervuiling",
  "Camera - schade aan behuizing",
  "Camera - batterij/oplaad probleem",
  "Camera - display defect",
  "Camera - knoppen/draaiknoppen defect",
  "Mechanische schade",
  "Water/vochtschade",
  "Overig",
];

export function RepairForm({ open, onOpenChange, repair, users }: RepairFormProps) {
  const [slaDeadline, setSlaDeadline] = useState<Date | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [showOrderResults, setShowOrderResults] = useState(false);
  const [selectedOrderDisplay, setSelectedOrderDisplay] = useState<string>("");
  const [selectedOrderData, setSelectedOrderData] = useState<any>(null);
  const [otherCategoryDetails, setOtherCategoryDetails] = useState("");
  const { toast } = useToast();

  const { data: customers = [], isError: customersError } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
    enabled: open,
  });

  const { data: orders = [], isError: ordersError } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    enabled: open,
  });

  // Search orders API
  const { data: orderSearchResults } = useQuery<any>({
    queryKey: [`/api/search?q=${orderSearchQuery}`],
    enabled: orderSearchQuery.length > 2,
  });

  useEffect(() => {
    if (customersError) {
      toast({
        title: "Fout bij laden klanten",
        description: "Kon klanten niet laden. Probeer opnieuw.",
        variant: "destructive",
      });
    }
  }, [customersError, toast]);

  useEffect(() => {
    if (ordersError) {
      toast({
        title: "Fout bij laden orders",
        description: "Kon orders niet laden. Probeer opnieuw.",
        variant: "destructive",
      });
    }
  }, [ordersError, toast]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      estimatedCost: 0,
      productSku: "",
      productName: "",
      issueCategory: "",
      assignedUserId: "none",
      customerId: "none",
      orderId: "none",
    },
  });

  const createRepairMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/repairs", data);
      return await res.json();
    },
    onSuccess: async (newRepair: any) => {
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
        // Use fetch directly for FormData to avoid JSON.stringify
        const uploadRes = await fetch(`/api/repairs/${newRepair.id}/upload`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (!uploadRes.ok) {
          throw new Error('Failed to upload files');
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Reparatie aangemaakt",
        description: "De reparatie is succesvol aangemaakt.",
      });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Create repair error:", error);
      toast({
        title: "Fout",
        description: error?.message || "Er is een fout opgetreden bij het aanmaken van de reparatie.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: FormData) => {
    if (selectedFiles.length > 10) {
      toast({
        title: "Te veel bestanden",
        description: "Je kunt maximaal 10 bestanden uploaden.",
        variant: "destructive",
      });
      return;
    }

    // Use stored order data if available (from search), otherwise try to find in orders array
    const selectedOrder = selectedOrderData?.order || orders.find(o => o.id === data.orderId);
    const selectedCustomer = selectedOrderData?.customer || (selectedOrder ? customers.find(c => c.id === selectedOrder.customerId) : null);
    
    const repairData = {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      estimatedCost: data.estimatedCost ? Math.round(data.estimatedCost * 100) : undefined,
      assignedUserId: (data.assignedUserId && data.assignedUserId !== "none") ? data.assignedUserId : undefined,
      slaDeadline: slaDeadline ? slaDeadline.toISOString() : undefined,
      productSku: data.productSku || undefined,
      productName: data.productName || undefined,
      issueCategory: data.issueCategory === "Overig" && otherCategoryDetails 
        ? `Overig: ${otherCategoryDetails}` 
        : data.issueCategory || undefined,
      customerId: (data.customerId && data.customerId !== "none") ? data.customerId : undefined,
      orderId: (data.orderId && data.orderId !== "none") ? data.orderId : undefined,
      customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim() : undefined,
      customerEmail: selectedCustomer?.email || selectedOrder?.customerEmail || undefined,
      orderNumber: selectedOrder?.orderNumber || undefined,
      status: "new",
    };

    createRepairMutation.mutate(repairData);
  };

  const handleClose = () => {
    reset();
    setSlaDeadline(null);
    setSelectedFiles([]);
    setOrderSearchQuery("");
    setShowOrderResults(false);
    setSelectedOrderDisplay("");
    setSelectedOrderData(null);
    setOtherCategoryDetails("");
    onOpenChange(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 10) {
      toast({
        title: "Te veel bestanden",
        description: "Je kunt maximaal 10 bestanden uploaden.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const technicians = users.filter(u => u.role === 'TECHNICUS' || u.role === 'ADMIN');

  // Get selected order and its customer for display
  const selectedOrder = orders.find(o => o.id === watch("orderId"));
  const selectedOrderCustomer = selectedOrder ? customers.find(c => c.id === selectedOrder.customerId) : null;

  // Get search results or latest 10 orders
  const displayOrders = orderSearchQuery.length > 2 && orderSearchResults?.orders 
    ? orderSearchResults.orders 
    : orders.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="repair-form-dialog">
        <DialogHeader>
          <DialogTitle>{repair ? "Reparatie Bewerken" : "Nieuwe Reparatie"}</DialogTitle>
          <DialogDescription>
            {repair ? "Bewerk de reparatiegegevens hieronder." : "Maak een nieuwe reparatie aan."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              placeholder="bijv. iPhone 12 scherm reparatie"
              {...register("title", { required: "Titel is verplicht" })}
              data-testid="input-title"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="productSku">Artikelnummer</Label>
            <Input
              id="productSku"
              placeholder="Artikelnummer"
              {...register("productSku")}
              data-testid="input-product-sku"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productName">Product Naam</Label>
            <Input
              id="productName"
              placeholder="Product naam"
              {...register("productName")}
              data-testid="input-product-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschrijving</Label>
            <Textarea
              id="description"
              placeholder="Beschrijf het probleem en de vereisten..."
              {...register("description")}
              data-testid="input-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Probleem Categorie</Label>
            <Select
              onValueChange={(value) => {
                setValue("issueCategory", value);
                if (value !== "Overig") {
                  setOtherCategoryDetails("");
                }
              }}
              value={watch("issueCategory") || ""}
            >
              <SelectTrigger data-testid="select-issue-category">
                <SelectValue placeholder="Selecteer categorie" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {watch("issueCategory") === "Overig" && (
            <div className="space-y-2">
              <Label htmlFor="otherDetails">Specificeer het probleem</Label>
              <Input
                id="otherDetails"
                placeholder="Beschrijf het probleem..."
                value={otherCategoryDetails}
                onChange={(e) => setOtherCategoryDetails(e.target.value)}
                data-testid="input-other-category-details"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Order / Klant</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
              <Input
                type="text"
                placeholder="Zoek order of klant..."
                className="pl-10 pr-8"
                value={selectedOrderDisplay || orderSearchQuery}
                onChange={(e) => {
                  setOrderSearchQuery(e.target.value);
                  setShowOrderResults(true);
                  if (selectedOrderDisplay) {
                    // Clear selection when user starts typing again
                    setSelectedOrderDisplay("");
                    setSelectedOrderData(null);
                    setValue("orderId", "none");
                    setValue("customerId", "none");
                  }
                }}
                onFocus={() => {
                  setShowOrderResults(true);
                }}
                onBlur={() => setTimeout(() => setShowOrderResults(false), 200)}
                data-testid="input-order-search"
              />
              {selectedOrderDisplay && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedOrderDisplay("");
                    setOrderSearchQuery("");
                    setSelectedOrderData(null);
                    setValue("orderId", "none");
                    setValue("customerId", "none");
                  }}
                >
                  ×
                </button>
              )}
              
              {showOrderResults && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  {displayOrders.length > 0 ? (
                    <div className="p-1">
                      {displayOrders.map((order: any) => {
                        const customer = customers.find(c => c.id === order.customerId);
                        const customerName = customer 
                          ? `${customer.firstName} ${customer.lastName}`
                          : order.customerEmail || 'Onbekende klant';
                        return (
                          <div
                            key={order.id}
                            className="p-2 hover:bg-accent rounded cursor-pointer"
                            onClick={() => {
                              setValue("orderId", order.id);
                              setValue("customerId", order.customerId || "none");
                              setSelectedOrderDisplay(`Order #${order.orderNumber} - ${customerName}`);
                              setSelectedOrderData({ order, customer });
                              setOrderSearchQuery("");
                              setShowOrderResults(false);
                            }}
                            data-testid={`order-result-${order.id}`}
                          >
                            <div className="font-medium">Order #{order.orderNumber}</div>
                            <div className="text-sm text-muted-foreground">{customerName}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">
                      {orderSearchQuery.length > 0 ? 'Geen order gevonden' : 'Geen recente orders'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioriteit</Label>
              <Select
                onValueChange={(value) => setValue("priority", value as any)}
                value={watch("priority") || "medium"}
              >
                <SelectTrigger data-testid="select-priority">
                  <SelectValue placeholder="Selecteer prioriteit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Laag</SelectItem>
                  <SelectItem value="medium">Gemiddeld</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Geschatte Kosten (€)</Label>
              <Input
                id="estimatedCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("estimatedCost", { 
                  valueAsNumber: true,
                  min: { value: 0, message: "Kosten moeten positief zijn" }
                })}
                data-testid="input-estimated-cost"
              />
              {errors.estimatedCost && (
                <p className="text-sm text-destructive">{errors.estimatedCost.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Technicus</Label>
            <Select
              onValueChange={(value) => setValue("assignedUserId", value)}
              value={watch("assignedUserId") || "none"}
            >
              <SelectTrigger data-testid="select-technician">
                <SelectValue placeholder="Selecteer technicus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Niet toegewezen</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.firstName || ''} {tech.lastName || ''} ({tech.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>SLA Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-deadline-trigger"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {slaDeadline ? format(slaDeadline, "PPP") : "Deadline instellen"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={slaDeadline || undefined}
                  onSelect={(date) => setSlaDeadline(date || null)}
                  initialFocus
                  data-testid="calendar-deadline"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Foto's/Bijlagen ({selectedFiles.length}/10)</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Sleep bestanden hierheen of klik om te uploaden
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, PDF tot 10MB per bestand (max 10 bestanden)
              </p>
              <Input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="mt-2"
                accept="image/*,.pdf"
                data-testid="input-file-upload"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between border p-2 rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      data-testid={`button-remove-file-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={createRepairMutation.isPending}
              data-testid="button-submit"
            >
              {createRepairMutation.isPending ? "Opslaan..." : "Reparatie Aanmaken"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
