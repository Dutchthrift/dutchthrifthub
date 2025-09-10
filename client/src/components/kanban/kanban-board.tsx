import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Clock,
  AlertTriangle,
  User,
  Calendar,
  MoreHorizontal,
  Plus
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { Repair } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface KanbanBoardProps {
  repairs: Repair[];
  isLoading: boolean;
}

export function KanbanBoard({ repairs, isLoading }: KanbanBoardProps) {
  const { toast } = useToast();

  const updateRepairMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Repair> }) => {
      const response = await fetch(`/api/repairs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update repair");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      toast({
        title: "Repair updated",
        description: "Repair status has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update repair",
        variant: "destructive",
      });
    }
  });

  const columns = [
    {
      id: 'new',
      title: 'New',
      color: 'bg-chart-4',
      repairs: repairs.filter(r => r.status === 'new')
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      color: 'bg-primary',
      repairs: repairs.filter(r => r.status === 'in_progress')
    },
    {
      id: 'waiting',
      title: 'Waiting',
      color: 'bg-chart-1',
      repairs: repairs.filter(r => r.status === 'waiting_customer' || r.status === 'waiting_part')
    },
    {
      id: 'ready',
      title: 'Ready',
      color: 'bg-chart-2',
      repairs: repairs.filter(r => r.status === 'ready')
    },
    {
      id: 'closed',
      title: 'Closed',
      color: 'bg-muted-foreground',
      repairs: repairs.filter(r => r.status === 'closed')
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-destructive bg-destructive/10";
      case "high":
        return "border-chart-1 bg-chart-1/10";
      case "medium":
        return "border-chart-4 bg-chart-4/10";
      case "low":
        return "border-chart-2 bg-chart-2/10";
      default:
        return "border-border";
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const handleStatusChange = (repair: Repair, newStatus: string) => {
    updateRepairMutation.mutate({
      id: repair.id,
      data: { status: newStatus as any }
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="kanban-loading">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="h-96">
            <CardHeader>
              <div className="h-4 bg-muted rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-20 bg-muted rounded animate-pulse"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="kanban-board">
      {columns.map((column) => (
        <Card key={column.id} className="flex flex-col h-[calc(100vh-300px)]" data-testid={`kanban-column-${column.id}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {column.repairs.length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto space-y-3 pb-3">
            {column.repairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No repairs
              </div>
            ) : (
              column.repairs.map((repair) => (
                <Card
                  key={repair.id}
                  className={`cursor-pointer hover:shadow-md transition-all ${getPriorityColor(repair.priority || 'medium')}`}
                  data-testid={`repair-card-${repair.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium truncate flex-1 mr-2">
                        {repair.title}
                      </h4>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`repair-actions-${repair.id}`}>
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusChange(repair, 'new')}>
                            Move to New
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(repair, 'in_progress')}>
                            Move to In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(repair, 'waiting_customer')}>
                            Waiting for Customer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(repair, 'ready')}>
                            Mark as Ready
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(repair, 'closed')}>
                            Close Repair
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {repair.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {repair.description}
                      </p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={getPriorityVariant(repair.priority || 'medium')} className="text-xs">
                          {repair.priority?.charAt(0).toUpperCase() + repair.priority?.slice(1) || 'Medium'}
                        </Badge>
                        
                        {repair.estimatedCost && (
                          <span className="text-xs font-medium text-muted-foreground">
                            €{((repair.estimatedCost || 0) / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      
                      {repair.slaDeadline && (
                        <div className={`flex items-center space-x-1 text-xs ${
                          isOverdue(repair.slaDeadline) ? 'text-destructive' : 'text-muted-foreground'
                        }`}>
                          <Calendar className="h-3 w-3" />
                          <span>Due: {formatDate(repair.slaDeadline)}</span>
                          {isOverdue(repair.slaDeadline) && (
                            <AlertTriangle className="h-3 w-3 ml-1" />
                          )}
                        </div>
                      )}
                      
                      {repair.assignedUserId && (
                        <div className="flex items-center space-x-1">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-xs">
                              {repair.assignedUserId.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">Assigned</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
