import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  AlertTriangle,
  Package,
  Calendar,
  MoreHorizontal,
  ArrowRight,
  ExternalLink,
  Edit,
  Archive,
  Trash2
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import type { Return } from "@shared/schema";

interface ReturnsKanbanProps {
  returns: Return[];
  isLoading: boolean;
  onViewReturn: (returnItem: Return) => void;
  onEditReturn?: (returnItem: Return) => void;
  onDeleteReturn?: (returnItem: Return) => void;
  onArchiveReturn?: (returnItem: Return) => void;
}

const STATUS_COLUMNS = [
  {
    id: 'nieuw',
    title: 'Nieuw',
    color: 'bg-chart-4',
    statuses: ['nieuw']
  },
  {
    id: 'onderweg',
    title: 'Onderweg',
    color: 'bg-primary',
    statuses: ['onderweg']
  },
  {
    id: 'ontvangen_controle',
    title: 'Ontvangen',
    color: 'bg-chart-2',
    statuses: ['ontvangen_controle']
  },
  {
    id: 'akkoord_terugbetaling',
    title: 'Akkoord',
    color: 'bg-chart-3',
    statuses: ['akkoord_terugbetaling']
  },
  {
    id: 'vermiste_pakketten',
    title: 'Vermist',
    color: 'bg-destructive',
    statuses: ['vermiste_pakketten']
  },
  {
    id: 'wachten_klant',
    title: 'Wacht Klant',
    color: 'bg-chart-1',
    statuses: ['wachten_klant']
  },
  {
    id: 'opnieuw_versturen',
    title: 'Opnieuw',
    color: 'bg-chart-5',
    statuses: ['opnieuw_versturen']
  },
  {
    id: 'klaar',
    title: 'Klaar',
    color: 'bg-muted-foreground',
    statuses: ['klaar']
  },
  {
    id: 'niet_ontvangen',
    title: 'Niet Ontvangen',
    color: 'bg-muted',
    statuses: ['niet_ontvangen']
  },
];

export function ReturnsKanban({ returns, isLoading, onViewReturn, onEditReturn, onDeleteReturn, onArchiveReturn }: ReturnsKanbanProps) {
  const { toast } = useToast();

  const updateReturnMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Return> }) => {
      const response = await apiRequest("PATCH", `/api/returns/${id}`, data);
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/returns"] });

      // Snapshot the previous value
      const previousReturns = queryClient.getQueryData<Return[]>(["/api/returns"]);

      // Optimistically update to the new value
      if (previousReturns) {
        queryClient.setQueryData<Return[]>(
          ["/api/returns"],
          previousReturns.map(r => r.id === id ? { ...r, ...data } : r)
        );
      }

      // Return context with previous data for rollback
      return { previousReturns };
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous data on error
      if (context?.previousReturns) {
        queryClient.setQueryData(["/api/returns"], context.previousReturns);
      }
      toast({
        title: "Fout",
        description: "Status kon niet worden bijgewerkt",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Retour bijgewerkt",
        description: "Status is succesvol gewijzigd",
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
    }
  });

  const columns = STATUS_COLUMNS.map(column => ({
    ...column,
    returns: returns.filter(r => column.statuses.includes(r.status))
  }));

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "border-l-4 border-l-destructive";
      case "high":
        return "border-l-4 border-l-chart-1";
      case "medium":
        return "border-l-4 border-l-chart-4";
      case "low":
        return "border-l-4 border-l-chart-2";
      default:
        return "";
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return null;

    const variants: Record<string, { label: string; className: string }> = {
      urgent: { label: "Urgent", className: "bg-destructive/10 text-destructive border-destructive/20" },
      high: { label: "Hoog", className: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
      medium: { label: "Medium", className: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
      low: { label: "Laag", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
    };

    const variant = variants[priority];
    if (!variant) return null;

    return (
      <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${variant.className}`}>
        {variant.label}
      </Badge>
    );
  };

  const getReasonLabel = (reason: string | null) => {
    const reasons: Record<string, string> = {
      wrong_item: "Verkeerd",
      damaged: "Beschadigd",
      defective: "Defect",
      size_issue: "Maat",
      changed_mind: "Bedacht",
      other: "Anders"
    };
    return reason ? reasons[reason] || reason : null;
  };

  const handleStatusChange = (returnItem: Return, newStatus: string) => {
    updateReturnMutation.mutate({
      id: returnItem.id,
      data: { status: newStatus as any }
    });
  };

  const handleViewReturn = (returnItem: Return) => {
    onViewReturn(returnItem);
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // No destination or dropped in same position
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    // Find the return item being dragged
    const returnItem = returns.find(r => r.id === draggableId);
    if (!returnItem) return;

    // Get the new status from the destination column
    const destinationColumn = STATUS_COLUMNS.find(col => col.id === destination.droppableId);
    if (!destinationColumn || !destinationColumn.statuses[0]) return;

    const newStatus = destinationColumn.statuses[0];

    // Update the return's status
    updateReturnMutation.mutate({
      id: returnItem.id,
      data: { status: newStatus as any }
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3" data-testid="kanban-loading">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="h-96">
            <CardHeader>
              <div className="h-4 bg-muted rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="h-24 bg-muted rounded animate-pulse"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2" data-testid="returns-kanban">
        {columns.map((column) => (
          <Card key={column.id} className="flex flex-col h-[calc(100vh-240px)]" data-testid={`kanban-column-${column.id}`}>
            <CardHeader className="pb-1.5 px-2 pt-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${column.color}`}></div>
                  <CardTitle className="text-[10px] font-medium">{column.title}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                  {column.returns.length}
                </Badge>
              </div>
            </CardHeader>

            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <ScrollArea className="flex-1 px-2 pb-2">
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[100px] ${snapshot.isDraggingOver ? 'bg-primary/5 rounded-md' : ''}`}
                  >
                    {column.returns.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-xs">
                        Geen retours
                      </div>
                    ) : (
                      column.returns.map((returnItem, index) => (
                        <Draggable key={returnItem.id} draggableId={returnItem.id} index={index}>
                          {(provided, snapshot) => (
                            <ContextMenu>
                              <ContextMenuTrigger>
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`cursor-pointer hover:shadow-md transition-all ${snapshot.isDragging ? 'shadow-lg rotate-2' : 'bg-card'
                                    } ${getPriorityColor(returnItem.priority)}`}
                                  onClick={() => handleViewReturn(returnItem)}
                                  data-testid={`return-card-${returnItem.id}`}
                                >
                                  <CardContent className="p-2">
                                    <div className="flex items-start justify-between mb-1.5">
                                      <div className="flex-1 mr-1">
                                        <h4 className="text-xs font-medium truncate font-mono">
                                          {(returnItem as any).orderNumber || returnItem.returnNumber}
                                        </h4>
                                        {(returnItem as any).orderNumber && (
                                          <p className="text-[10px] text-muted-foreground font-mono">
                                            {returnItem.returnNumber}
                                          </p>
                                        )}
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1" data-testid={`return-actions-${returnItem.id}`}>
                                            <MoreHorizontal className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewReturn(returnItem);
                                          }}>
                                            <ExternalLink className="h-3 w-3 mr-2" />
                                            Bekijk Details
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(returnItem, 'nieuw');
                                          }}>
                                            <ArrowRight className="h-3 w-3 mr-2" />
                                            Nieuw
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(returnItem, 'onderweg');
                                          }}>
                                            <ArrowRight className="h-3 w-3 mr-2" />
                                            Onderweg
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(returnItem, 'ontvangen_controle');
                                          }}>
                                            <ArrowRight className="h-3 w-3 mr-2" />
                                            Ontvangen
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(returnItem, 'akkoord_terugbetaling');
                                          }}>
                                            <ArrowRight className="h-3 w-3 mr-2" />
                                            Akkoord
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(returnItem, 'wachten_klant');
                                          }}>
                                            <ArrowRight className="h-3 w-3 mr-2" />
                                            Wacht Klant
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange(returnItem, 'klaar');
                                          }}>
                                            <ArrowRight className="h-3 w-3 mr-2" />
                                            Klaar
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    <div className="space-y-1.5">
                                      {returnItem.returnReason && (
                                        <div className="flex items-center gap-1">
                                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <span className="text-[10px] text-muted-foreground truncate">
                                            {getReasonLabel(returnItem.returnReason)}
                                          </span>
                                        </div>
                                      )}

                                      {returnItem.trackingNumber && (
                                        <div className="flex items-center gap-1">
                                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                                            {returnItem.trackingNumber}
                                          </span>
                                        </div>
                                      )}

                                      {returnItem.expectedReturnDate && (
                                        <div className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <span className="text-[10px] text-muted-foreground">
                                            {format(new Date(returnItem.expectedReturnDate), "d MMM", { locale: nl })}
                                          </span>
                                        </div>
                                      )}

                                      {returnItem.refundAmount && (
                                        <div className="flex items-center gap-1 pt-0.5">
                                          <span className="text-[11px] font-semibold text-primary">
                                            €{(returnItem.refundAmount / 100).toFixed(2)}
                                          </span>
                                        </div>
                                      )}

                                      <div className="flex items-center gap-1 pt-0.5">
                                        {getPriorityBadge(returnItem.priority)}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem onClick={() => handleViewReturn(returnItem)}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Bekijk Details
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => onEditReturn?.(returnItem)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Bewerken
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuSub>
                                  <ContextMenuSubTrigger>
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                    Wijzig Status
                                  </ContextMenuSubTrigger>
                                  <ContextMenuSubContent>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'nieuw')}>
                                      Nieuw
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'onderweg')}>
                                      Onderweg
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'ontvangen_controle')}>
                                      Ontvangen
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'akkoord_terugbetaling')}>
                                      Akkoord
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'vermiste_pakketten')}>
                                      Vermist
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'wachten_klant')}>
                                      Wacht Klant
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'opnieuw_versturen')}>
                                      Opnieuw Versturen
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'klaar')}>
                                      Klaar
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handleStatusChange(returnItem, 'niet_ontvangen')}>
                                      Niet Ontvangen
                                    </ContextMenuItem>
                                  </ContextMenuSubContent>
                                </ContextMenuSub>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => onArchiveReturn?.(returnItem)}>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archiveren
                                </ContextMenuItem>
                                <ContextMenuItem className="text-destructive" onClick={() => onDeleteReturn?.(returnItem)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Verwijderen
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                </ScrollArea>
              )}
            </Droppable>
          </Card>
        ))}
      </div>
    </DragDropContext>
  );
}
