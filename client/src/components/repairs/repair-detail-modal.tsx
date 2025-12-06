import { useState, useEffect } from "react";
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4">
        {/* Header */}
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-500" />
                <span className="truncate">{currentRepair.title}</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                #{currentRepair.id.slice(0, 8)} • {currentRepair.orderNumber || (currentRepair.repairType === 'inventory' ? 'Inkoop' : 'Klant')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {isEditMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)} className="h-7 w-7 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateRepairMutation.isPending} className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600">
                    <Save className="h-3 w-3 mr-1" />Opslaan
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditMode(true)} className="h-7 w-7 p-0" title="Bewerken">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowNotes(!showNotes)} className={`h-7 w-7 p-0 ${showNotes ? 'text-blue-500' : ''}`} title="Notities">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFiles(!showFiles)} className={`h-7 w-7 p-0 ${showFiles ? 'text-purple-500' : ''}`} title="Foto's">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)} className="h-7 w-7 p-0 text-red-500" title="Verwijderen">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Horizontal Timeline */}
        <div className="py-3 border-b">
          <div className="flex items-center justify-between">
            {STATUSES.map((status, idx) => {
              const isCompleted = idx < currentStatusIndex;
              const isCurrent = idx === currentStatusIndex;
              return (
                <div key={status.value} className="flex items-center flex-1">
                  <button
                    onClick={() => updateStatusMutation.mutate({ status: status.value })}
                    disabled={updateStatusMutation.isPending}
                    className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${isCurrent ? 'scale-110' : ''}`}
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
                    <span className={`text-[10px] ${isCurrent ? 'font-semibold ' + status.color : 'text-muted-foreground'}`}>
                      {status.label}
                    </span>
                  </button>
                  {idx < STATUSES.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${idx < currentStatusIndex ? 'bg-emerald-500' : 'bg-gray-200'}`} />
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

        {/* Main Content - 2 Column Layout */}
        <div className="py-3">
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
                <div className="col-span-2">
                  <label className="text-xs font-medium">Beschrijving</label>
                  <Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="text-xs mt-0.5 min-h-[50px]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {/* Left Column - Details */}
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground">Product</span>
                  <p className="font-medium">{currentRepair.productName || currentRepair.title}</p>
                </div>
                {currentRepair.productSku && (
                  <div>
                    <span className="text-muted-foreground">SKU</span>
                    <p className="font-medium font-mono">{currentRepair.productSku}</p>
                  </div>
                )}
                {currentRepair.customerEmail && (
                  <div>
                    <span className="text-muted-foreground">Klant</span>
                    <p className="font-medium">{currentRepair.customerName || currentRepair.customerEmail}</p>
                  </div>
                )}
              </div>

              {/* Right Column - Meta */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Prioriteit</span>
                  <Badge className={`text-[10px] h-4 px-1.5 ${currentRepair.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      currentRepair.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        currentRepair.priority === 'low' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-600'
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
                  <span className="font-medium flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{currentRepair.createdAt ? format(new Date(currentRepair.createdAt), "d MMM", { locale: nl }) : '-'}</span>
                </div>
              </div>

              {/* Full Width - Description */}
              {currentRepair.description && (
                <div className="col-span-2 pt-2 border-t mt-2">
                  <span className="text-muted-foreground">Beschrijving</span>
                  <p className="font-medium mt-0.5">{currentRepair.description}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible: Notes */}
        {showNotes && currentUser && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 mb-2">
            <NotesPanel entityType="repair" entityId={currentRepair.id} currentUser={currentUser} />
          </div>
        )}

        {/* Collapsible: Files */}
        {showFiles && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 space-y-2">
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
