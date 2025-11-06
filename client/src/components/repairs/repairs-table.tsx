import { useState } from "react";
import type { Repair, User } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Edit, Trash2, MessageSquare, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";
import { nl } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface RepairsTableProps {
  repairs: Repair[];
  users: User[];
  onRepairClick: (repair: Repair) => void;
  onAddNote?: (repair: Repair) => void;
}

export function RepairsTable({ repairs, users, onRepairClick, onAddNote }: RepairsTableProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/repairs/${id}`);
    },
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/repairs'] });
      
      // Snapshot previous value
      const previousRepairs = queryClient.getQueryData(['/api/repairs']);
      
      // Optimistically update cache
      queryClient.setQueryData(['/api/repairs'], (old: Repair[] | undefined) => {
        return old?.filter((repair) => repair.id !== deletedId) || [];
      });
      
      return { previousRepairs };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({
        title: "Reparatie verwijderd",
        description: "De reparatie is succesvol verwijderd.",
      });
    },
    onError: (err, deletedId, context) => {
      // Rollback on error
      if (context?.previousRepairs) {
        queryClient.setQueryData(['/api/repairs'], context.previousRepairs);
      }
      toast({
        title: "Fout",
        description: "Kan reparatie niet verwijderen.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'diagnosing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'waiting_parts':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'repair_in_progress':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'quality_check':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'returned':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'canceled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgent';
      case 'high': return 'Hoog';
      case 'medium': return 'Gemiddeld';
      case 'low': return 'Laag';
      default: return priority;
    }
  };

  const getTechnicianName = (userId: string | null) => {
    if (!userId) return 'Niet toegewezen';
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Onbekend';
  };

  const isOverdue = (repair: Repair) => {
    if (!repair.slaDeadline) return false;
    const isActive = !['completed', 'returned', 'canceled'].includes(repair.status);
    return isActive && isPast(new Date(repair.slaDeadline));
  };

  const handleDelete = (e: React.MouseEvent, repairId: string) => {
    e.stopPropagation();
    if (confirm('Weet je zeker dat je deze reparatie wilt verwijderen?')) {
      deleteMutation.mutate(repairId);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reparatie ID</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Klant / Order</TableHead>
            <TableHead>Probleem</TableHead>
            <TableHead>Technicus</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioriteit</TableHead>
            <TableHead>Ontvangen</TableHead>
            <TableHead>Laatst bijgewerkt</TableHead>
            <TableHead className="text-right">Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repairs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                Geen reparaties gevonden
              </TableCell>
            </TableRow>
          ) : (
            repairs.map((repair) => (
              <TableRow
                key={repair.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRepairClick(repair)}
                data-testid={`row-repair-${repair.id}`}
              >
                <TableCell className="font-medium font-mono text-xs" data-testid={`text-repair-id-${repair.id}`}>
                  #{repair.id.slice(0, 8)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{repair.productName || repair.title}</span>
                    {repair.productSku && (
                      <span className="text-xs text-muted-foreground">SKU: {repair.productSku}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    {repair.customerId ? (
                      <span className="text-sm">Klant #{repair.customerId.slice(0, 8)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Geen klant</span>
                    )}
                    {repair.orderId && (
                      <span className="text-xs text-muted-foreground">Order #{repair.orderId.slice(0, 8)}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs truncate">
                    {repair.issueCategory && (
                      <Badge variant="outline" className="mb-1 mr-2">{repair.issueCategory}</Badge>
                    )}
                    <span className="text-sm">{repair.description || repair.title}</span>
                  </div>
                </TableCell>
                <TableCell>{getTechnicianName(repair.assignedUserId)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={getStatusColor(repair.status)}
                      data-testid={`badge-status-${repair.id}`}
                    >
                      {getStatusLabel(repair.status)}
                    </Badge>
                    {isOverdue(repair) && (
                      <div className="flex items-center gap-1 text-destructive" data-testid={`indicator-overdue-${repair.id}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs font-medium">Te laat</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={getPriorityColor(repair.priority || 'medium')}
                  >
                    {getPriorityLabel(repair.priority || 'medium')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {repair.createdAt
                    ? format(new Date(repair.createdAt), "d MMM yyyy", { locale: nl })
                    : "-"}
                </TableCell>
                <TableCell>
                  {repair.updatedAt
                    ? format(new Date(repair.updatedAt), "d MMM HH:mm", { locale: nl })
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" data-testid={`button-actions-${repair.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onRepairClick(repair); }}
                        data-testid={`menu-view-details-${repair.id}`}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Details bekijken
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onRepairClick(repair); }}
                        data-testid={`menu-update-status-${repair.id}`}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Status bijwerken
                      </DropdownMenuItem>
                      {onAddNote && (
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); onAddNote(repair); }}
                          data-testid={`menu-add-note-${repair.id}`}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Notitie toevoegen
                        </DropdownMenuItem>
                      )}
                      {user?.role === 'ADMIN' && (
                        <DropdownMenuItem 
                          onClick={(e) => handleDelete(e, repair.id)}
                          className="text-destructive focus:text-destructive"
                          data-testid={`menu-delete-${repair.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Verwijderen
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
