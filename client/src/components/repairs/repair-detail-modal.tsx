import { useState, useEffect } from "react";
import { printRepairLabel } from "@/lib/print-repair-label";
import type { Repair, User } from "@shared/schema";
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
  User as UserIcon,
  Calendar as CalendarIcon,
  Upload,
  Trash2,
  AlertTriangle,
  Edit,
  Save,
  X,
  Maximize2,
  Image as ImageIcon,
  MessageSquare,
  CheckCircle,
  Circle,
  Package,
  Printer,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { nl } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface RepairDetailModalProps {
  repair: Repair | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}

const STATUSES = [
  { value: 'new', label: 'Nieuw', color: 'text-blue-500' },
  { value: 'in_repair', label: 'In Reparatie', color: 'text-orange-500' },
  { value: 'completed', label: 'Klaar', color: 'text-emerald-500' },
  { value: 'returned', label: 'Teruggestuurd', color: 'text-purple-500' },
];

export function RepairDetailModal({ repair, open, onOpenChange, users }: RepairDetailModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [currentRepair, setCurrentRepair] = useState<Repair | null>(repair);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentRepair(repair);
    if (repair) {
      setEditForm({
        title: repair.title || "",
        description: repair.description || "",
        productSku: repair.productSku || "",
        productName: repair.productName || "",
        assignedUserId: repair.assignedUserId || "none",
        priority: repair.priority || "medium",
        trackingNumber: repair.trackingNumber || "",
        trackingCarrier: repair.trackingCarrier || "",
      });
    }
  }, [repair]);

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
      if (!currentRepair) return;
      const res = await apiRequest('PATCH', `/api/repairs/${currentRepair.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedRepair) => {
      if (updatedRepair) setCurrentRepair(updatedRepair);
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({ title: "Status bijgewerkt" });
    },
  });

  const uploadFilesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      if (!currentRepair) return;
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
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
      toast({ title: "Bestanden geüpload" });
    },
  });

  const deleteRepairMutation = useMutation({
    mutationFn: async () => {
      if (!currentRepair) return;
      await apiRequest('DELETE', `/api/repairs/${currentRepair.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({ title: "Reparatie verwijderd" });
      onOpenChange(false);
    },
  });

  const updateRepairMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentRepair) return;
      const res = await apiRequest('PATCH', `/api/repairs/${currentRepair.id}`, data);
      return await res.json();
    },
    onSuccess: (updatedRepair) => {
      if (updatedRepair) setCurrentRepair(updatedRepair);
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      setIsEditMode(false);
      toast({ title: "Reparatie bijgewerkt" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async ({ fileType, fileUrl }: { fileType: 'photos' | 'attachments'; fileUrl: string }) => {
      if (!currentRepair) return;
      const currentFiles = fileType === 'photos' ? (currentRepair.photos || []) : (currentRepair.attachments || []);
      const updatedFiles = currentFiles.filter(f => f !== fileUrl);
      const res = await apiRequest('PATCH', `/api/repairs/${currentRepair.id}`, { [fileType]: updatedFiles });
      return await res.json();
    },
    onSuccess: (updatedRepair) => {
      if (updatedRepair) setCurrentRepair(updatedRepair);
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({ title: "Bestand verwijderd" });
    },
  });

  const handleSaveEdit = () => {
    updateRepairMutation.mutate({
      ...editForm,
      assignedUserId: editForm.assignedUserId === "none" ? null : editForm.assignedUserId,
    });
  };

  const handlePrintLabel = () => {
    if (!currentRepair) return;
    printRepairLabel(currentRepair);
  };

  if (!currentRepair) return null;

  const getStatusIndex = (status: string) => STATUSES.findIndex(s => s.value === status);
  const currentStatusIndex = getStatusIndex(currentRepair.status);

  const getTechnicianName = (userId: string | null) => {
    if (!userId) return 'Niet toegewezen';
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : '-';
  };

  const photos = Array.isArray(currentRepair.photos)
    ? currentRepair.photos.filter(p => !p.includes('undefined') && !p.endsWith('-'))
    : [];

  const technicians = users.filter(u => u.role === 'TECHNICUS' || u.role === 'ADMIN');

  const handleFileUpload = () => {
    if (selectedFiles && selectedFiles.length <= 10) {
      uploadFilesMutation.mutate(selectedFiles);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-hidden !flex !flex-col p-0 gap-0 [&>button]:hidden">
        {/* Header with Title and Uniform Icon Buttons - matches purchase order detail */}
        <div className="px-5 pt-4 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-semibold">{currentRepair.title}</DialogTitle>
                <Badge className={`font-mono text-xs shrink-0 ${(currentRepair as any).repairType === 'inventory'
                  ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600'
                  : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-600'
                  }`}>
                  {currentRepair.repairNumber || `#${currentRepair.id.slice(0, 8)}`}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                {(currentRepair as any).repairType === 'inventory' ? (
                  <>
                    <Package className="h-3.5 w-3.5 text-amber-600" />
                    <span>Inkoopreparatie</span>
                  </>
                ) : (
                  <>
                    <UserIcon className="h-3.5 w-3.5 text-blue-600" />
                    <span>{currentRepair.customerName || currentRepair.orderNumber || 'Klantreparatie'}</span>
                  </>
                )}
              </div>
            </div>
            {/* Uniform Icon Buttons Group */}
            <div className="flex items-center gap-0.5 shrink-0">
              {isEditMode ? (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditMode(false)}
                    title="Annuleren"
                    className="h-8 w-8 rounded-full text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateRepairMutation.isPending}
                    className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-full px-3"
                  >
                    <Save className="h-3 w-3 mr-1" />Opslaan
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditMode(true)}
                    title="Bewerken"
                    className="h-8 w-8 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePrintLabel}
                    title="Print DYMO Label"
                    className="h-8 w-8 rounded-full text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowNotes(!showNotes)}
                    title="Notities"
                    className={`h-8 w-8 rounded-full ${showNotes ? 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' : 'text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowFiles(!showFiles)}
                    title="Foto's"
                    className={`h-8 w-8 rounded-full ${showFiles ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30'}`}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowDeleteDialog(true)}
                    title="Verwijderen"
                    className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    title="Sluiten"
                    className="h-8 w-8 rounded-full text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Horizontal Timeline */}
          <div className="py-2 mb-3 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[280px]">
              {STATUSES.map((status, idx) => {
                const isCompleted = idx < currentStatusIndex;
                const isCurrent = idx === currentStatusIndex;
                return (
                  <div key={status.value} className="flex items-center flex-1">
                    <button
                      onClick={() => updateStatusMutation.mutate({ status: status.value })}
                      disabled={updateStatusMutation.isPending}
                      className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 ${isCurrent ? 'scale-110' : ''}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className={`h-5 w-5 ${status.color}`} />
                      ) : isCurrent ? (
                        <div className={`h-5 w-5 rounded-full border-2 ${status.color} border-current flex items-center justify-center`}>
                          <div className={`h-2 w-2 rounded-full bg-current`} />
                        </div>
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300" />
                      )}
                      <span className={`text-[10px] whitespace-nowrap ${isCurrent ? 'font-semibold ' + status.color : 'text-muted-foreground'}`}>
                        {status.label}
                      </span>
                    </button>
                    {idx < STATUSES.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 min-w-[20px] ${idx < currentStatusIndex ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {currentRepair.slaDeadline && !['completed', 'returned'].includes(currentRepair.status) && isPast(new Date(currentRepair.slaDeadline)) && (
              <div className="flex items-center gap-1 text-red-500 text-xs mt-2 justify-center">
                <AlertTriangle className="h-3 w-3" />Deadline overschreden
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="space-y-3">
            {isEditMode ? (
              <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">Titel</label>
                    <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Product</label>
                    <Input value={editForm.productName || ""} onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">SKU</label>
                    <Input value={editForm.productSku || ""} onChange={(e) => setEditForm({ ...editForm, productSku: e.target.value })} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Prioriteit</label>
                    <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                      <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Laag</SelectItem>
                        <SelectItem value="medium">Normaal</SelectItem>
                        <SelectItem value="high">Hoog</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium">Technicus</label>
                    <Select value={editForm.assignedUserId} onValueChange={(v) => setEditForm({ ...editForm, assignedUserId: v })}>
                      <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Niet toegewezen</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>{tech.firstName || tech.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium">Tracking Code (Retour)</label>
                      <Input value={editForm.trackingNumber || ""} onChange={(e) => setEditForm({ ...editForm, trackingNumber: e.target.value })} className="h-7 text-xs mt-0.5" placeholder="Track & Trace" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Vervoerder</label>
                      <Input value={editForm.trackingCarrier || ""} onChange={(e) => setEditForm({ ...editForm, trackingCarrier: e.target.value })} className="h-7 text-xs mt-0.5" placeholder="bijv. PostNL" />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium">Beschrijving</label>
                    <Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="text-xs mt-0.5 min-h-[120px]" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Inventory Repair - Special Layout with amber theme */}
                {(currentRepair as any).repairType === 'inventory' ? (
                  <div className="space-y-3">
                    {/* Product Info Section */}
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Product Informatie</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="text-muted-foreground">Titel: </span>
                          <span className="font-medium">{currentRepair.title}</span>
                        </div>
                        {currentRepair.productName && currentRepair.productName !== currentRepair.title && (
                          <div>
                            <span className="text-muted-foreground">Merk & Model: </span>
                            <span className="font-medium">{currentRepair.productName}</span>
                          </div>
                        )}
                        {currentRepair.productSku && (
                          <div>
                            <span className="text-muted-foreground">SKU: </span>
                            <span className="font-medium font-mono">{currentRepair.productSku}</span>
                          </div>
                        )}
                        {(currentRepair as any).issueCategory && (
                          <div>
                            <span className="text-muted-foreground">Probleem Categorie: </span>
                            <span className="font-medium">{(currentRepair as any).issueCategory}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description Section - First */}
                    {currentRepair.description && (
                      <div className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 rounded-lg border border-slate-200 dark:border-slate-800 min-h-[80px]">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-slate-600" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">Beschrijving</span>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{currentRepair.description}</p>
                      </div>
                    )}

                    {/* Details Section - After Description */}
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Reparatie Details</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Prioriteit</span>
                          <Badge className={`text-[10px] h-4 px-1.5 ${currentRepair.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            currentRepair.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              currentRepair.priority === 'low' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                            {currentRepair.priority === 'urgent' ? 'Urgent' : currentRepair.priority === 'high' ? 'Hoog' : currentRepair.priority === 'low' ? 'Laag' : 'Normaal'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Technicus</span>
                          <span className="font-medium flex items-center gap-1"><UserIcon className="h-3 w-3" />{getTechnicianName(currentRepair.assignedUserId)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Aangemaakt</span>
                          <span className="font-medium flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{currentRepair.createdAt ? format(new Date(currentRepair.createdAt), "d MMM yyyy", { locale: nl }) : '-'}</span>
                        </div>
                        {currentRepair.slaDeadline && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Deadline</span>
                            <span className={`font-medium flex items-center gap-1 ${isPast(new Date(currentRepair.slaDeadline)) && !['completed', 'returned'].includes(currentRepair.status) ? 'text-red-500' : ''}`}>
                              <CalendarIcon className="h-3 w-3" />
                              {format(new Date(currentRepair.slaDeadline), "d MMM yyyy", { locale: nl })}
                            </span>
                          </div>
                        )}
                        {/* Tracking Display for Inventory Repairs */}
                        {(currentRepair.trackingNumber || currentRepair.trackingCarrier) && (
                          <div className="flex items-center justify-between col-span-2 pt-2 border-t border-purple-200 dark:border-purple-800 mt-1">
                            <span className="text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" />Retour Tracking</span>
                            <div className="flex flex-col items-end">
                              <span className="font-medium font-mono">{currentRepair.trackingNumber || '-'}</span>
                              {currentRepair.trackingCarrier && <span className="text-[10px] text-muted-foreground">{currentRepair.trackingCarrier}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Customer Repair - Blue theme layout */
                  <div className="space-y-3">
                    {/* Customer Info Section */}
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <UserIcon className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Klant & Product</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {currentRepair.customerEmail && (
                          <div>
                            <span className="text-muted-foreground">Klant: </span>
                            <span className="font-medium">{currentRepair.customerName || currentRepair.customerEmail}</span>
                          </div>
                        )}
                        {currentRepair.orderNumber && (
                          <div>
                            <span className="text-muted-foreground">Order: </span>
                            <span className="font-medium font-mono">{currentRepair.orderNumber}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Product: </span>
                          <span className="font-medium">{currentRepair.productName || currentRepair.title}</span>
                        </div>
                        {currentRepair.productSku && (
                          <div>
                            <span className="text-muted-foreground">SKU: </span>
                            <span className="font-medium font-mono">{currentRepair.productSku}</span>
                          </div>
                        )}
                        {(currentRepair as any).issueCategory && (
                          <div>
                            <span className="text-muted-foreground">Probleem: </span>
                            <span className="font-medium">{(currentRepair as any).issueCategory}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description Section - First */}
                    {currentRepair.description && (
                      <div className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 rounded-lg border border-slate-200 dark:border-slate-800 min-h-[80px]">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-slate-600" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">Beschrijving</span>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{currentRepair.description}</p>
                      </div>
                    )}

                    {/* Details Section - After Description */}
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Reparatie Details</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Prioriteit</span>
                          <Badge className={`text-[10px] h-4 px-1.5 ${currentRepair.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            currentRepair.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              currentRepair.priority === 'low' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                            {currentRepair.priority === 'urgent' ? 'Urgent' : currentRepair.priority === 'high' ? 'Hoog' : currentRepair.priority === 'low' ? 'Laag' : 'Normaal'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Technicus</span>
                          <span className="font-medium flex items-center gap-1"><UserIcon className="h-3 w-3" />{getTechnicianName(currentRepair.assignedUserId)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Aangemaakt</span>
                          <span className="font-medium flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{currentRepair.createdAt ? format(new Date(currentRepair.createdAt), "d MMM yyyy", { locale: nl }) : '-'}</span>
                        </div>
                        {currentRepair.slaDeadline && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Deadline</span>
                            <span className={`font-medium flex items-center gap-1 ${isPast(new Date(currentRepair.slaDeadline)) && !['completed', 'returned'].includes(currentRepair.status) ? 'text-red-500' : ''}`}>
                              <CalendarIcon className="h-3 w-3" />
                              {format(new Date(currentRepair.slaDeadline), "d MMM yyyy", { locale: nl })}
                            </span>
                          </div>
                        )}
                        {/* Tracking Display for Customer Repairs */}
                        {(currentRepair.trackingNumber || currentRepair.trackingCarrier) && (
                          <div className="flex items-center justify-between col-span-2 pt-2 border-t border-purple-200 dark:border-purple-800 mt-1">
                            <span className="text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" />Retour Tracking</span>
                            <div className="flex flex-col items-end">
                              <span className="font-medium font-mono">{currentRepair.trackingNumber || '-'}</span>
                              {currentRepair.trackingCarrier && <span className="text-[10px] text-muted-foreground">{currentRepair.trackingCarrier}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Collapsible: Notes */}
          {showNotes && currentUser && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 mt-3">
              <NotesPanel entityType="repair" entityId={currentRepair.id} currentUser={currentUser} />
            </div>
          )}

          {/* Collapsible: Files */}
          {showFiles && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 space-y-2 mt-3">
              {photos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((photo, idx) => {
                    const photoPath = photo.startsWith('/attachments/') ? photo.substring('/attachments/'.length) : photo;
                    const photoUrl = `/api/attachments/${photoPath}`;
                    return (
                      <div key={idx} className="relative aspect-square rounded overflow-hidden border group">
                        <img src={photoUrl} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setFullScreenImage(photoUrl)} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button variant="secondary" size="sm" className="h-6 w-6 p-0" onClick={() => setFullScreenImage(photoUrl)}>
                            <Maximize2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Nog geen foto's</p>
              )}
              <div className="flex gap-2 items-center pt-2 border-t">
                <Input type="file" multiple onChange={(e) => setSelectedFiles(e.target.files)} accept="image/*,.pdf" className="h-7 text-xs flex-1" />
                <Button size="sm" onClick={handleFileUpload} disabled={!selectedFiles || uploadFilesMutation.isPending} className="h-7 text-xs">
                  <Upload className="h-3 w-3 mr-1" />Upload
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reparatie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRepairMutation.mutate()} className="bg-destructive">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Image */}
      {fullScreenImage && (
        <Dialog open={!!fullScreenImage} onOpenChange={() => setFullScreenImage(null)}>
          <DialogContent className="max-w-4xl p-2">
            <img src={fullScreenImage} alt="" className="w-full h-auto max-h-[80vh] object-contain rounded" />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
