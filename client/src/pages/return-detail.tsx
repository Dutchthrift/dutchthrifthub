import { useState } from "react";
import { useParams, useLocation } from "wouter";
import type { User } from "@shared/schema";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Package,
  User as UserIcon,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Camera,
  MessageSquare,
  Activity,
  DollarSign,
  Mail,
  ShoppingCart,
  Image,
  Trash2,
  Upload,
  StickyNote
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { NotesPanel } from "@/components/notes/NotesPanel";

interface ReturnItem {
  id: string;
  returnId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  reason: string;
  condition: string | null;
  refundAmount: number | null;
  notes: string | null;
}

interface Return {
  id: string;
  returnNumber: string;
  customerId: string;
  orderId: string | null;
  caseId: string | null;
  status: string;
  reason: string;
  priority: string;
  assignedUserId: string | null;
  trackingNumber: string | null;
  receivedDate: string | null;
  completedDate: string | null;
  refundAmount: number | null;
  refundMethod: string | null;
  refundStatus: string | null;
  photoUrls: string[] | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerEmail?: string;
  assignedUserName?: string;
  orderNumber?: string;
  returnItems?: ReturnItem[];
}

const STATUS_OPTIONS = [
  { value: "nieuw_onderweg", label: "Nieuw/Onderweg" },
  { value: "ontvangen_controle", label: "Ontvangen - Controle Nodig" },
  { value: "akkoord_terugbetaling", label: "Akkoord - Terugbetaling" },
  { value: "vermiste_pakketten", label: "Vermiste Pakketten" },
  { value: "wachten_klant", label: "Wachten op Klant" },
  { value: "opnieuw_versturen", label: "Opnieuw Versturen" },
  { value: "klaar", label: "Klaar" },
  { value: "niet_ontvangen", label: "Niet Ontvangen" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Laag" },
  { value: "medium", label: "Normaal" },
  { value: "high", label: "Hoog" },
  { value: "urgent", label: "Urgent" },
];

const REFUND_STATUS_OPTIONS = [
  { value: "pending", label: "In afwachting" },
  { value: "processing", label: "Verwerken" },
  { value: "completed", label: "Voltooid" },
  { value: "failed", label: "Mislukt" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "nieuw_onderweg":
      return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case "ontvangen_controle":
      return "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
    case "akkoord_terugbetaling":
    case "klaar":
      return "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
    case "vermiste_pakketten":
      return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
    case "wachten_klant":
      return "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    case "opnieuw_versturen":
      return "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
    case "high":
      return "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
    case "medium":
      return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
}

export default function ReturnDetail() {
  const params = useParams();
  const returnId = params.id;
  const [, setLocation] = useLocation();
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const { toast } = useToast();

  const { data: returnData, isLoading } = useQuery<Return>({
    queryKey: ["/api/returns", returnId],
    enabled: !!returnId,
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

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users/list"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return apiRequest("PATCH", `/api/returns/${returnId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      toast({ title: "Status succesvol bijgewerkt" });
    },
    onError: () => {
      toast({
        title: "Status bijwerken mislukt",
        variant: "destructive"
      });
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ priority }: { priority: string }) => {
      return apiRequest("PATCH", `/api/returns/${returnId}`, { priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      toast({ title: "Prioriteit succesvol bijgewerkt" });
    },
    onError: () => {
      toast({
        title: "Prioriteit bijwerken mislukt",
        variant: "destructive"
      });
    },
  });

  const assignUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string | null }) => {
      return apiRequest("PATCH", `/api/returns/${returnId}`, { assignedUserId: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      toast({ title: "Gebruiker succesvol toegewezen" });
      setShowAssignDialog(false);
      setSelectedUserId("");
    },
    onError: () => {
      toast({
        title: "Toewijzen mislukt",
        variant: "destructive"
      });
    },
  });

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch(`/api/returns/${returnId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      toast({ title: "Foto succesvol geüpload" });
    } catch (error) {
      toast({
        title: "Foto uploaden mislukt",
        variant: "destructive"
      });
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoPath: string) => {
      return apiRequest("DELETE", `/api/returns/${returnId}/photos`, { photoPath });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      toast({ title: "Foto succesvol verwijderd" });
    },
    onError: () => {
      toast({
        title: "Foto verwijderen mislukt",
        variant: "destructive"
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Laden...</div>
        </div>
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Return not found</p>
            <Button
              onClick={() => setLocation("/returns")}
              variant="outline"
              className="mt-4"
              data-testid="button-back-to-returns"
            >
              Back to Returns
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel = STATUS_OPTIONS.find(s => s.value === returnData.status)?.label || returnData.status;
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === returnData.priority)?.label || returnData.priority;

  return (
    <div className="flex flex-col h-screen bg-background">
      <Navigation />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          <Button
            variant="ghost"
            onClick={() => setLocation("/returns")}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug naar Retouren
          </Button>

          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-return-number">
                  {returnData.returnNumber}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {returnData.createdAt ? (
                    <>Aangemaakt {format(new Date(returnData.createdAt), "d MMMM yyyy")}</>
                  ) : (
                    "Geen aanmaakdatum"
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className={getPriorityColor(returnData.priority)} data-testid={`badge-priority-${returnData.priority}`}>
                  {priorityLabel}
                </Badge>
                <Badge className={getStatusColor(returnData.status)} data-testid={`badge-status-${returnData.status}`}>
                  {statusLabel}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="bg-card-header border-b border-border">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Klant
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium" data-testid="text-customer-name">
                        {returnData.customerName || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-customer-email">
                        {returnData.customerEmail || "Geen e-mail"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-card-header border-b border-border">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Bestelling
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {returnData.orderId ? (
                    <div>
                      <p className="text-sm font-medium" data-testid="text-order-number">
                        {returnData.orderNumber || returnData.orderId}
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto"
                        onClick={() => setLocation(`/orders`)}
                        data-testid="link-view-order"
                      >
                        Bekijk Bestelling
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Geen bestelling gekoppeld</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-card-header border-b border-border">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Toegewezen aan
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {returnData.assignedUserId ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium" data-testid="text-assigned-user">
                        {returnData.assignedUserName || "Onbekend"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAssignDialog(true);
                          setSelectedUserId(returnData.assignedUserId || "");
                        }}
                        data-testid="button-change-assignee"
                      >
                        Wijzigen
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAssignDialog(true)}
                      data-testid="button-assign-user"
                    >
                      Toewijzen
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview" data-testid="tab-overview">Overzicht</TabsTrigger>
                <TabsTrigger value="items" data-testid="tab-items">Artikelen</TabsTrigger>
                <TabsTrigger value="photos" data-testid="tab-photos">Foto's</TabsTrigger>
                <TabsTrigger value="timeline" data-testid="tab-timeline">Tijdlijn</TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">
                  <StickyNote className="h-4 w-4 mr-2" />
                  Notities
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                <Card>
                  <CardHeader className="bg-card-header border-b border-border">
                    <CardTitle>Retourgegevens</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <Select
                          value={returnData.status}
                          onValueChange={(value) => updateStatusMutation.mutate({ status: value })}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Prioriteit</label>
                        <Select
                          value={returnData.priority}
                          onValueChange={(value) => updatePriorityMutation.mutate({ priority: value })}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Reden</label>
                        <p className="mt-1 text-sm" data-testid="text-reason">{returnData.reason}</p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Track & Trace</label>
                        <p className="mt-1 text-sm" data-testid="text-tracking-number">
                          {returnData.trackingNumber || "N/A"}
                        </p>
                      </div>

                      {returnData.receivedDate && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Ontvangstdatum</label>
                          <p className="mt-1 text-sm" data-testid="text-received-date">
                            {format(new Date(returnData.receivedDate), "PPP")}
                          </p>
                        </div>
                      )}

                      {returnData.completedDate && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Afgerond op</label>
                          <p className="mt-1 text-sm" data-testid="text-completed-date">
                            {format(new Date(returnData.completedDate), "PPP")}
                          </p>
                        </div>
                      )}
                    </div>



                    {returnData.refundAmount != null && (
                      <div className="border-t border-border pt-6">
                        <h3 className="text-lg font-semibold mb-4">Terugbetaling Informatie</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Terugbetaling Bedrag</label>
                            <p className="mt-1 text-lg font-medium" data-testid="text-refund-amount">
                              €{returnData.refundAmount.toFixed(2)}
                            </p>
                          </div>
                          {returnData.refundMethod && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Terugbetaling Methode</label>
                              <p className="mt-1 text-sm" data-testid="text-refund-method">
                                {returnData.refundMethod}
                              </p>
                            </div>
                          )}
                          {returnData.refundStatus && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Terugbetaling Status</label>
                              <p className="mt-1 text-sm" data-testid="text-refund-status">
                                {returnData.refundStatus}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="items" className="mt-6">
                <Card>
                  <CardHeader className="bg-card-header border-b border-border">
                    <CardTitle>Retour Artikelen</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {returnData.returnItems && returnData.returnItems.length > 0 ? (
                      <div className="space-y-4">
                        {returnData.returnItems.map((item) => (
                          <div
                            key={item.id}
                            className="border border-border rounded-lg p-4"
                            data-testid={`item-${item.id}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium" data-testid={`text-item-name-${item.id}`}>
                                  {item.productName}
                                </h4>
                                {item.sku && (
                                  <p className="text-sm text-muted-foreground mt-1" data-testid={`text-item-sku-${item.id}`}>
                                    SKU: {item.sku}
                                  </p>
                                )}
                                <div className="flex gap-4 mt-2">
                                  <div>
                                    <span className="text-sm font-medium">Aantal:</span>{" "}
                                    <span className="text-sm" data-testid={`text-item-quantity-${item.id}`}>{item.quantity}</span>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium">Reden:</span>{" "}
                                    <span className="text-sm" data-testid={`text-item-reason-${item.id}`}>{item.reason}</span>
                                  </div>
                                </div>
                                {item.condition && (
                                  <p className="text-sm mt-2">
                                    <span className="font-medium">Conditie:</span>{" "}
                                    <span data-testid={`text-item-condition-${item.id}`}>{item.condition}</span>
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-sm mt-2">
                                    <span className="font-medium">Notities:</span>{" "}
                                    <span data-testid={`text-item-notes-${item.id}`}>{item.notes}</span>
                                  </p>
                                )}
                              </div>
                              {item.refundAmount != null && (
                                <div className="text-right">
                                  <p className="text-lg font-medium" data-testid={`text-item-refund-${item.id}`}>
                                    €{item.refundAmount.toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">Geen artikelen gevonden</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="photos" className="mt-6">
                <Card>
                  <CardHeader className="bg-card-header border-b border-border">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Retour Foto's
                      </CardTitle>
                      <div>
                        <input
                          type="file"
                          id="photo-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                          disabled={isUploadingPhoto}
                        />
                        <Button
                          onClick={() => document.getElementById('photo-upload')?.click()}
                          disabled={isUploadingPhoto}
                          size="sm"
                          data-testid="button-upload-photo"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {isUploadingPhoto ? "Uploaden..." : "Foto Uploaden"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {!returnData.photoUrls || returnData.photoUrls.length === 0 ? (
                      <div className="text-center py-12">
                        <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nog geen foto's geüpload</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Upload foto's om de conditie van geretourneerde artikelen te documenteren
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {returnData.photoUrls.map((photoPath, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={`/api/attachments${photoPath}`}
                              alt={`Return photo ${index + 1}`}
                              className="w-full h-48 object-cover rounded-lg border border-border"
                              data-testid={`image-photo-${index}`}
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deletePhotoMutation.mutate(photoPath)}
                              disabled={deletePhotoMutation.isPending}
                              data-testid={`button-delete-photo-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeline" className="mt-6">
                <Card>
                  <CardHeader className="bg-card-header border-b border-border">
                    <CardTitle>Tijdlijn</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {returnData.createdAt && (
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <div className="w-0.5 h-full bg-border" />
                          </div>
                          <div className="flex-1 pb-8">
                            <p className="text-sm font-medium">Retour Aangemaakt</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(returnData.createdAt), "PPP 'at' p")}
                            </p>
                          </div>
                        </div>
                      )}
                      {returnData.receivedDate && (
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <div className="w-0.5 h-full bg-border" />
                          </div>
                          <div className="flex-1 pb-8">
                            <p className="text-sm font-medium">Pakket Ontvangen</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(returnData.receivedDate), "PPP 'at' p")}
                            </p>
                          </div>
                        </div>
                      )}
                      {returnData.completedDate && (
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Retour Afgerond</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(returnData.completedDate), "PPP 'at' p")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-6">
                {currentUser && returnId && (
                  <NotesPanel entityType="return" entityId={returnId} currentUser={currentUser} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {showAssignDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader className="bg-card-header border-b border-border">
              <CardTitle>Gebruiker Toewijzen</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Selecteer Gebruiker</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="mt-1" data-testid="select-assign-user">
                    <SelectValue placeholder="Selecteer een gebruiker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.fullName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignDialog(false);
                    setSelectedUserId("");
                  }}
                  data-testid="button-cancel-assign"
                >
                  Annuleren
                </Button>
                <Button
                  onClick={() => assignUserMutation.mutate({ userId: selectedUserId })}
                  disabled={!selectedUserId || assignUserMutation.isPending}
                  data-testid="button-confirm-assign"
                >
                  {assignUserMutation.isPending ? "Toewijzen..." : "Toewijzen"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
