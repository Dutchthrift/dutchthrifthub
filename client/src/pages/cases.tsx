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
import { CreateCaseModal } from "../components/forms/create-case-modal";
import { CaseContextMenu } from "../components/cases/case-context-menu";
import { CaseDetailModal } from "../components/cases/case-detail-modal";

const CASE_STATUS_CONFIG = {
  new: { label: "Nieuw", color: "bg-chart-4", icon: FileText },
  in_progress: { label: "In Behandeling", color: "bg-primary", icon: Clock },
  waiting_customer: { label: "Wachtend op Klant", color: "bg-chart-1", icon: Users },
  resolved: { label: "Opgelost", color: "bg-chart-2", icon: CheckCircle },
};

export default function Cases() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showNewCase, setShowNewCase] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [columns, setColumns] = useState(Object.keys(CASE_STATUS_CONFIG));
  const [selectedCase, setSelectedCase] = useState<CaseWithDetails | null>(null);
  const { toast } = useToast();

  const { data: cases, isLoading } = useQuery<CaseWithDetails[]>({
    queryKey: ["/api/cases"],
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data, previousData }: { id: string; data: Partial<Case>; previousData?: CaseWithDetails[] }) => {
      const response = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update case");
      return response.json();
    },
    onSuccess: (updatedCase, { id }) => {
      // Update the query data with the server response instead of invalidating
      queryClient.setQueryData(["/api/cases"], (oldData: CaseWithDetails[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(caseItem =>
          caseItem.id === id
            ? { ...caseItem, ...updatedCase }
            : caseItem
        );
      });

      toast({
        title: "Case bijgewerkt",
        description: "Case status is succesvol bijgewerkt",
      });
    },
    onError: (error, { id, previousData }) => {
      // Revert to the previous state on error
      if (previousData) {
        queryClient.setQueryData(["/api/cases"], previousData);
      } else {
        // Fallback: invalidate queries to refetch correct state
        queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      }

      toast({
        title: "Bijwerken mislukt",
        description: "Kon case status niet bijwerken",
        variant: "destructive",
      });
    }
  });

  const filteredCases = useMemo(() => {
    if (!cases) return [];

    return cases.filter(caseItem => {
      // Filter by archived status
      if (showArchived) {
        if (!caseItem.archived) return false;
      } else {
        if (caseItem.archived) return false;
      }

      if (priorityFilter !== "all" && caseItem.priority !== priorityFilter) return false;
      if (searchQuery &&
        !caseItem.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !caseItem.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !caseItem.caseNumber.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [cases, priorityFilter, searchQuery, showArchived]);

  const caseStatusCount = useMemo(() => {
    const counts = {
      all: filteredCases.length,
      new: 0,
      in_progress: 0,
      waiting_customer: 0,
      resolved: 0,
    };

    filteredCases.forEach(c => {
      if (c.status in counts) {
        counts[c.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [filteredCases]);

  const totalActive = caseStatusCount.new + caseStatusCount.in_progress + caseStatusCount.waiting_customer;

  // Calculate "New Today" - cases created today
  const newToday = useMemo(() => {
    if (!cases) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return cases.filter(c => {
      if (!c.createdAt) return false;
      const createdDate = new Date(c.createdAt);
      createdDate.setHours(0, 0, 0, 0);
      return createdDate.getTime() === today.getTime() && c.status === 'new';
    }).length;
  }, [cases]);

  // Calculate "Resolved Today" - cases resolved today
  const resolvedToday = useMemo(() => {
    if (!cases) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return cases.filter(c => {
      if (!c.updatedAt || c.status !== 'resolved') return false;
      const updatedDate = new Date(c.updatedAt);
      updatedDate.setHours(0, 0, 0, 0);
      return updatedDate.getTime() === today.getTime();
    }).length;
  }, [cases]);

  // Calculate "Overdue SLA" - cases past their SLA deadline
  const overdueSLA = useMemo(() => {
    if (!cases) return 0;
    const now = new Date();

    return cases.filter(c => {
      if (!c.slaDeadline || c.status === 'resolved') return false;
      const deadline = new Date(c.slaDeadline);
      return deadline < now;
    }).length;
  }, [cases]);

  const onDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const { draggableId, destination, source } = result;
    const newStatus = destination.droppableId;
    const caseId = draggableId;

    // Don't update if dropped in the same position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Store the previous state for potential rollback
    const previousData = queryClient.getQueryData(["/api/cases"]) as CaseWithDetails[] | undefined;

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
      data: { status: newStatus as any },
      previousData // Pass previous data for potential rollback
    });
  }, [updateCaseMutation, queryClient]);

  // Archive mutation
  const archiveCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cases/${id}/archive`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to archive case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case gearchiveerd",
        description: "Case is succesvol gearchiveerd",
      });
    },
    onError: () => {
      toast({
        title: "Archiveren mislukt",
        description: "Kon case niet archiveren",
        variant: "destructive",
      });
    }
  });

  // Unarchive mutation
  const unarchiveCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cases/${id}/unarchive`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to unarchive case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case hersteld",
        description: "Case is succesvol uit archief hersteld",
      });
    },
    onError: () => {
      toast({
        title: "Herstellen mislukt",
        description: "Kon case niet uit archief herstellen",
        variant: "destructive",
      });
    }
  });

  // Delete mutation
  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cases/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete case");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case verwijderd",
        description: "Case is succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        title: "Verwijderen mislukt",
        description: "Kon case niet verwijderen",
        variant: "destructive",
      });
    }
  });

  // Context menu handlers
  const handleCaseOpen = (caseId: string) => {
    const caseItem = cases?.find(c => c.id === caseId);
    if (caseItem) setSelectedCase(caseItem);
  };

  const handleCaseArchive = (caseId: string) => {
    archiveCaseMutation.mutate(caseId);
  };

  const handleCaseUnarchive = (caseId: string) => {
    unarchiveCaseMutation.mutate(caseId);
  };

  const handleCaseDelete = (caseId: string) => {
    deleteCaseMutation.mutate(caseId);
  };

  const handleCaseStatusChange = (caseId: string, newStatus: string) => {
    const previousData = cases;
    updateCaseMutation.mutate({
      id: caseId,
      data: { status: newStatus as any },
      previousData
    });
  };

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
    if (!date) return "Geen datum ingesteld";
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
        <CaseContextMenu
          caseId={caseItem.id}
          currentStatus={caseItem.status}
          isArchived={caseItem.archived || false}
          onOpen={handleCaseOpen}
          onArchive={handleCaseArchive}
          onUnarchive={handleCaseUnarchive}
          onDelete={handleCaseDelete}
          onStatusChange={handleCaseStatusChange}
        >
          <Card
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`mb-3 cursor-pointer hover:shadow-md transition-shadow ${snapshot.isDragging ? "rotate-3 shadow-lg" : ""
              } ${caseItem.archived ? "opacity-60" : ""}`}
            onClick={() => setSelectedCase(caseItem)}
            data-testid={`case-card-${caseItem.id}`}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-sm line-clamp-2" data-testid={`case-title-${caseItem.id}`}>
                  {caseItem.title}
                  {caseItem.archived && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Gearchiveerd
                    </Badge>
                  )}
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
                      {isOverdue(caseItem.slaDeadline) ? 'Verlopen' : formatDate(caseItem.slaDeadline)}
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

                  <div className="flex items-center gap-2">
                    {caseItem.notesCount !== undefined && caseItem.notesCount > 0 && (
                      <Badge variant="outline" className="text-xs" data-testid={`case-notes-count-${caseItem.id}`}>
                        📝 {caseItem.notesCount}
                      </Badge>
                    )}
                    {caseItem.assignedUser && (
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs" data-testid={`case-assignee-${caseItem.id}`}>
                          {(caseItem.assignedUser.firstName?.[0] || '') + (caseItem.assignedUser.lastName?.[0] || '')}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CaseContextMenu>
      )}
    </Draggable>
  ), [handleCaseOpen, handleCaseArchive, handleCaseUnarchive, handleCaseDelete]);

  const Column = useCallback(({ status, cases: columnCases }: { status: string; cases: CaseWithDetails[] }) => {
    const config = CASE_STATUS_CONFIG[status as keyof typeof CASE_STATUS_CONFIG];
    const Icon = config.icon;

    return (
      <Card className="h-full bg-gradient-to-br from-indigo-50/60 to-white/40 dark:from-indigo-950/10 dark:to-zinc-900/40 border-2 border-indigo-200/60 dark:border-indigo-800/40 hover:shadow-md transition-shadow" data-testid={`column-${status}`}>
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
                className={`min-h-[200px] rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-muted/50" : ""
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

      <main className="container mx-auto px-4 py-6">
        <div className="bg-card rounded-lg p-6 mb-6 border" data-testid="cases-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Cases</h1>
              <p className="text-muted-foreground">Beheer klantzaken en volg de voortgang</p>
            </div>
            <div>
              <Button
                data-testid="new-case-button"
                className="sm:flex-shrink-0"
                onClick={() => setShowNewCase(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe Case
              </Button>
              <CreateCaseModal
                open={showNewCase}
                onOpenChange={setShowNewCase}
              />
            </div>
          </div>
        </div>

        {/* Stats Cards - Repairs page gradient style */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalActive}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Totaal Actief</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{newToday}</div>
              <div className="text-sm text-emerald-600 dark:text-emerald-400">Nieuw Vandaag</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{resolvedToday}</div>
              <div className="text-sm text-green-600 dark:text-green-400">Opgelost Vandaag</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">{overdueSLA}</div>
              <div className="text-sm text-red-600 dark:text-red-400">Verlopen SLA</div>
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
                    placeholder="Cases zoeken..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchQuery(value);
                    }}
                    data-testid="cases-search-input"
                  />
                </div>

                <Tabs value={priorityFilter} onValueChange={setPriorityFilter}>
                  <TabsList>
                    <TabsTrigger value="all" data-testid="filter-all-priority">Alle</TabsTrigger>
                    <TabsTrigger value="urgent" data-testid="filter-urgent-priority">Urgent</TabsTrigger>
                    <TabsTrigger value="high" data-testid="filter-high-priority">Hoog</TabsTrigger>
                    <TabsTrigger value="medium" data-testid="filter-medium-priority">Gemiddeld</TabsTrigger>
                    <TabsTrigger value="low" data-testid="filter-low-priority">Laag</TabsTrigger>
                  </TabsList>
                </Tabs>

                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  data-testid="archive-toggle-button"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {showArchived ? "Toon Actief" : "Toon Archief"}
                </Button>
              </div>

              <Button variant="outline" size="icon" data-testid="advanced-filters-button">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="min-h-[600px]" data-testid="cases-kanban-board">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
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
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {columns.map(status => {
                  const columnCases = filteredCases.filter(caseItem => caseItem.status === status);
                  return (
                    <Column key={status} status={status} cases={columnCases} />
                  );
                })}
              </div>
            </DragDropContext>
          )}
        </div>
      </main>

      {/* Case Detail Modal */}
      {selectedCase && (
        <CaseDetailModal
          caseId={selectedCase.id}
          initialData={selectedCase}
          open={!!selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </div>
  );
}