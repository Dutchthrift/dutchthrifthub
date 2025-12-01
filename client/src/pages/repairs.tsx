import { useState } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, CalendarIcon, Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Repair, User } from "@shared/schema";
import { CreateRepairWizard } from "@/components/repairs/create-repair-wizard";
import { RepairsTable } from "@/components/repairs/repairs-table";
import { RepairDetailModal } from "@/components/repairs/repair-detail-modal";
import { RepairAnalytics } from "@/components/repairs/repair-analytics";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

export default function Repairs() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showNewRepair, setShowNewRepair] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);

  const { data: repairs = [], isLoading } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const filteredRepairs = repairs.filter(repair => {
    if (statusFilter && statusFilter !== "all" && repair.status !== statusFilter) return false;
    if (technicianFilter && technicianFilter !== "all" && repair.assignedUserId !== technicianFilter) return false;
    if (searchQuery &&
      !repair.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !repair.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !repair.productSku?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !repair.productName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (dateFrom && repair.createdAt && new Date(repair.createdAt) < dateFrom) return false;
    if (dateTo && repair.createdAt && new Date(repair.createdAt) > dateTo) return false;
    return true;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTechnicianFilter("all");
    setDateFrom(null);
    setDateTo(null);
  };

  const hasActiveFilters = searchQuery || (statusFilter && statusFilter !== "all") || (technicianFilter && technicianFilter !== "all") || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-background" data-testid="repairs-page">
      <Navigation />

      <main className="container mx-auto px-4 py-6">
        <div className="bg-card rounded-lg p-6 mb-6 border" data-testid="repairs-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Reparaties</h1>
              <p className="text-muted-foreground">Beheer reparatieverzoeken en volg de voortgang</p>
            </div>
            <Button onClick={() => setShowNewRepair(true)} data-testid="button-new-repair" className="sm:flex-shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe Reparatie
            </Button>
          </div>
        </div>

        {/* Analytics Dashboard */}
        <div className="mb-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded mb-2 animate-pulse"></div>
                    <div className="h-8 bg-muted rounded animate-pulse"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <RepairAnalytics repairs={filteredRepairs} users={users} />
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Zoek reparaties..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Alle statussen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
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

                {user?.role !== 'TECHNICUS' && (
                  <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-technician-filter">
                      <SelectValue placeholder="Alle technici" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle technici</SelectItem>
                      {users.filter(u => u.role === 'TECHNICUS' || u.role === 'ADMIN').map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName || ''} {user.lastName || ''} ({user.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="button-date-from">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PP") : "Van datum"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom || undefined}
                      onSelect={(date) => setDateFrom(date || null)}
                      initialFocus
                      data-testid="calendar-date-from"
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="button-date-to">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PP") : "Tot datum"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo || undefined}
                      onSelect={(date) => setDateTo(date || null)}
                      initialFocus
                      data-testid="calendar-date-to"
                    />
                  </PopoverContent>
                </Popover>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Filters wissen
                  </Button>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                {filteredRepairs.length} van {repairs.length} reparaties
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repairs Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg animate-pulse">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <RepairsTable
            repairs={filteredRepairs}
            users={users}
            onRepairClick={(repair) => setSelectedRepair(repair)}
          />
        )}
      </main>

      <CreateRepairWizard
        open={showNewRepair}
        onOpenChange={setShowNewRepair}
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
