import { useState, useMemo, useCallback } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Search, 
  Filter, 
  Plus,
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle,
  Archive,
  Users,
  FileText
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { Case, CaseWithDetails } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CaseForm } from "../components/forms/case-form";

const CASE_STATUS_CONFIG = {
  new: { label: "New", color: "bg-chart-4", icon: FileText },
  in_progress: { label: "In Progress", color: "bg-primary", icon: Clock },
  waiting_customer: { label: "Waiting Customer", color: "bg-chart-1", icon: Users },
  waiting_part: { label: "Waiting Part", color: "bg-chart-3", icon: AlertTriangle },
  resolved: { label: "Resolved", color: "bg-chart-2", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-muted-foreground", icon: Archive },
};

export default function Cases() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);
  const [columns, setColumns] = useState(Object.keys(CASE_STATUS_CONFIG));
  const { toast } = useToast();

  const { data: cases, isLoading } = useQuery<CaseWithDetails[]>({
    queryKey: ["/api/cases"],
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Case> }) => {
      const response = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case updated",
        description: "Case status has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update case status",
        variant: "destructive",
      });
    }
  });

  const filteredCases = useMemo(() => {
    if (!cases) return [];
    
    return cases.filter(caseItem => {
      if (priorityFilter !== "all" && caseItem.priority !== priorityFilter) return false;
      if (searchQuery && 
          !caseItem.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !caseItem.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !caseItem.caseNumber.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [cases, priorityFilter, searchQuery]);

  const caseStatusCount = useMemo(() => {
    const counts = {
      all: filteredCases.length,
      new: 0,
      in_progress: 0,
      waiting_customer: 0,
      waiting_part: 0,
      resolved: 0,
      closed: 0,
    };

    filteredCases.forEach(c => {
      if (c.status in counts) {
        counts[c.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [filteredCases]);

  const totalWaiting = caseStatusCount.waiting_customer + caseStatusCount.waiting_part;
  const totalActive = caseStatusCount.new + caseStatusCount.in_progress + totalWaiting + caseStatusCount.resolved;

  const onDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const { draggableId, destination, source } = result;
    const newStatus = destination.droppableId;
    const caseId = draggableId;

    // Don't update if dropped in the same position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Optimistic update
    queryClient.setQueryData(["/api/cases"], (oldData: CaseWithDetails[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(caseItem => 
        caseItem.id === caseId 
          ? { ...caseItem, status: newStatus as any }
          : caseItem
      );
    });

    // Update case status
    updateCaseMutation.mutate({ 
      id: caseId, 
      data: { status: newStatus as any } 
    });
  }, [updateCaseMutation, queryClient]);

  const getPriorityVariant = (priority: string | null) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "No date set";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  };

  const isOverdue = (slaDeadline: Date | string | null) => {
    if (!slaDeadline) return false;
    const deadlineDate = typeof slaDeadline === 'string' ? new Date(slaDeadline) : slaDeadline;
    return deadlineDate < new Date();
  };

  const CaseCard = useCallback(({ caseItem, index }: { caseItem: CaseWithDetails; index: number }) => (
    <Draggable draggableId={caseItem.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-3 cursor-pointer hover:shadow-md transition-shadow ${
            snapshot.isDragging ? "rotate-3 shadow-lg" : ""
          }`}
          onClick={() => window.location.href = `/cases/${caseItem.id}`}
          data-testid={`case-card-${caseItem.id}`}
        >
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-sm line-clamp-2" data-testid={`case-title-${caseItem.id}`}>
                {caseItem.title}
              </h3>
              <Badge variant={getPriorityVariant(caseItem.priority)} className="ml-2 text-xs">
                {caseItem.priority}
              </Badge>
            </div>
            
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {caseItem.description}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground" data-testid={`case-number-${caseItem.id}`}>
                  #{caseItem.caseNumber}
                </span>
                {caseItem.slaDeadline && (
                  <span className={`font-medium ${isOverdue(caseItem.slaDeadline) ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {isOverdue(caseItem.slaDeadline) ? 'Overdue' : formatDate(caseItem.slaDeadline)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {caseItem.customer ? (
                    <span data-testid={`case-customer-${caseItem.id}`}>
                      {caseItem.customer.firstName} {caseItem.customer.lastName}
                    </span>
                  ) : (
                    <span>{caseItem.customerEmail}</span>
                  )}
                </div>
                
                {caseItem.assignedUser && (
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs" data-testid={`case-assignee-${caseItem.id}`}>
                      {(caseItem.assignedUser.firstName?.[0] || '') + (caseItem.assignedUser.lastName?.[0] || '')}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </Draggable>
  ), []);

  const Column = useCallback(({ status, cases: columnCases }: { status: string; cases: CaseWithDetails[] }) => {
    const config = CASE_STATUS_CONFIG[status as keyof typeof CASE_STATUS_CONFIG];
    const Icon = config.icon;
    
    return (
      <Card className="h-full" data-testid={`column-${status}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${config.color}`}></div>
              <span>{config.label}</span>
              <Badge variant="secondary" className="text-xs">
                {columnCases.length}
              </Badge>
            </div>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Droppable droppableId={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[200px] rounded-lg transition-colors ${
                  snapshot.isDraggingOver ? "bg-muted/50" : ""
                }`}
              >
                {columnCases.map((caseItem, index) => (
                  <CaseCard key={caseItem.id} caseItem={caseItem} index={index} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </CardContent>
      </Card>
    );
  }, [CaseCard]);

  return (
    <div className="min-h-screen bg-background" data-testid="cases-page">
      <Navigation />
      
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6" data-testid="cases-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cases</h1>
            <p className="text-muted-foreground">Manage customer cases and track progress</p>
          </div>
          <Dialog open={showNewCase} onOpenChange={setShowNewCase}>
            <DialogTrigger asChild>
              <Button data-testid="new-case-button">
                <Plus className="mr-2 h-4 w-4" />
                New Case
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Case</DialogTitle>
              </DialogHeader>
              <CaseForm onSuccess={() => setShowNewCase(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-6">
          <Card data-testid="cases-stats-total">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActive}</div>
            </CardContent>
          </Card>
          
          <Card data-testid="cases-stats-new">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New</CardTitle>
              <div className="h-3 w-3 rounded-full bg-chart-4"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{caseStatusCount.new}</div>
            </CardContent>
          </Card>

          <Card data-testid="cases-stats-progress">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <div className="h-3 w-3 rounded-full bg-primary"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{caseStatusCount.in_progress}</div>
            </CardContent>
          </Card>

          <Card data-testid="cases-stats-waiting">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waiting</CardTitle>
              <div className="h-3 w-3 rounded-full bg-chart-1"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWaiting}</div>
            </CardContent>
          </Card>

          <Card data-testid="cases-stats-resolved">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <div className="h-3 w-3 rounded-full bg-chart-2"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{caseStatusCount.resolved}</div>
            </CardContent>
          </Card>

          <Card data-testid="cases-stats-closed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed</CardTitle>
              <div className="h-3 w-3 rounded-full bg-muted-foreground"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{caseStatusCount.closed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search cases..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchQuery(value);
                    }}
                    data-testid="cases-search-input"
                  />
                </div>
                
                <Tabs value={priorityFilter} onValueChange={(value) => {
                  setIsTransitioning(true);
                  // Small delay to allow for smooth transition
                  setTimeout(() => {
                    setPriorityFilter(value);
                    setIsTransitioning(false);
                  }, 50);
                }}>
                  <TabsList>
                    <TabsTrigger value="all" data-testid="filter-all-priority">All</TabsTrigger>
                    <TabsTrigger value="urgent" data-testid="filter-urgent-priority">Urgent</TabsTrigger>
                    <TabsTrigger value="high" data-testid="filter-high-priority">High</TabsTrigger>
                    <TabsTrigger value="medium" data-testid="filter-medium-priority">Medium</TabsTrigger>
                    <TabsTrigger value="low" data-testid="filter-low-priority">Low</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <Button variant="outline" size="icon" data-testid="advanced-filters-button">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className={`min-h-[600px] transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`} data-testid="cases-kanban-board">
          {isLoading || isTransitioning ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-[400px] animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="h-24 bg-muted rounded"></div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <DragDropContext key={`${priorityFilter}-${searchQuery}`} onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {columns.map(status => {
                  const columnCases = filteredCases.filter(caseItem => caseItem.status === status);
                  return (
                    <Column key={`${status}-${priorityFilter}`} status={status} cases={columnCases} />
                  );
                })}
              </div>
            </DragDropContext>
          )}
        </div>
      </main>
    </div>
  );
}