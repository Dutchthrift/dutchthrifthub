import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Package2,
    Calendar,
    MoreHorizontal,
    ArrowRight,
    ExternalLink,
    Archive,
    Trash2,
    Euro,
    Building2
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
import type { PurchaseOrder, Supplier } from "@shared/schema";

interface PurchaseOrdersKanbanProps {
    purchaseOrders: PurchaseOrder[];
    suppliers: Supplier[];
    isLoading: boolean;
    onViewPO: (po: PurchaseOrder) => void;
    onArchivePO?: (id: string) => void;
    onUnarchivePO?: (id: string) => void;
    onDeletePO?: (id: string) => void;
}

const STATUS_COLUMNS = [
    {
        id: 'aangekocht',
        title: 'Aangekocht',
        color: 'bg-blue-500',
        headerBg: 'bg-blue-50 dark:bg-blue-950/30',
        headerBorder: 'border-blue-200 dark:border-blue-800',
        cardBorder: 'border-l-4 border-l-blue-500',
        countBg: 'bg-blue-500 text-white',
        statuses: ['aangekocht']
    },
    {
        id: 'ontvangen',
        title: 'Ontvangen',
        color: 'bg-emerald-500',
        headerBg: 'bg-emerald-50 dark:bg-emerald-950/30',
        headerBorder: 'border-emerald-200 dark:border-emerald-800',
        cardBorder: 'border-l-4 border-l-emerald-500',
        countBg: 'bg-emerald-500 text-white',
        statuses: ['ontvangen']
    },
    {
        id: 'verwerkt',
        title: 'Verwerkt',
        color: 'bg-gray-500',
        headerBg: 'bg-gray-100 dark:bg-gray-800/50',
        headerBorder: 'border-gray-200 dark:border-gray-700',
        cardBorder: 'border-l-4 border-l-gray-400',
        countBg: 'bg-gray-500 text-white',
        statuses: ['verwerkt']
    },
];

export function PurchaseOrdersKanban({
    purchaseOrders,
    suppliers,
    isLoading,
    onViewPO,
    onArchivePO,
    onUnarchivePO,
    onDeletePO
}: PurchaseOrdersKanbanProps) {
    const { toast } = useToast();

    const updatePOMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<PurchaseOrder> }) => {
            const response = await apiRequest("PATCH", `/api/purchase-orders/${id}`, data);
            return response.json();
        },
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: ["/api/purchase-orders"] });
            const previousPOs = queryClient.getQueryData<PurchaseOrder[]>(["/api/purchase-orders"]);

            if (previousPOs) {
                queryClient.setQueryData<PurchaseOrder[]>(
                    ["/api/purchase-orders"],
                    previousPOs.map(po => po.id === id ? { ...po, ...data } : po)
                );
            }

            return { previousPOs };
        },
        onError: (_error, _variables, context) => {
            if (context?.previousPOs) {
                queryClient.setQueryData(["/api/purchase-orders"], context.previousPOs);
            }
            toast({
                title: "Fout",
                description: "Status kon niet worden bijgewerkt",
                variant: "destructive",
            });
        },
        onSuccess: () => {
            toast({
                title: "Order bijgewerkt",
                description: "Status is succesvol gewijzigd",
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
        }
    });

    const columns = STATUS_COLUMNS.map(column => ({
        ...column,
        purchaseOrders: purchaseOrders.filter(po => column.statuses.includes(po.status || ''))
    }));

    const getSupplierName = (supplierId: string | null) => {
        if (!supplierId) return "Geen leverancier";
        const supplier = suppliers.find(s => s.id === supplierId);
        return supplier?.name || "Onbekend";
    };

    const handleStatusChange = (po: PurchaseOrder, newStatus: string) => {
        updatePOMutation.mutate({
            id: po.id,
            data: { status: newStatus as any }
        });
    };

    const handleDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
            return;
        }

        const po = purchaseOrders.find(p => p.id === draggableId);
        if (!po) return;

        const destinationColumn = STATUS_COLUMNS.find(col => col.id === destination.droppableId);
        if (!destinationColumn || !destinationColumn.statuses[0]) return;

        const newStatus = destinationColumn.statuses[0];

        updatePOMutation.mutate({
            id: po.id,
            data: { status: newStatus as any }
        });
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-3 gap-4" data-testid="kanban-loading">
                {[...Array(3)].map((_, i) => (
                    <Card key={i} className="h-96">
                        <CardHeader>
                            <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[...Array(3)].map((_, j) => (
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
            <div className="grid grid-cols-3 gap-4" data-testid="purchase-orders-kanban">
                {columns.map((column) => (
                    <Card key={column.id} className={`flex flex-col h-[calc(100vh-280px)] overflow-hidden`} data-testid={`kanban-column-${column.id}`}>
                        <CardHeader className={`pb-2 px-3 pt-3 flex-shrink-0 ${column.headerBg} border-b ${column.headerBorder}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                                    <CardTitle className="text-sm font-semibold">{column.title}</CardTitle>
                                </div>
                                <Badge className={`text-xs px-2 py-0.5 ${column.countBg} border-0`}>
                                    {column.purchaseOrders.length}
                                </Badge>
                            </div>
                        </CardHeader>

                        <Droppable droppableId={column.id}>
                            {(provided, snapshot) => (
                                <ScrollArea className="flex-1 px-3 pb-3">
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`space-y-3 min-h-[100px] pt-3 ${snapshot.isDraggingOver ? 'bg-primary/5 rounded-md' : ''}`}
                                    >
                                        {column.purchaseOrders.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground text-sm">
                                                Geen orders
                                            </div>
                                        ) : (
                                            column.purchaseOrders.map((po, index) => (
                                                <Draggable key={po.id} draggableId={po.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <ContextMenu>
                                                            <ContextMenuTrigger>
                                                                <Card
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    className={`cursor-pointer hover:shadow-md transition-all ${column.cardBorder} ${snapshot.isDragging ? 'shadow-lg rotate-2' : 'bg-card'}`}
                                                                    onClick={() => onViewPO(po)}
                                                                    data-testid={`po-card-${po.id}`}
                                                                >
                                                                    <CardContent className="p-3">
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex-1 mr-2">
                                                                                <h4 className="text-sm font-semibold truncate font-mono text-primary">
                                                                                    {po.poNumber}
                                                                                </h4>
                                                                                <p className="text-xs text-muted-foreground truncate">
                                                                                    {po.title}
                                                                                </p>
                                                                            </div>
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1" data-testid={`po-actions-${po.id}`}>
                                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuItem onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        onViewPO(po);
                                                                                    }}>
                                                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                                                        Bekijk Details
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleStatusChange(po, 'aangekocht');
                                                                                    }}>
                                                                                        <ArrowRight className="h-4 w-4 mr-2" />
                                                                                        Aangekocht
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleStatusChange(po, 'ontvangen');
                                                                                    }}>
                                                                                        <ArrowRight className="h-4 w-4 mr-2" />
                                                                                        Ontvangen
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleStatusChange(po, 'verwerkt');
                                                                                    }}>
                                                                                        <ArrowRight className="h-4 w-4 mr-2" />
                                                                                        Verwerkt
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        onArchivePO?.(po.id);
                                                                                    }}>
                                                                                        <Archive className="h-4 w-4 mr-2" />
                                                                                        Archiveren
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>

                                                                        <div className="space-y-1.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                                                <span className="text-xs text-muted-foreground truncate">
                                                                                    {getSupplierName(po.supplierId)}
                                                                                </span>
                                                                            </div>

                                                                            {po.orderDate && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                                                    <span className="text-xs text-amber-600 dark:text-amber-500">
                                                                                        {format(new Date(po.orderDate), "d MMM yyyy", { locale: nl })}
                                                                                    </span>
                                                                                </div>
                                                                            )}

                                                                            {po.totalAmount && (
                                                                                <div className="flex items-center gap-2 pt-0.5">
                                                                                    <Euro className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                                                    <span className="text-sm font-semibold text-green-600 dark:text-green-500">
                                                                                        €{(po.totalAmount / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            </ContextMenuTrigger>
                                                            <ContextMenuContent>
                                                                <ContextMenuItem onClick={() => onViewPO(po)}>
                                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                                    Bekijk Details
                                                                </ContextMenuItem>
                                                                <ContextMenuSeparator />
                                                                <ContextMenuSub>
                                                                    <ContextMenuSubTrigger>
                                                                        <ArrowRight className="h-4 w-4 mr-2" />
                                                                        Wijzig Status
                                                                    </ContextMenuSubTrigger>
                                                                    <ContextMenuSubContent>
                                                                        <ContextMenuItem onClick={() => handleStatusChange(po, 'aangekocht')}>
                                                                            Aangekocht
                                                                        </ContextMenuItem>
                                                                        <ContextMenuItem onClick={() => handleStatusChange(po, 'ontvangen')}>
                                                                            Ontvangen
                                                                        </ContextMenuItem>
                                                                        <ContextMenuItem onClick={() => handleStatusChange(po, 'verwerkt')}>
                                                                            Verwerkt
                                                                        </ContextMenuItem>
                                                                    </ContextMenuSubContent>
                                                                </ContextMenuSub>
                                                                <ContextMenuSeparator />
                                                                <ContextMenuItem onClick={() => onArchivePO?.(po.id)}>
                                                                    <Archive className="h-4 w-4 mr-2" />
                                                                    Archiveren
                                                                </ContextMenuItem>
                                                                <ContextMenuItem className="text-destructive" onClick={() => onDeletePO?.(po.id)}>
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
