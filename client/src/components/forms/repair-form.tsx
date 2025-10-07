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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, X, Search } from "lucide-react";
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
  "Schade aan behuizing",
  "Defect scherm",
  "Batterij probleem",
  "Software probleem",
  "Water schade",
  "Mechanisch defect",
  "Elektrisch defect",
  "Onderdelen vervangen",
  "Overig",
];

export function RepairForm({ open, onOpenChange, repair, users }: RepairFormProps) {
  const [slaDeadline, setSlaDeadline] = useState<Date | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [skuSearch, setSkuSearch] = useState("");
  const [debouncedSkuSearch, setDebouncedSkuSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSkuSearch(skuSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [skuSearch]);

  const { data: customers = [], isError: customersError } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
    enabled: open,
  });

  const { data: orders = [], isError: ordersError } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    enabled: open,
  });

  const { data: allRepairs = [] } = useQuery<any[]>({
    queryKey: ['/api/repairs'],
    enabled: open && debouncedSkuSearch.length > 0,
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
      return await apiRequest("/api/repairs", "POST", data);
    },
    onSuccess: async (newRepair: any) => {
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
        await apiRequest(`/api/repairs/${newRepair.id}/upload`, 'POST', formData);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Reparatie aangemaakt",
        description: "De reparatie is succesvol aangemaakt.",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het aanmaken van de reparatie.",
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

    const repairData = {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      estimatedCost: data.estimatedCost ? Math.round(data.estimatedCost * 100) : undefined,
      assignedUserId: (data.assignedUserId && data.assignedUserId !== "none") ? data.assignedUserId : undefined,
      slaDeadline: slaDeadline || undefined,
      productSku: data.productSku || undefined,
      productName: data.productName || undefined,
      issueCategory: data.issueCategory || undefined,
      customerId: (data.customerId && data.customerId !== "none") ? data.customerId : undefined,
      orderId: (data.orderId && data.orderId !== "none") ? data.orderId : undefined,
      status: "new",
    };

    createRepairMutation.mutate(repairData);
  };

  const handleClose = () => {
    reset();
    setSlaDeadline(null);
    setSelectedFiles([]);
    setSkuSearch("");
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

  // Search through existing repairs for matching product SKUs
  const filteredProducts = debouncedSkuSearch
    ? Array.from(new Map(
        allRepairs
          .filter((r: any) => 
            r.productSku?.toLowerCase().includes(debouncedSkuSearch.toLowerCase()) ||
            r.productName?.toLowerCase().includes(debouncedSkuSearch.toLowerCase())
          )
          .map((r: any) => [r.productSku, { sku: r.productSku, name: r.productName || '' }])
      ).values()).slice(0, 5) // Show max 5 unique results
    : [];

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
            <Label htmlFor="productSku">Product SKU Zoeken</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="productSku"
                placeholder="Zoek op SKU code..."
                value={skuSearch}
                onChange={(e) => {
                  setSkuSearch(e.target.value);
                  setValue("productSku", e.target.value);
                }}
                className="pl-10"
                data-testid="input-product-sku-search"
              />
            </div>
            {filteredProducts.length > 0 && skuSearch && (
              <div className="border rounded-md p-2 mt-1 bg-background">
                {filteredProducts.map((product) => (
                  <div
                    key={product.sku}
                    className="p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => {
                      setValue("productSku", product.sku);
                      setValue("productName", product.name);
                      setSkuSearch(product.sku);
                    }}
                  >
                    <div className="font-medium">{product.sku}</div>
                    <div className="text-sm text-muted-foreground">{product.name}</div>
                  </div>
                ))}
              </div>
            )}
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
              onValueChange={(value) => setValue("issueCategory", value)}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Klant</Label>
              <Select
                onValueChange={(value) => setValue("customerId", value)}
                value={watch("customerId") || "none"}
              >
                <SelectTrigger data-testid="select-customer">
                  <SelectValue placeholder="Selecteer klant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen klant</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.firstName} {customer.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Order</Label>
              <Select
                onValueChange={(value) => setValue("orderId", value)}
                value={watch("orderId") || "none"}
              >
                <SelectTrigger data-testid="select-order">
                  <SelectValue placeholder="Selecteer order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen order</SelectItem>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      Order #{order.orderNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
