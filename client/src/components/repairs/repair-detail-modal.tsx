import { useState, useEffect } from "react";
import type { Repair, User, Activity } from "@shared/schema";
import { NotesPanel } from "@/components/notes/NotesPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wrench,
  Package,
  Image as ImageIcon,
  Activity as ActivityIcon,
  User as UserIcon,
  Calendar,
  Clock,
  DollarSign,
  Upload,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
  Edit,
  Save,
  X,
  Maximize2,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { nl } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RepairStatusTimeline } from "./repair-status-timeline";

interface RepairDetailModalProps {
  repair: Repair | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}

export function RepairDetailModal({ repair, open, onOpenChange, users }: RepairDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [currentRepair, setCurrentRepair] = useState<Repair | null>(repair);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const { toast } = useToast();

  // Update local state when repair prop changes
  useEffect(() => {
    setCurrentRepair(repair);
    if (repair) {
      setEditForm({
        title: repair.title || "",
        description: repair.description || "",
        productSku: repair.productSku || "",
        productName: repair.productName || "",
        issueCategory: repair.issueCategory || "",
        estimatedCost: repair.estimatedCost ? repair.estimatedCost / 100 : 0,
        assignedUserId: repair.assignedUserId || "none",
        priority: repair.priority || "medium",
      });
    }
  }, [repair]);

  const { data: allActivities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
    enabled: !!repair?.id,
  });

  // Filter activities for this specific repair
  const activities = allActivities.filter(activity => {
    const metadata = activity.metadata as any;
    return metadata?.entityType === 'repair' && metadata?.entityId === repair?.id;
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

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { status: string }) => {
      if (!repair || !currentRepair) return;
      const res = await apiRequest('PATCH', `/api/repairs/${currentRepair.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedRepair) => {
      if (updatedRepair) {
        setCurrentRepair(updatedRepair);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({
        title: "Status bijgewerkt",
        description: "De reparatiestatus is succesvol bijgewerkt.",
      });
    },
  });

  const uploadFilesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      if (!repair || !currentRepair) return;
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      // Use fetch directly for FormData
      const res = await fetch(`/api/repairs/${currentRepair.id}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to upload files');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      setSelectedFiles(null);
      toast({
        title: "Bestanden geüpload",
        description: "De bestanden zijn succesvol toegevoegd.",
      });
    },
  });



  const deleteRepairMutation = useMutation({
    mutationFn: async () => {
      if (!currentRepair) return;
      await apiRequest('DELETE', `/api/repairs/${currentRepair.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({
        title: "Reparatie verwijderd",
        description: "De reparatie is succesvol verwijderd.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon de reparatie niet verwijderen.",
        variant: "destructive",
      });
    },
  });

  const updateRepairMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentRepair) return;
      const res = await apiRequest('PATCH', `/api/repairs/${currentRepair.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedRepair) => {
      if (updatedRepair) {
        setCurrentRepair(updatedRepair);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      setIsEditMode(false);
      toast({
        title: "Reparatie bijgewerkt",
        description: "De reparatiegegevens zijn succesvol bijgewerkt.",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon de reparatie niet bijwerken.",
        variant: "destructive",
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async ({ fileType, fileUrl }: { fileType: 'photos' | 'attachments'; fileUrl: string }) => {
      if (!repair || !currentRepair) return;

      // Get current files array
      const currentFiles = fileType === 'photos' ? (currentRepair.photos || []) : (currentRepair.attachments || []);

      // Filter out the file to delete
      const updatedFiles = currentFiles.filter(f => f !== fileUrl);

      // Update repair
      const res = await apiRequest('PATCH', `/api/repairs/${currentRepair.id}`, {
        [fileType]: updatedFiles
      });
      return await res.json();
    },
    onSuccess: (updatedRepair) => {
      if (updatedRepair) {
        setCurrentRepair(updatedRepair);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({
        title: "Bestand verwijderd",
        description: "Het bestand is succesvol verwijderd.",
      });
    },
  });

  const handleSaveEdit = () => {
    const updateData = {
      ...editForm,
      estimatedCost: editForm.estimatedCost ? Math.round(editForm.estimatedCost * 100) : undefined,
      assignedUserId: editForm.assignedUserId === "none" ? null : editForm.assignedUserId,
    };
    updateRepairMutation.mutate(updateData);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (repair) {
      setEditForm({
        title: repair.title || "",
        description: repair.description || "",
        productSku: repair.productSku || "",
        productName: repair.productName || "",
        issueCategory: repair.issueCategory || "",
        estimatedCost: repair.estimatedCost ? repair.estimatedCost / 100 : 0,
        assignedUserId: repair.assignedUserId || "none",
        priority: repair.priority || "medium",
      });
    }
  };

  if (!currentRepair) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_repair': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'returned': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Nieuw';
      case 'in_repair': return 'In Reparatie';
      case 'completed': return 'Klaar';
      case 'returned': return 'Teruggestuurd';
      default: return status;
    }
  };

  const getTechnicianName = (userId: string | null) => {
    if (!userId) return 'Niet toegewezen';
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Onbekend';
  };

  const handleFileUpload = () => {
    if (selectedFiles) {
      if (selectedFiles.length > 10) {
        toast({
          title: "Te veel bestanden",
          description: "Je kunt maximaal 10 bestanden tegelijk uploaden.",
          variant: "destructive",
        });
        return;
      }
      uploadFilesMutation.mutate(selectedFiles);
    }
  };

  const handleDeleteFile = (fileType: 'photos' | 'attachments', fileUrl: string) => {
    if (confirm('Weet je zeker dat je dit bestand wilt verwijderen?')) {
      deleteFileMutation.mutate({ fileType, fileUrl });
    }
  };



  const partsUsed = Array.isArray(currentRepair.partsUsed) ? currentRepair.partsUsed : [];
  // Filter out broken/old files (those with 'undefined' in path or ending with '-')
  const attachments = Array.isArray(currentRepair.attachments)
    ? currentRepair.attachments.filter(a => !a.includes('undefined') && !a.endsWith('-'))
    : [];
  const photos = Array.isArray(currentRepair.photos)
    ? currentRepair.photos.filter(p => !p.includes('undefined') && !p.endsWith('-'))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-3">
            {/* Title and Subtitle */}
            <div>
              <DialogTitle>Reparatie #{currentRepair.id.slice(0, 8)}</DialogTitle>
              <p className="text-sm text-foreground mt-1">{currentRepair.title}</p>
            </div>

            {/* Status Badge and Warning */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className={getStatusColor(currentRepair.status)}>
                {getStatusLabel(currentRepair.status)}
              </Badge>
              {currentRepair.slaDeadline &&
                !['completed', 'returned', 'canceled'].includes(currentRepair.status) &&
                isPast(new Date(currentRepair.slaDeadline)) && (
                  <div className="flex items-center gap-1 text-destructive" data-testid="indicator-overdue">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-medium">Te laat</span>
                  </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Annuleren</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateRepairMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    <Save className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{updateRepairMutation.isPending ? "Opslaan..." : "Opslaan"}</span>
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  data-testid="button-edit-repair"
                >
                  <Edit className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Bewerken</span>
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="delete-repair-button"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Verwijderen</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm">
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="parts" data-testid="tab-parts" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Onderdelen ({partsUsed.length})</span>
              <span className="sm:hidden">Delen ({partsUsed.length})</span>
            </TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Bestanden ({photos.length + attachments.length})</span>
              <span className="sm:hidden">Files ({photos.length + attachments.length})</span>
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Activiteit ({activities.length})</span>
              <span className="sm:hidden">Log ({activities.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 min-h-[400px]">
            <Card className="bg-gradient-to-br from-blue-50/80 to-white/50 dark:from-blue-950/20 dark:to-zinc-900/50 border-blue-200/50 dark:border-blue-800/50 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <span className="p-1.5 bg-blue-500/10 rounded-lg">
                    <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </span>
                  Reparatie Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditMode ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Titel</div>
                      <Input
                        value={editForm.title || ""}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        data-testid="input-edit-title"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Product Naam</div>
                        <Input
                          value={editForm.productName || ""}
                          onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                          data-testid="input-edit-product-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Product SKU</div>
                        <Input
                          value={editForm.productSku || ""}
                          onChange={(e) => setEditForm({ ...editForm, productSku: e.target.value })}
                          data-testid="input-edit-product-sku"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Probleem Categorie</div>
                      <Input
                        value={editForm.issueCategory || ""}
                        onChange={(e) => setEditForm({ ...editForm, issueCategory: e.target.value })}
                        data-testid="input-edit-issue-category"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Technicus</div>
                        <Select
                          value={editForm.assignedUserId || "none"}
                          onValueChange={(value) => setEditForm({ ...editForm, assignedUserId: value })}
                        >
                          <SelectTrigger data-testid="select-edit-technician">
                            <SelectValue placeholder="Selecteer technicus" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Niet toegewezen</SelectItem>
                            {users.filter(u => u.role === 'TECHNICUS' || u.role === 'ADMIN').map((tech) => (
                              <SelectItem key={tech.id} value={tech.id}>
                                {tech.firstName || ''} {tech.lastName || ''} ({tech.username})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Prioriteit</div>
                        <Select
                          value={editForm.priority || "medium"}
                          onValueChange={(value) => setEditForm({ ...editForm, priority: value })}
                        >
                          <SelectTrigger data-testid="select-edit-priority">
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
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Geschatte Kosten (€)</div>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.estimatedCost || 0}
                        onChange={(e) => setEditForm({ ...editForm, estimatedCost: parseFloat(e.target.value) || 0 })}
                        data-testid="input-edit-estimated-cost"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Beschrijving</div>
                      <Textarea
                        value={editForm.description || ""}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                        data-testid="input-edit-description"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium">Product</div>
                        <div className="text-sm text-muted-foreground">{currentRepair.productName || currentRepair.title}</div>
                        {currentRepair.productSku && (
                          <div className="text-xs text-muted-foreground">SKU: {currentRepair.productSku}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">Probleem Categorie</div>
                        <div className="text-sm text-muted-foreground">{currentRepair.issueCategory || '-'}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Technicus</div>
                        <div className="text-sm text-muted-foreground">{getTechnicianName(currentRepair.assignedUserId)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Prioriteit</div>
                        <div className="text-sm">
                          <Badge variant="outline">
                            {currentRepair.priority === 'urgent' ? 'Urgent' :
                              currentRepair.priority === 'high' ? 'Hoog' :
                                currentRepair.priority === 'medium' ? 'Gemiddeld' : 'Laag'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium">Beschrijving</div>
                      <div className="text-sm text-muted-foreground mt-1">{currentRepair.description || '-'}</div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Ontvangen op
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {currentRepair.createdAt ? format(new Date(currentRepair.createdAt), "d MMMM yyyy", { locale: nl }) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Laatst bijgewerkt
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {currentRepair.updatedAt ? format(new Date(currentRepair.updatedAt), "d MMMM yyyy HH:mm", { locale: nl }) : '-'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-3">Status bijwerken</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'new', label: 'Nieuw' },
                      { value: 'in_repair', label: 'In Reparatie' },
                      { value: 'completed', label: 'Klaar' },
                      { value: 'returned', label: 'Teruggestuurd' },
                    ].map((status) => (
                      <Button
                        key={status.value}
                        variant={currentRepair.status === status.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ status: status.value })}
                        disabled={updateStatusMutation.isPending}
                        className={`h-8 text-xs ${currentRepair.status === status.value ? "" : "hover:bg-accent"}`}
                        data-testid={`button-status-${status.value}`}
                      >
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {(currentRepair.customerName || currentRepair.customerEmail || currentRepair.orderNumber) && (
              <Card className="bg-gradient-to-br from-purple-50/80 to-white/50 dark:from-purple-950/20 dark:to-zinc-900/50 border-purple-200/50 dark:border-purple-800/50 border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-purple-900 dark:text-purple-100">
                    <span className="p-1.5 bg-purple-500/10 rounded-lg">
                      <UserIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </span>
                    Klant & Order Informatie
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {(currentRepair.customerName || currentRepair.customerEmail) && (
                      <div>
                        <div className="text-sm font-medium">Klant</div>
                        <div className="text-sm text-muted-foreground">
                          {currentRepair.customerName || currentRepair.customerEmail || 'Geen klant'}
                        </div>
                        {currentRepair.customerEmail && currentRepair.customerName && (
                          <div className="text-xs text-muted-foreground">{currentRepair.customerEmail}</div>
                        )}
                      </div>
                    )}
                    {currentRepair.orderNumber && (
                      <div>
                        <div className="text-sm font-medium">Order Nummer</div>
                        <div className="text-sm text-muted-foreground font-mono">{currentRepair.orderNumber}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gradient-to-br from-rose-50/80 to-white/50 dark:from-rose-950/20 dark:to-zinc-900/50 border-rose-200/50 dark:border-rose-800/50 border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-rose-900 dark:text-rose-100">
                  <span className="p-1.5 bg-rose-500/10 rounded-lg">
                    <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </span>
                  Notities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentUser && currentRepair && (
                  <NotesPanel entityType="repair" entityId={currentRepair.id} currentUser={currentUser} />
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50/80 to-white/50 dark:from-indigo-950/20 dark:to-zinc-900/50 border-indigo-200/50 dark:border-indigo-800/50 border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                  <span className="p-1.5 bg-indigo-500/10 rounded-lg">
                    <ActivityIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </span>
                  Reparatie Voortgang
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RepairStatusTimeline currentStatus={currentRepair.status} />
              </CardContent>
            </Card>
          </TabsContent>

          : "          <TabsContent value="parts" className="space-y-4 min-h-[400px]">
            <Card className="bg-gradient-to-br from-amber-50/80 to-white/50 dark:from-amber-950/20 dark:to-zinc-900/50 border-amber-200/50 dark:border-amber-800/50 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-100">
                  <span className="p-1.5 bg-amber-500/10 rounded-lg">
                    <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </span>
                  Gebruikte Onderdelen
                </CardTitle>
              </CardHeader>
              <CardContent>
                {partsUsed.length > 0 ? (
                  <div className="space-y-2">
                    {partsUsed.map((part: any, index: number) => (
                      <div key={index} className="flex justify-between items-center border-b pb-2">
                        <div>
                          <div className="text-sm font-medium">{part.name || part.partName || 'Onbekend onderdeel'}</div>
                          {part.sku && <div className="text-xs text-muted-foreground">SKU: {part.sku}</div>}
                          {part.quantity && <div className="text-xs text-muted-foreground">Aantal: {part.quantity}</div>}
                        </div>
                        {part.cost && (
                          <div className="text-sm font-medium">
                            €{(part.cost / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nog geen onderdelen toegevoegd</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {currentRepair.estimatedCost && (
              <Card className="bg-gradient-to-br from-emerald-50/80 to-white/50 dark:from-emerald-950/20 dark:to-zinc-900/50 border-emerald-200/50 dark:border-emerald-800/50 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                    <span className="p-1.5 bg-emerald-500/10 rounded-lg">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    Kosten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">Geschatte kosten</div>
                    <div className="text-lg font-bold">€{(currentRepair.estimatedCost / 100).toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-4 min-h-[400px]">
            <Card className="bg-gradient-to-br from-violet-50/80 to-white/50 dark:from-violet-950/20 dark:to-zinc-900/50 border-violet-200/50 dark:border-violet-800/50 border-l-4 border-l-violet-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-violet-900 dark:text-violet-100">
                  <span className="p-1.5 bg-violet-500/10 rounded-lg">
                    <ImageIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </span>
                  Foto's
                </CardTitle>
              </CardHeader>
              <CardContent>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo, index) => {
                      // Extract the path after /attachments/ to construct the API URL
                      const photoPath = photo.startsWith('/attachments/')
                        ? photo.substring('/attachments/'.length)
                        : photo;
                      const photoUrl = `/api/attachments/${photoPath}`;

                      return (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group">
                          <img
                            src={photoUrl}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setFullScreenImage(photoUrl)}
                          />
                          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullScreenImage(photoUrl);
                              }}
                              data-testid={`button-view-photo-${index}`}
                            >
                              <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile('photos', photo);
                              }}
                              data-testid={`button-delete-photo-${index}`}
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nog geen foto's toegevoegd</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-50/80 to-white/50 dark:from-cyan-950/20 dark:to-zinc-900/50 border-cyan-200/50 dark:border-cyan-800/50 border-l-4 border-l-cyan-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-cyan-900 dark:text-cyan-100">
                  <span className="p-1.5 bg-cyan-500/10 rounded-lg">
                    <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </span>
                  Bijlagen
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                {attachments.length > 0 ? (
                  <div className="space-y-2 w-full overflow-hidden">
                    {attachments.map((attachment, index) => {
                      // Extract the path after /attachments/ to construct the API URL
                      const attachmentPath = attachment.startsWith('/attachments/')
                        ? attachment.substring('/attachments/'.length)
                        : attachment;
                      const downloadUrl = `/api/attachments/${attachmentPath}?download=1`;
                      const filename = decodeURIComponent(attachment.split('/').pop() || 'download');

                      // Create a shorter display name for mobile
                      const getDisplayName = (name: string) => {
                        if (name.length <= 30) return name;
                        const parts = name.split('.');
                        if (parts.length > 1) {
                          const ext = parts.pop();
                          const basename = parts.join('.');
                          return basename.length > 20
                            ? `${basename.substring(0, 20)}...${ext}`
                            : `${basename}.${ext}`;
                        }
                        return `${name.substring(0, 25)}...`;
                      };

                      return (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 border p-3 rounded w-full">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span
                              className="text-sm break-all sm:truncate block"
                              title={filename}
                            >
                              <span className="hidden sm:inline">{filename}</span>
                              <span className="sm:hidden">{getDisplayName(filename)}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-center">
                            <a
                              href={downloadUrl}
                              download={filename}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-download-${index}`}
                                className="h-8 px-2"
                              >
                                <Download className="h-4 w-4" />
                                <span className="ml-1 text-xs hidden sm:inline">Download</span>
                              </Button>
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFile('attachments', attachment)}
                              data-testid={`button-delete-attachment-${index}`}
                              className="h-8 px-2"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                              <span className="ml-1 text-xs hidden sm:inline">Delete</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nog geen bijlagen toegevoegd</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nieuwe bestanden uploaden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  data-testid="input-file-upload"
                  className="cursor-pointer"
                />
                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFiles || uploadFilesMutation.isPending}
                  data-testid="button-upload-files"
                  className="w-full sm:w-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadFilesMutation.isPending ? 'Uploaden...' : 'Upload bestanden'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 min-h-[400px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4" />
                  Activiteitenlog
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="border-l-2 border-muted pl-4 pb-2">
                        <div className="text-sm font-medium">{activity.type}</div>
                        <div className="text-sm text-muted-foreground">{activity.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {activity.createdAt && format(new Date(activity.createdAt), "d MMM yyyy HH:mm", { locale: nl })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ActivityIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nog geen activiteiten</p>
                  </div>
                )}
              </CardContent>
            </Card>


          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reparatie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze reparatie wilt verwijderen? Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-repair">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRepairMutation.mutate()}
              disabled={deleteRepairMutation.isPending}
              data-testid="confirm-delete-repair"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRepairMutation.isPending ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full-screen image viewer */}
      <Dialog open={!!fullScreenImage} onOpenChange={() => setFullScreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {fullScreenImage && (
              <img
                src={fullScreenImage}
                alt="Full screen view"
                className="max-w-full max-h-[95vh] object-contain"
                onClick={() => setFullScreenImage(null)}
              />
            )}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-4 right-4"
              onClick={() => setFullScreenImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
