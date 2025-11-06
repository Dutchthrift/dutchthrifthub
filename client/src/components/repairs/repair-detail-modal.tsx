import { useState, useEffect } from "react";
import type { Repair, User, Activity } from "@shared/schema";
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
  const [note, setNote] = useState("");
  const [currentRepair, setCurrentRepair] = useState<Repair | null>(repair);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
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
  
  // Filter notes from activities
  const notes = activities.filter(activity => activity.type === 'note_added');

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

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      if (!repair || !currentRepair) return;
      const res = await apiRequest('POST', '/api/activities', {
        type: 'note_added',
        description: noteText,
        metadata: { entityType: 'repair', entityId: currentRepair.id },
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setNote("");
      toast({
        title: "Notitie toegevoegd",
        description: "De notitie is succesvol toegevoegd.",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, description }: { noteId: string; description: string }) => {
      const res = await apiRequest('PATCH', `/api/activities/${noteId}`, { description });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setEditingNoteId(null);
      setEditingNoteText("");
      toast({
        title: "Notitie bijgewerkt",
        description: "De notitie is succesvol bijgewerkt.",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest('DELETE', `/api/activities/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({
        title: "Notitie verwijderd",
        description: "De notitie is succesvol verwijderd.",
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
      case 'diagnosing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'waiting_parts': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'repair_in_progress': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'quality_check': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'returned': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'canceled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Nieuw';
      case 'diagnosing': return 'Diagnose';
      case 'waiting_parts': return 'Wacht op onderdelen';
      case 'repair_in_progress': return 'In reparatie';
      case 'quality_check': return 'Kwaliteitscontrole';
      case 'completed': return 'Voltooid';
      case 'returned': return 'Geretourneerd';
      case 'canceled': return 'Geannuleerd';
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

  const handleAddNote = () => {
    if (note.trim()) {
      addNoteMutation.mutate(note);
    }
  };

  const partsUsed = Array.isArray(currentRepair.partsUsed) ? currentRepair.partsUsed : [];
  const attachments = Array.isArray(currentRepair.attachments) ? currentRepair.attachments : [];
  const photos = Array.isArray(currentRepair.photos) ? currentRepair.photos : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle>Reparatie #{currentRepair.id.slice(0, 8)}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{currentRepair.title}</p>
            </div>
            <div className="flex items-center gap-2">
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
              {isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annuleren
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateRepairMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateRepairMutation.isPending ? "Opslaan..." : "Opslaan"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  data-testid="button-edit-repair"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Bewerken
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="delete-repair-button"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Verwijderen
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overzicht</TabsTrigger>
            <TabsTrigger value="parts" data-testid="tab-parts">
              Onderdelen ({partsUsed.length})
            </TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">
              Bestanden ({photos.length + attachments.length})
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              Activiteit ({activities.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 min-h-[400px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
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
                      { value: 'diagnosing', label: 'Diagnose' },
                      { value: 'waiting_parts', label: 'Wacht op onderdelen' },
                      { value: 'repair_in_progress', label: 'In reparatie' },
                      { value: 'quality_check', label: 'Kwaliteitscontrole' },
                      { value: 'completed', label: 'Voltooid' },
                      { value: 'returned', label: 'Geretourneerd' },
                      { value: 'canceled', label: 'Geannuleerd' },
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notities ({notes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing notes list */}
                {notes.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {notes.map((noteItem) => (
                      <div key={noteItem.id} className="border rounded-lg p-3 bg-muted/50">
                        {editingNoteId === noteItem.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              className="min-h-[80px]"
                              data-testid={`input-edit-note-${noteItem.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (editingNoteText.trim()) {
                                    updateNoteMutation.mutate({ 
                                      noteId: noteItem.id, 
                                      description: editingNoteText 
                                    });
                                  }
                                }}
                                disabled={!editingNoteText.trim() || updateNoteMutation.isPending}
                                data-testid={`button-save-note-${noteItem.id}`}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Opslaan
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteText("");
                                }}
                                data-testid={`button-cancel-note-${noteItem.id}`}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Annuleren
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm mb-2">{noteItem.description}</div>
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">
                                {noteItem.createdAt && format(new Date(noteItem.createdAt), "d MMM yyyy HH:mm", { locale: nl })}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingNoteId(noteItem.id);
                                    setEditingNoteText(noteItem.description || "");
                                  }}
                                  data-testid={`button-edit-note-${noteItem.id}`}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Weet je zeker dat je deze notitie wilt verwijderen?")) {
                                      deleteNoteMutation.mutate(noteItem.id);
                                    }
                                  }}
                                  data-testid={`button-delete-note-${noteItem.id}`}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new note form */}
                <div className="space-y-2 pt-3 border-t">
                  <div className="text-sm font-medium">Nieuwe notitie</div>
                  <Textarea
                    placeholder="Voeg een notitie toe over deze reparatie..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="input-note-overview"
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!note.trim() || addNoteMutation.isPending}
                    data-testid="button-add-note-overview"
                  >
                    {addNoteMutation.isPending ? 'Opslaan...' : 'Notitie toevoegen'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4" />
                  Reparatie Voortgang
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RepairStatusTimeline currentStatus={currentRepair.status} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parts" className="space-y-4 min-h-[400px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Foto's
                </CardTitle>
              </CardHeader>
              <CardContent>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={photo}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nog geen foto's toegevoegd</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Bijlagen
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between border p-2 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{attachment.split('/').pop()}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(attachment, '_blank')}
                          data-testid={`button-download-${index}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
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
              <CardContent className="space-y-2">
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  data-testid="input-file-upload"
                />
                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFiles || uploadFilesMutation.isPending}
                  data-testid="button-upload-files"
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notitie toevoegen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="Voeg een notitie toe..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  data-testid="input-note"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!note.trim() || addNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  {addNoteMutation.isPending ? 'Opslaan...' : 'Notitie toevoegen'}
                </Button>
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
    </Dialog>
  );
}
