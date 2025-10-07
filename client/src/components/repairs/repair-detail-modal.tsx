import { useState } from "react";
import type { Repair, User, Activity } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const { toast } = useToast();

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/activities', 'repair', repair?.id],
    enabled: !!repair?.id && activeTab === 'activity',
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { status: string }) => {
      if (!repair) return;
      return await apiRequest(`/api/repairs/${repair.id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({
        title: "Status bijgewerkt",
        description: "De reparatiestatus is succesvol bijgewerkt.",
      });
    },
  });

  const uploadFilesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      if (!repair) return;
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      return await apiRequest(`/api/repairs/${repair.id}/upload`, 'POST', formData);
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
      if (!repair) return;
      return await apiRequest('/api/activities', 'POST', {
        type: 'note_added',
        description: noteText,
        metadata: { entityType: 'repair', entityId: repair.id },
      });
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

  if (!repair) return null;

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

  const partsUsed = Array.isArray(repair.partsUsed) ? repair.partsUsed : [];
  const attachments = Array.isArray(repair.attachments) ? repair.attachments : [];
  const photos = Array.isArray(repair.photos) ? repair.photos : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Reparatie #{repair.id.slice(0, 8)}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{repair.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={getStatusColor(repair.status)}>
                {getStatusLabel(repair.status)}
              </Badge>
              {repair.slaDeadline && 
               !['completed', 'returned', 'canceled'].includes(repair.status) && 
               isPast(new Date(repair.slaDeadline)) && (
                <div className="flex items-center gap-1 text-destructive" data-testid="indicator-overdue">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">Te laat</span>
                </div>
              )}
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

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Reparatie Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Product</div>
                    <div className="text-sm text-muted-foreground">{repair.productName || repair.title}</div>
                    {repair.productSku && (
                      <div className="text-xs text-muted-foreground">SKU: {repair.productSku}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">Probleem Categorie</div>
                    <div className="text-sm text-muted-foreground">{repair.issueCategory || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Technicus</div>
                    <div className="text-sm text-muted-foreground">{getTechnicianName(repair.assignedUserId)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Prioriteit</div>
                    <div className="text-sm">
                      <Badge variant="outline">
                        {repair.priority === 'urgent' ? 'Urgent' : 
                         repair.priority === 'high' ? 'Hoog' : 
                         repair.priority === 'medium' ? 'Gemiddeld' : 'Laag'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Beschrijving</div>
                  <div className="text-sm text-muted-foreground mt-1">{repair.description || '-'}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Ontvangen op
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {repair.createdAt ? format(new Date(repair.createdAt), "d MMMM yyyy", { locale: nl }) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Laatst bijgewerkt
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {repair.updatedAt ? format(new Date(repair.updatedAt), "d MMMM yyyy HH:mm", { locale: nl }) : '-'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Status bijwerken</div>
                  <Select
                    value={repair.status}
                    onValueChange={(value) => updateStatusMutation.mutate({ status: value })}
                    data-testid="select-status"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nieuw</SelectItem>
                      <SelectItem value="diagnosing">Diagnose</SelectItem>
                      <SelectItem value="waiting_parts">Wacht op onderdelen</SelectItem>
                      <SelectItem value="repair_in_progress">In reparatie</SelectItem>
                      <SelectItem value="quality_check">Kwaliteitscontrole</SelectItem>
                      <SelectItem value="completed">Voltooid</SelectItem>
                      <SelectItem value="returned">Geretourneerd</SelectItem>
                      <SelectItem value="canceled">Geannuleerd</SelectItem>
                    </SelectContent>
                  </Select>
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
                <RepairStatusTimeline currentStatus={repair.status} />
              </CardContent>
            </Card>

            {(repair.customerId || repair.orderId) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    Klant & Order Informatie
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {repair.customerId && (
                    <div>
                      <div className="text-sm font-medium">Klant ID</div>
                      <div className="text-sm text-muted-foreground font-mono">#{repair.customerId.slice(0, 8)}</div>
                    </div>
                  )}
                  {repair.orderId && (
                    <div>
                      <div className="text-sm font-medium">Order ID</div>
                      <div className="text-sm text-muted-foreground font-mono">#{repair.orderId.slice(0, 8)}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="parts" className="space-y-4">
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

            {repair.estimatedCost && (
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
                    <div className="text-lg font-bold">€{(repair.estimatedCost / 100).toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
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

          <TabsContent value="activity" className="space-y-4">
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
    </Dialog>
  );
}
