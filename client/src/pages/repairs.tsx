import { useState } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Filter, 
  Plus,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle,
  Archive,
  ChevronDown,
  MessageSquare
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Repair } from "@/lib/types";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { RepairForm } from "@/components/forms/repair-form";
import { InternalNotes } from "@/components/notes/internal-notes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Repairs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showNewRepair, setShowNewRepair] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");

  const { data: repairs, isLoading } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
  });

  const filteredRepairs = repairs?.filter(repair => {
    if (priorityFilter !== "all" && repair.priority !== priorityFilter) return false;
    if (searchQuery && 
        !repair.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !repair.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const repairStatusCount = {
    new: filteredRepairs?.filter(r => r.status === 'new').length || 0,
    diagnosing: filteredRepairs?.filter(r => r.status === 'diagnosing').length || 0,
    waiting_parts: filteredRepairs?.filter(r => r.status === 'waiting_parts').length || 0,
    repair_in_progress: filteredRepairs?.filter(r => r.status === 'repair_in_progress').length || 0,
    quality_check: filteredRepairs?.filter(r => r.status === 'quality_check').length || 0,
    completed: filteredRepairs?.filter(r => r.status === 'completed').length || 0,
    returned: filteredRepairs?.filter(r => r.status === 'returned').length || 0,
    canceled: filteredRepairs?.filter(r => r.status === 'canceled').length || 0,
  };

  const totalActive = repairStatusCount.new + repairStatusCount.diagnosing + repairStatusCount.waiting_parts + repairStatusCount.repair_in_progress + repairStatusCount.quality_check;
  const totalCompleted = repairStatusCount.completed + repairStatusCount.returned;

  return (
    <div className="min-h-screen bg-background" data-testid="repairs-page">
      <Navigation />
      
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6" data-testid="repairs-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Repairs</h1>
            <p className="text-muted-foreground">Manage repair requests and track progress</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline"
              onClick={() => setViewMode(viewMode === "kanban" ? "list" : "kanban")}
              data-testid="toggle-view-mode"
            >
              {viewMode === "kanban" ? "List View" : "Kanban View"}
            </Button>
            <Button onClick={() => setShowNewRepair(true)} data-testid="new-repair-button">
              <Plus className="mr-2 h-4 w-4" />
              New Repair
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-6">
          <Card data-testid="repairs-stats-total">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActive}</div>
            </CardContent>
          </Card>
          
          <Card data-testid="repairs-stats-new">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New</CardTitle>
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repairStatusCount.new}</div>
            </CardContent>
          </Card>

          <Card data-testid="repairs-stats-diagnosing">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Diagnosing</CardTitle>
              <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repairStatusCount.diagnosing}</div>
            </CardContent>
          </Card>

          <Card data-testid="repairs-stats-in-progress">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Repair</CardTitle>
              <div className="h-3 w-3 rounded-full bg-orange-500"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repairStatusCount.repair_in_progress}</div>
            </CardContent>
          </Card>

          <Card data-testid="repairs-stats-quality-check">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality Check</CardTitle>
              <div className="h-3 w-3 rounded-full bg-purple-500"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repairStatusCount.quality_check}</div>
            </CardContent>
          </Card>

          <Card data-testid="repairs-stats-completed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCompleted}</div>
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
                    placeholder="Search repairs..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="repairs-search-input"
                  />
                </div>
                
                <Tabs value={priorityFilter} onValueChange={setPriorityFilter}>
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

        {/* Repair Board/List */}
        {viewMode === "kanban" ? (
          <KanbanBoard repairs={filteredRepairs} isLoading={isLoading} />
        ) : (
          <Card data-testid="repairs-list-view">
            <CardContent className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg animate-pulse">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded w-3/4 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredRepairs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No repairs found
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRepairs.map((repair) => (
                    <Card key={repair.id} data-testid={`repair-item-${repair.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{repair.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {repair.description}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant="outline">{repair.status}</Badge>
                              <Badge variant={repair.priority === 'urgent' ? 'destructive' : 'secondary'}>
                                {repair.priority}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {repair.slaDeadline && (
                              <div>Due: {new Date(repair.slaDeadline).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Team Notes Section */}
                        <Collapsible className="mt-4">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-start" data-testid={`repair-notes-toggle-${repair.id}`}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Team Notes
                              <ChevronDown className="h-4 w-4 ml-auto" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-4">
                            <InternalNotes 
                              entityType="repair"
                              entityId={repair.id}
                              entityTitle={repair.title}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <RepairForm 
        open={showNewRepair} 
        onOpenChange={setShowNewRepair}
      />
    </div>
  );
}
