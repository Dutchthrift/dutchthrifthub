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
  const [customerOpen, setCustomerOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const { toast } = useToast();

  const { data: customers = [], isError: customersError } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
    enabled: open,
  });

  const { data: orders = [], isError: ordersError } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    enabled: open,
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
    setCustomerOpen(false);
    setOrderOpen(false);
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

  // Get selected customer and order for display
  const selectedCustomer = customers.find(c => c.id === watch("customerId"));
  const selectedOrder = orders.find(o => o.id === watch("orderId"));

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
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between"
                    data-testid="button-customer-combobox"
                  >
                    {selectedCustomer
                      ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
                      : "Selecteer klant..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Zoek klant..." />
                    <CommandList>
                      <CommandEmpty>Geen klant gevonden.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setValue("customerId", "none");
                            setCustomerOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              watch("customerId") === "none" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          Geen klant
                        </CommandItem>
                        {customers.slice(0, 10).map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.firstName} ${customer.lastName} ${customer.email || ''}`}
                            onSelect={() => {
                              setValue("customerId", customer.id);
                              setCustomerOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                watch("customerId") === customer.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {customer.firstName} {customer.lastName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Order</Label>
              <Popover open={orderOpen} onOpenChange={setOrderOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={orderOpen}
                    className="w-full justify-between"
                    data-testid="button-order-combobox"
                  >
                    {selectedOrder
                      ? `Order #${selectedOrder.orderNumber}`
                      : "Selecteer order..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Zoek order..." />
                    <CommandList>
                      <CommandEmpty>Geen order gevonden.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setValue("orderId", "none");
                            setOrderOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              watch("orderId") === "none" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          Geen order
                        </CommandItem>
                        {orders.slice(0, 10).map((order) => (
                          <CommandItem
                            key={order.id}
                            value={`${order.orderNumber} ${order.id}`}
                            onSelect={() => {
                              setValue("orderId", order.id);
                              setOrderOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                watch("orderId") === order.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            Order #{order.orderNumber}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
