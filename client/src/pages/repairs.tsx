import { useState } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Plus, ChevronDown, ChevronUp, User, Package, Wrench, CheckCircle, Truck, Pencil, Trash2, Archive, ArrowRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Repair, User as UserType } from "@shared/schema";
import { CreateRepairWizard } from "@/components/repairs/create-repair-wizard";
import { InventoryRepairWizard } from "@/components/repairs/inventory-repair-wizard";
import { RepairDetailModal } from "@/components/repairs/repair-detail-modal";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";

// Status configuration for the 4 simple statuses
const STATUS_CONFIG = {
  new: {
    label: "Nieuw",
    color: "bg-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: Plus
  },
  in_repair: {
    label: "In Reparatie",
    color: "bg-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    icon: Wrench
  },
  completed: {
    label: "Klaar",
    color: "bg-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    icon: CheckCircle
  },
  returned: {
    label: "Teruggestuurd",
    color: "bg-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    icon: Truck
  },
};

const STATUS_ORDER = ["new", "in_repair", "completed", "returned"] as const;

export default function Repairs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewCustomerRepair, setShowNewCustomerRepair] = useState(false);
  const [showNewInventoryRepair, setShowNewInventoryRepair] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [customerSectionOpen, setCustomerSectionOpen] = useState(true);
  const [inventorySectionOpen, setInventorySectionOpen] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const { data: repairs = [], isLoading } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Delete mutation
  const deleteRepairMutation = useMutation({
    mutationFn: async (repairId: string) => {
      await apiRequest("DELETE", `/api/repairs/${repairId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      toast({ title: "Reparatie verwijderd", description: "De reparatie is succesvol verwijderd." });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon reparatie niet verwijderen.", variant: "destructive" });
    },
  });

  // Archive mutation (set status to 'returned' which acts as archived)
  const archiveRepairMutation = useMutation({
    mutationFn: async (repairId: string) => {
      await apiRequest("PATCH", `/api/repairs/${repairId}`, { status: "returned" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      toast({ title: "Reparatie gearchiveerd", description: "De reparatie is verplaatst naar Teruggestuurd." });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon reparatie niet archiveren.", variant: "destructive" });
    },
  });

  // Status update mutation for drag-drop and context menu
  const updateStatusMutation = useMutation({
    mutationFn: async ({ repairId, status }: { repairId: string; status: string }) => {
      await apiRequest("PATCH", `/api/repairs/${repairId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon status niet wijzigen.", variant: "destructive" });
    },
  });

  // Drag-and-drop state
  const [activeRepair, setActiveRepair] = useState<Repair | null>(null);

  // Configure sensors for better drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const repairId = event.active.id as string;
    const repair = repairs.find(r => r.id === repairId);
    console.log('[Drag] Started dragging:', repairId, repair?.title);
    setActiveRepair(repair || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log('[Drag] Ended. Active:', active.id, 'Over:', over?.id);
    setActiveRepair(null);

    if (!over) {
      console.log('[Drag] No drop target');
      return;
    }

    const repairId = active.id as string;
    const newStatus = over.id as string;
    const repair = repairs.find(r => r.id === repairId);

    console.log('[Drag] Repair:', repair?.title, 'Current status:', repair?.status, 'New status:', newStatus);

    if (repair && repair.status !== newStatus && STATUS_ORDER.includes(newStatus as any)) {
      console.log('[Drag] Updating status...');
      updateStatusMutation.mutate({ repairId, status: newStatus });
    } else {
      console.log('[Drag] Status not changed - same status or invalid');
    }
  };

  const handleStatusChange = (repair: Repair, newStatus: string) => {
    if (repair.status !== newStatus) {
      updateStatusMutation.mutate({ repairId: repair.id, status: newStatus });
    }
  };

  const handleDeleteRepair = (repair: Repair) => {
    if (confirm(`Weet je zeker dat je "${repair.title}" wilt verwijderen?`)) {
      deleteRepairMutation.mutate(repair.id);
    }
  };

  const handleArchiveRepair = (repair: Repair) => {
    archiveRepairMutation.mutate(repair.id);
  };

  // Filter repairs by type and archive status
  const filterByArchive = (repair: Repair) => {
    const isArchived = (repair as any).isArchived === true;
    return showArchived ? isArchived : !isArchived;
  };

  const customerRepairs = repairs.filter(r =>
    ((r as any).repairType === 'customer' || !(r as any).repairType) && filterByArchive(r)
  );
  const inventoryRepairs = repairs.filter(r => (r as any).repairType === 'inventory' && filterByArchive(r));

  // Apply search filter
  const filterBySearch = (repair: Repair) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      repair.title.toLowerCase().includes(query) ||
      repair.description?.toLowerCase().includes(query) ||
      repair.productSku?.toLowerCase().includes(query) ||
      repair.productName?.toLowerCase().includes(query)
    );
  };

  const filteredCustomerRepairs = customerRepairs.filter(filterBySearch);
  const filteredInventoryRepairs = inventoryRepairs.filter(filterBySearch);

  // Group repairs by status
  const groupByStatus = (repairList: Repair[]) => {
    const grouped: Record<string, Repair[]> = {};
    STATUS_ORDER.forEach(status => {
      grouped[status] = repairList.filter(r => r.status === status);
    });
    return grouped;
  };

  const customerByStatus = groupByStatus(filteredCustomerRepairs);
  const inventoryByStatus = groupByStatus(filteredInventoryRepairs);

  // Draggable repair card component
  const DraggableRepairCard = ({ repair }: { repair: Repair }) => {
    const assignedUser = users.find(u => u.id === repair.assignedUserId);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: repair.id,
    });

    const style: React.CSSProperties = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: 50,
      opacity: 0.8,
    } : {};

    const statusConfig = STATUS_CONFIG[repair.status as keyof typeof STATUS_CONFIG];

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "relative group",
          isDragging && "pointer-events-none"
        )}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Card
              className={cn(
                "hover:shadow-md transition-all border-l-4 select-none",
                isDragging && "shadow-lg"
              )}
              style={{ borderLeftColor: statusConfig?.color.replace('bg-', '') }}
              onDoubleClick={() => setSelectedRepair(repair)}
            >
              {/* Drag handle - the entire card is draggable */}
              <div
                {...attributes}
                {...listeners}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
              />
              <CardContent className="p-3 relative pointer-events-none">
                {repair.repairType === 'customer' ? (
                  <>
                    {/* Customer repair: Order number as title */}
                    <h4 className="font-medium text-sm truncate">{repair.orderNumber || 'Geen order'}</h4>
                    <p className="text-xs text-muted-foreground truncate">{repair.productName || repair.title}</p>
                    <p className="text-xs text-blue-500">{repair.repairNumber || `#${repair.id.slice(0, 6)}`}</p>
                    {repair.customerName && (
                      <p className="text-xs text-blue-600 truncate">👤 {repair.customerName}</p>
                    )}
                  </>
                ) : (
                  <>
                    {/* Inventory repair: Product title as title */}
                    <h4 className="font-medium text-sm truncate">{repair.title}</h4>
                    <p className="text-xs text-amber-600 truncate">
                      {repair.repairNumber || `#${repair.id.slice(0, 6)}`}
                    </p>
                  </>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  {assignedUser && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[80px]">{assignedUser.firstName || assignedUser.username}</span>
                    </div>
                  )}
                  {repair.priority && repair.priority !== 'medium' && (
                    <Badge variant={repair.priority === 'urgent' ? 'destructive' : repair.priority === 'high' ? 'default' : 'secondary'} className="text-xs pointer-events-auto">
                      {repair.priority === 'urgent' ? 'Urgent' : repair.priority === 'high' ? 'Hoog' : 'Laag'}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => setSelectedRepair(repair)}>
              <Pencil className="h-4 w-4 mr-2" />
              Bewerken
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <ArrowRight className="h-4 w-4 mr-2" />
                Status wijzigen
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {STATUS_ORDER.map(status => {
                  const config = STATUS_CONFIG[status];
                  return (
                    <ContextMenuItem
                      key={status}
                      onClick={() => handleStatusChange(repair, status)}
                      disabled={repair.status === status}
                    >
                      <div className={cn("w-2 h-2 rounded-full mr-2", config.color)} />
                      {config.label}
                      {repair.status === status && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                    </ContextMenuItem>
                  );
                })}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem onClick={() => handleArchiveRepair(repair)} disabled={repair.status === 'returned'}>
              <Archive className="h-4 w-4 mr-2" />
              Archiveren
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handleDeleteRepair(repair)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijderen
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  };

  // Droppable status column component
  const DroppableStatusColumn = ({ status, repairs: columnRepairs }: { status: string; repairs: Repair[] }) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    const { setNodeRef, isOver } = useDroppable({ id: status });
    if (!config) return null;

    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-w-[200px] rounded-lg p-3 transition-all",
          config.bgColor,
          config.borderColor,
          "border",
          isOver && "ring-2 ring-primary ring-offset-2 bg-primary/5"
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", config.color)} />
            <span className="font-medium text-sm">{config.label}</span>
          </div>
          <Badge variant="secondary" className="text-xs">{columnRepairs.length}</Badge>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto min-h-[100px]">
          {columnRepairs.map(repair => (
            <DraggableRepairCard key={repair.id} repair={repair} />
          ))}
          {columnRepairs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {isOver ? "Laat los om hier te plaatsen" : "Geen reparaties"}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render a repair section (Customer or Inventory)
  const RepairSection = ({
    title,
    icon: SectionIcon,
    repairs: sectionRepairs,
    byStatus,
    isOpen,
    onToggle,
    onNewRepair,
    gradient
  }: {
    title: string;
    icon: typeof User;
    repairs: Repair[];
    byStatus: Record<string, Repair[]>;
    isOpen: boolean;
    onToggle: () => void;
    onNewRepair: () => void;
    gradient: string;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="mb-6 overflow-hidden">
        <CardHeader className={cn("py-4", gradient)}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent flex items-center gap-3">
                <SectionIcon className="h-5 w-5" />
                <CardTitle className="text-lg">{title}</CardTitle>
                <Badge variant="secondary" className="ml-2">{sectionRepairs.length}</Badge>
                {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            </CollapsibleTrigger>
            <Button size="sm" onClick={onNewRepair}>
              <Plus className="h-4 w-4 mr-1" />
              Nieuwe
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {STATUS_ORDER.map(status => (
                  <DroppableStatusColumn key={status} status={status} repairs={byStatus[status] || []} />
                ))}
              </div>
              <DragOverlay>
                {activeRepair && (
                  <Card className="shadow-xl border-l-4 cursor-grabbing rotate-2 scale-105" style={{ borderLeftColor: STATUS_CONFIG[activeRepair.status as keyof typeof STATUS_CONFIG]?.color.replace('bg-', '') }}>
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm truncate">
                        {activeRepair.repairType === 'customer' ? (activeRepair.orderNumber || 'Geen order') : activeRepair.title}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {activeRepair.repairNumber || `#${activeRepair.id.slice(0, 6)}`}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="repairs-page">
      <Navigation />

      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-card rounded-lg p-6 mb-6 border" data-testid="repairs-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Reparaties</h1>
              <p className="text-muted-foreground">Beheer klant- en inkoopreparaties</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="whitespace-nowrap"
              >
                <Archive className="h-4 w-4 mr-2" />
                {showArchived ? "Archief" : "Actief"}
              </Button>
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Zoek reparaties..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{repairs.filter(r => r.status === 'new').length}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Nieuw</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{repairs.filter(r => r.status === 'in_repair').length}</div>
              <div className="text-sm text-orange-600 dark:text-orange-400">In Reparatie</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{repairs.filter(r => r.status === 'completed').length}</div>
              <div className="text-sm text-green-600 dark:text-green-400">Klaar</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{repairs.filter(r => r.status === 'returned').length}</div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Teruggestuurd</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-8 bg-muted rounded mb-4 animate-pulse w-1/4"></div>
                  <div className="flex gap-4">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="flex-1 h-[200px] bg-muted rounded animate-pulse"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Customer Repairs Section */}
            <RepairSection
              title="Klantreparaties"
              icon={User}
              repairs={filteredCustomerRepairs}
              byStatus={customerByStatus}
              isOpen={customerSectionOpen}
              onToggle={() => setCustomerSectionOpen(!customerSectionOpen)}
              onNewRepair={() => setShowNewCustomerRepair(true)}
              gradient="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30"
            />

            {/* Inventory Repairs Section */}
            <RepairSection
              title="Inkoopreparaties"
              icon={Package}
              repairs={filteredInventoryRepairs}
              byStatus={inventoryByStatus}
              isOpen={inventorySectionOpen}
              onToggle={() => setInventorySectionOpen(!inventorySectionOpen)}
              onNewRepair={() => setShowNewInventoryRepair(true)}
              gradient="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
            />
          </>
        )}
      </main>

      {/* Customer Repair Wizard */}
      <CreateRepairWizard
        open={showNewCustomerRepair}
        onOpenChange={setShowNewCustomerRepair}
        users={users}
        repairType="customer"
      />

      {/* Inventory Repair Wizard - separate flow for inventory repairs */}
      <InventoryRepairWizard
        open={showNewInventoryRepair}
        onOpenChange={setShowNewInventoryRepair}
        users={users}
      />

      <RepairDetailModal
        repair={selectedRepair}
        open={!!selectedRepair}
        onOpenChange={(open) => !open && setSelectedRepair(null)}
        users={users}
      />
    </div>
  );
}

