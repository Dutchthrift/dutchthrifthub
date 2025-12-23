import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isToday, addMonths, subMonths, eachDayOfInterval, isSameMonth, setHours, setMinutes, differenceInMinutes, addMinutes, parseISO, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Plus,
    Calendar as CalendarIcon,
    List,
    Clock,
    MapPin,
    Users,
    Link2,
    Repeat,
    Download,
    MoreVertical,
    Pencil,
    Trash2,
    Lock,
    CheckSquare,
    X,
} from "lucide-react";

// Types
type AppointmentType = "afspraak" | "intern" | "taak" | "blok";
type ViewMode = "month" | "week" | "day" | "list";

interface Appointment {
    id: string;
    seriesId: string;
    title: string;
    type: AppointmentType;
    startTime: string;
    endTime: string;
    description?: string;
    location?: string;
    color?: string;
    allDay?: boolean;
    isRemote?: boolean;
    meetingLink?: string;
    recurrenceRule?: string;
    assignedTo?: string;
    createdBy?: string;
    orderId?: string;
    customerId?: string;
    caseId?: string;
    repairId?: string;
    isRecurring?: boolean;
    originalStart?: string;
}

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

// Type configuration
const TYPE_CONFIG: Record<AppointmentType, { color: string; label: string; icon: any }> = {
    afspraak: { color: "#3B82F6", label: "Afspraak", icon: CalendarIcon },
    intern: { color: "#8B5CF6", label: "Intern", icon: Users },
    taak: { color: "#F97316", label: "Taak", icon: CheckSquare },
    blok: { color: "#9CA3AF", label: "Blok", icon: Lock },
};

// Working hours - extended range for display
const WORK_START = 7;  // 07:00
const WORK_END = 20;   // 20:00
const HOUR_HEIGHT = 60; // pixels per hour
const COLLAPSED_HEIGHT = 36; // height for collapsed hour sections

export default function Agenda() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();

    // State
    const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? "day" : "week");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);

    // Filters (persisted to localStorage)
    const [typeFilters, setTypeFilters] = useState<AppointmentType[]>(() => {
        const saved = localStorage.getItem("agenda-type-filters");
        return saved ? JSON.parse(saved) : ["afspraak", "intern", "taak", "blok"];
    });
    const [userFilter, setUserFilter] = useState<string>("all");
    const [showAllHours, setShowAllHours] = useState(false);

    // Ref for auto-scroll
    const timeGridRef = useRef<HTMLDivElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        type: "afspraak" as AppointmentType,
        startDate: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endDate: format(new Date(), "yyyy-MM-dd"),
        endTime: "09:30",
        allDay: false,
        description: "",
        location: "",
        isRemote: false,
        meetingLink: "",
        recurrence: "none",
    });

    // Save filters to localStorage
    useEffect(() => {
        localStorage.setItem("agenda-type-filters", JSON.stringify(typeFilters));
    }, [typeFilters]);

    // Calculate date range for API query
    const dateRange = useMemo(() => {
        let start: Date, end: Date;
        switch (viewMode) {
            case "month":
                start = startOfMonth(subMonths(currentDate, 1));
                end = endOfMonth(addMonths(currentDate, 1));
                break;
            case "week":
                start = startOfWeek(currentDate, { weekStartsOn: 1 });
                end = endOfWeek(currentDate, { weekStartsOn: 1 });
                break;
            case "day":
                start = currentDate;
                end = addDays(currentDate, 1);
                break;
            case "list":
                start = currentDate;
                end = addDays(currentDate, 14);
                break;
            default:
                start = currentDate;
                end = addDays(currentDate, 7);
        }
        return { timeMin: start.toISOString(), timeMax: end.toISOString() };
    }, [currentDate, viewMode]);

    // Fetch appointments
    const { data: appointmentsData, isLoading } = useQuery<{ events: Appointment[] }>({
        queryKey: ["/api/appointments", dateRange.timeMin, dateRange.timeMax, userFilter],
        queryFn: async () => {
            const params = new URLSearchParams({
                timeMin: dateRange.timeMin,
                timeMax: dateRange.timeMax,
            });
            if (userFilter !== "all") {
                params.set("userId", userFilter);
            }
            const res = await fetch(`/api/appointments?${params}`);
            if (!res.ok) throw new Error("Failed to fetch appointments");
            return res.json();
        },
    });

    // Fetch users for filter
    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/users/list"],
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create appointment");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            setIsCreateOpen(false);
            resetForm();
            toast({ title: "Afspraak aangemaakt" });
        },
        onError: () => {
            toast({ title: "Fout bij aanmaken", variant: "destructive" });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data, scope }: { id: string; data: any; scope?: string }) => {
            const res = await fetch(`/api/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data, scope }),
            });
            if (!res.ok) throw new Error("Failed to update appointment");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            setIsDetailOpen(false);
            setIsEditMode(false);
            toast({ title: "Afspraak bijgewerkt" });
        },
        onError: () => {
            toast({ title: "Fout bij bijwerken", variant: "destructive" });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async ({ id, scope, originalStart }: { id: string; scope?: string; originalStart?: string }) => {
            const params = new URLSearchParams();
            if (scope) params.set("scope", scope);
            if (originalStart) params.set("originalStart", originalStart);
            const res = await fetch(`/api/appointments/${id}?${params}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete appointment");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            setIsDetailOpen(false);
            toast({ title: "Afspraak verwijderd" });
        },
        onError: () => {
            toast({ title: "Fout bij verwijderen", variant: "destructive" });
        },
    });

    // Filter appointments by type
    const appointments = useMemo(() => {
        const events = appointmentsData?.events || [];
        return events.filter(apt => typeFilters.includes(apt.type));
    }, [appointmentsData, typeFilters]);

    // Navigation
    const goToToday = () => setCurrentDate(new Date());
    const goPrev = () => {
        switch (viewMode) {
            case "month": setCurrentDate(subMonths(currentDate, 1)); break;
            case "week": setCurrentDate(subDays(currentDate, 7)); break;
            case "day": setCurrentDate(subDays(currentDate, 1)); break;
            case "list": setCurrentDate(subDays(currentDate, 7)); break;
        }
    };
    const goNext = () => {
        switch (viewMode) {
            case "month": setCurrentDate(addMonths(currentDate, 1)); break;
            case "week": setCurrentDate(addDays(currentDate, 7)); break;
            case "day": setCurrentDate(addDays(currentDate, 1)); break;
            case "list": setCurrentDate(addDays(currentDate, 7)); break;
        }
    };

    // Form helpers
    const resetForm = () => {
        setFormData({
            title: "",
            type: "afspraak",
            startDate: format(new Date(), "yyyy-MM-dd"),
            startTime: "09:00",
            endDate: format(new Date(), "yyyy-MM-dd"),
            endTime: "09:30",
            allDay: false,
            description: "",
            location: "",
            isRemote: false,
            meetingLink: "",
            recurrence: "none",
        });
    };

    const handleCreate = () => {
        const startTime = formData.allDay
            ? new Date(`${formData.startDate}T00:00:00`)
            : new Date(`${formData.startDate}T${formData.startTime}:00`);
        const endTime = formData.allDay
            ? new Date(`${formData.endDate || formData.startDate}T23:59:59`)
            : new Date(`${formData.endDate || formData.startDate}T${formData.endTime}:00`);

        // Validation: Check if start time is in the past (with 5 min buffer)
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        if (startTime < fiveMinutesAgo) {
            toast({
                title: "Ongeldige datum",
                description: "Je kunt geen afspraken in het verleden aanmaken of wijzigen.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if end time is after start time
        if (endTime <= startTime) {
            toast({
                title: "Ongeldige tijden",
                description: "De eindtijd moet na de starttijd liggen.",
                variant: "destructive"
            });
            return;
        }

        const appointmentData = {
            title: formData.title,
            type: formData.type,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            allDay: formData.allDay,
            description: formData.description || null,
            location: formData.location || null,
            isRemote: formData.isRemote,
            meetingLink: formData.meetingLink || null,
            recurrenceRule: formData.recurrence !== "none" ? formData.recurrence : null,
        };

        // If editing an existing appointment, update it instead of creating new
        if (selectedAppointment) {
            updateMutation.mutate({
                id: selectedAppointment.seriesId,
                data: appointmentData,
                scope: selectedAppointment.isRecurring ? "all" : undefined,
            });
            setSelectedAppointment(null);
            setIsCreateOpen(false);
        } else {
            createMutation.mutate(appointmentData);
        }
    };

    const openCreateModal = (date?: Date, hour?: number) => {
        if (date) {
            setFormData(prev => ({
                ...prev,
                startDate: format(date, "yyyy-MM-dd"),
                endDate: format(date, "yyyy-MM-dd"),
                startTime: hour ? `${hour.toString().padStart(2, "0")}:00` : "09:00",
                endTime: hour ? `${(hour + 1).toString().padStart(2, "0")}:00` : "09:30",
            }));
        }
        setIsCreateOpen(true);
    };

    const handleAppointmentClick = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsDetailOpen(true);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case "n": openCreateModal(); break;
                case "t": goToToday(); break;
                case "1": setViewMode("month"); break;
                case "2": setViewMode("week"); break;
                case "3": setViewMode("day"); break;
                case "4": setViewMode("list"); break;
                case "p":
                case "arrowleft": goPrev(); break;
                case "arrowright": goNext(); break;
                case "escape":
                    setIsCreateOpen(false);
                    setIsDetailOpen(false);
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [viewMode, currentDate]);

    // Get header text - compact format on mobile
    const headerText = useMemo(() => {
        if (isMobile) {
            switch (viewMode) {
                case "month": return format(currentDate, "MMM yyyy", { locale: nl });
                case "day": return format(currentDate, "EEE d MMM", { locale: nl });
                case "list": return format(currentDate, "d MMM", { locale: nl }) + " →";
                default: return format(currentDate, "d MMM", { locale: nl });
            }
        }
        switch (viewMode) {
            case "month": return format(currentDate, "MMMM yyyy", { locale: nl });
            case "week":
                const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
                return `${format(weekStart, "d MMM", { locale: nl })} - ${format(weekEnd, "d MMM yyyy", { locale: nl })}`;
            case "day": return format(currentDate, "EEEE d MMMM yyyy", { locale: nl });
            case "list": return `${format(currentDate, "d MMM", { locale: nl })} - ${format(addDays(currentDate, 14), "d MMM yyyy", { locale: nl })}`;
            default: return "";
        }
    }, [currentDate, viewMode, isMobile]);

    // Render event card with context menu
    const renderEventCard = (apt: Appointment, compact = false) => {
        const config = TYPE_CONFIG[apt.type];
        const IconComponent = config.icon;

        const handleEdit = (e: React.MouseEvent) => {
            e.stopPropagation();
            // Fill form with appointment data for editing
            setFormData({
                title: apt.title,
                type: apt.type,
                startDate: format(parseISO(apt.startTime), "yyyy-MM-dd"),
                startTime: format(parseISO(apt.startTime), "HH:mm"),
                endDate: format(parseISO(apt.endTime), "yyyy-MM-dd"),
                endTime: format(parseISO(apt.endTime), "HH:mm"),
                allDay: apt.allDay || false,
                description: apt.description || "",
                location: apt.location || "",
                isRemote: apt.isRemote || false,
                meetingLink: apt.meetingLink || "",
                recurrence: apt.recurrenceRule || "none",
            });
            setSelectedAppointment(apt);
            setIsEditMode(true);
            setIsDetailOpen(true);
        };

        const handleDelete = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (confirm("Weet je zeker dat je deze afspraak wilt verwijderen?")) {
                deleteMutation.mutate({ id: apt.id, scope: "all" });
            }
        };

        // Block events don't have context menu
        if (apt.type === "blok") {
            return (
                <div
                    key={apt.id}
                    className="px-2 py-1 rounded text-xs opacity-60 cursor-default"
                    style={{ backgroundColor: `${config.color}20` }}
                >
                    <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span className="truncate">{apt.title}</span>
                    </div>
                </div>
            );
        }

        // Task events with context menu
        if (apt.type === "taak") {
            return (
                <ContextMenu key={apt.id}>
                    <ContextMenuTrigger asChild>
                        <div
                            onClick={() => handleAppointmentClick(apt)}
                            className="px-2 py-1 rounded text-xs cursor-pointer border border-dashed border-orange-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-orange-500" />
                                <span className="truncate">{apt.title}</span>
                            </div>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                        <ContextMenuItem onClick={handleEdit}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Wijzigen
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Verwijderen
                        </ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            );
        }

        // Regular appointments with context menu
        return (
            <ContextMenu key={apt.id}>
                <ContextMenuTrigger asChild>
                    <div
                        onClick={() => handleAppointmentClick(apt)}
                        className="px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity border-l-2"
                        style={{
                            borderLeftColor: config.color,
                            backgroundColor: `${config.color}15`,
                        }}
                    >
                        <div className="font-medium truncate">{apt.title}</div>
                        {!compact && (
                            <div className="text-muted-foreground text-[10px]">
                                {format(parseISO(apt.startTime), "HH:mm")} - {format(parseISO(apt.endTime), "HH:mm")}
                            </div>
                        )}
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={handleEdit}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Wijzigen
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Verwijderen
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        );
    };

    // Auto-scroll to working hours on mount
    useEffect(() => {
        if (timeGridRef.current && (viewMode === "week" || viewMode === "day")) {
            // Scroll to current time if today, otherwise scroll to start of working hours
            const now = new Date();
            const scrollToHour = isToday(currentDate) ? Math.max(now.getHours() - 1, WORK_START) : WORK_START;
            const scrollPosition = showAllHours
                ? scrollToHour * HOUR_HEIGHT
                : (scrollToHour >= WORK_START ? COLLAPSED_HEIGHT + (scrollToHour - WORK_START) * HOUR_HEIGHT : 0);

            setTimeout(() => {
                timeGridRef.current?.scrollTo({ top: scrollPosition, behavior: "smooth" });
            }, 100);
        }
    }, [viewMode, currentDate, showAllHours]);

    // Helper to calculate Y position accounting for collapsed hours
    const getYPosition = (hour: number, minutes: number = 0): number => {
        if (showAllHours) {
            return (hour + minutes / 60) * HOUR_HEIGHT;
        }

        // Before working hours
        if (hour < WORK_START) {
            return (hour / WORK_START) * COLLAPSED_HEIGHT;
        }
        // During working hours
        if (hour < WORK_END) {
            return COLLAPSED_HEIGHT + (hour - WORK_START + minutes / 60) * HOUR_HEIGHT;
        }
        // After working hours
        const afterWorkHours = 24 - WORK_END;
        return COLLAPSED_HEIGHT + (WORK_END - WORK_START) * HOUR_HEIGHT + ((hour - WORK_END) / afterWorkHours) * COLLAPSED_HEIGHT;
    };

    // Calculate total height of the time grid
    const getTotalGridHeight = (): number => {
        if (showAllHours) {
            return 24 * HOUR_HEIGHT;
        }
        return COLLAPSED_HEIGHT + (WORK_END - WORK_START) * HOUR_HEIGHT + COLLAPSED_HEIGHT;
    };

    // Week/Day time grid
    const renderTimeGrid = (days: Date[]) => {
        const workingHours = Array.from({ length: WORK_END - WORK_START }, (_, i) => i + WORK_START);
        const beforeWorkHours = Array.from({ length: WORK_START }, (_, i) => i);
        const afterWorkHours = Array.from({ length: 24 - WORK_END }, (_, i) => i + WORK_END);

        const totalHeight = getTotalGridHeight();

        return (
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Toggle button for full day view */}
                <div className="flex items-center justify-end px-2 py-1 border-b bg-muted/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setShowAllHours(!showAllHours)}
                    >
                        {showAllHours ? "Toon werkuren" : "Toon alle uren"}
                    </Button>
                </div>

                <div ref={timeGridRef} className="flex flex-1 overflow-auto">
                    {/* Time labels */}
                    <div className="w-16 flex-shrink-0 border-r" style={{ height: `${totalHeight}px` }}>
                        {showAllHours ? (
                            // All hours
                            Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                <div
                                    key={hour}
                                    className="h-[60px] text-xs text-muted-foreground pr-2 text-right flex items-start justify-end"
                                >
                                    {hour.toString().padStart(2, "0")}:00
                                </div>
                            ))
                        ) : (
                            <>
                                {/* Collapsed before work */}
                                <div
                                    className="text-xs font-medium text-muted-foreground px-3 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 border-b-2 border-dashed cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    style={{ height: `${COLLAPSED_HEIGHT}px` }}
                                    onClick={() => setShowAllHours(true)}
                                    title="Klik om nachturen te tonen"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                    <span>🌙 Nacht (00:00 - 07:00)</span>
                                </div>

                                {/* Working hours */}
                                {workingHours.map(hour => (
                                    <div
                                        key={hour}
                                        className="h-[60px] text-xs text-muted-foreground pr-2 text-right flex items-start justify-end"
                                    >
                                        {hour.toString().padStart(2, "0")}:00
                                    </div>
                                ))}

                                {/* Collapsed after work */}
                                <div
                                    className="text-xs font-medium text-muted-foreground px-3 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 border-t-2 border-dashed cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    style={{ height: `${COLLAPSED_HEIGHT}px` }}
                                    onClick={() => setShowAllHours(true)}
                                    title="Klik om avonduren te tonen"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                    <span>🌃 Avond (20:00 - 24:00)</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Day columns */}
                    <div className="flex flex-1">
                        {days.map(day => (
                            <div
                                key={day.toISOString()}
                                className="flex-1 border-r relative"
                                style={{ height: `${totalHeight}px` }}
                            >
                                {showAllHours ? (
                                    // Full 24-hour view
                                    <>
                                        {/* Working hours highlight */}
                                        <div
                                            className="absolute inset-x-0 bg-blue-50/30 dark:bg-blue-950/20 pointer-events-none"
                                            style={{
                                                top: `${WORK_START * HOUR_HEIGHT}px`,
                                                height: `${(WORK_END - WORK_START) * HOUR_HEIGHT}px`,
                                            }}
                                        />
                                        {/* Hour lines */}
                                        {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                            <div
                                                key={hour}
                                                className="h-[60px] border-b border-dashed border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
                                                onClick={() => openCreateModal(day, hour)}
                                            />
                                        ))}
                                    </>
                                ) : (
                                    // Compact view with collapsed sections
                                    <>
                                        {/* Collapsed before work */}
                                        <div
                                            className="bg-gray-100/50 dark:bg-gray-800/50 border-b flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                            style={{ height: `${COLLAPSED_HEIGHT}px` }}
                                            onClick={() => setShowAllHours(true)}
                                        >
                                            ···
                                        </div>

                                        {/* Working hours */}
                                        {workingHours.map(hour => (
                                            <div
                                                key={hour}
                                                className="h-[60px] border-b border-dashed border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
                                                onClick={() => openCreateModal(day, hour)}
                                            />
                                        ))}

                                        {/* Collapsed after work */}
                                        <div
                                            className="bg-gray-100/50 dark:bg-gray-800/50 border-t flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                            style={{ height: `${COLLAPSED_HEIGHT}px` }}
                                            onClick={() => setShowAllHours(true)}
                                        >
                                            ···
                                        </div>
                                    </>
                                )}

                                {/* Now line */}
                                {isToday(day) && (
                                    <div
                                        className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none"
                                        style={{
                                            top: `${getYPosition(new Date().getHours(), new Date().getMinutes())}px`,
                                        }}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-red-500 -mt-1 -ml-1" />
                                    </div>
                                )}

                                {/* Events */}
                                {appointments
                                    .filter(apt => {
                                        // Check if this day falls within the event's date range
                                        const aptStart = startOfDay(parseISO(apt.startTime));
                                        const aptEnd = startOfDay(parseISO(apt.endTime));
                                        const dayStart = startOfDay(day);
                                        return dayStart >= aptStart && dayStart <= aptEnd;
                                    })
                                    .map(apt => {
                                        const start = parseISO(apt.startTime);
                                        const end = parseISO(apt.endTime);
                                        const aptStartDay = startOfDay(start);
                                        const aptEndDay = startOfDay(end);
                                        const dayStart = startOfDay(day);

                                        // Check if this is a multi-day event
                                        const isMultiDay = differenceInDays(aptEndDay, aptStartDay) >= 1;
                                        const isFirstDay = isSameDay(dayStart, aptStartDay);
                                        const isLastDay = isSameDay(dayStart, aptEndDay);

                                        // For multi-day events, calculate effective start/end for this day
                                        let effectiveStartHour, effectiveStartMinutes, effectiveEndHour, effectiveEndMinutes;

                                        if (isMultiDay) {
                                            if (isFirstDay) {
                                                effectiveStartHour = start.getHours();
                                                effectiveStartMinutes = start.getMinutes();
                                                effectiveEndHour = 23;
                                                effectiveEndMinutes = 59;
                                            } else if (isLastDay) {
                                                effectiveStartHour = 0;
                                                effectiveStartMinutes = 0;
                                                effectiveEndHour = end.getHours();
                                                effectiveEndMinutes = end.getMinutes();
                                            } else {
                                                // Middle day - full day
                                                effectiveStartHour = 0;
                                                effectiveStartMinutes = 0;
                                                effectiveEndHour = 23;
                                                effectiveEndMinutes = 59;
                                            }
                                        } else {
                                            effectiveStartHour = start.getHours();
                                            effectiveStartMinutes = start.getMinutes();
                                            effectiveEndHour = end.getHours();
                                            effectiveEndMinutes = end.getMinutes();
                                        }

                                        const duration = (effectiveEndHour * 60 + effectiveEndMinutes) - (effectiveStartHour * 60 + effectiveStartMinutes);
                                        const config = TYPE_CONFIG[apt.type];

                                        // Skip events outside working hours when collapsed (unless showAllHours)
                                        if (!showAllHours && (effectiveStartHour >= WORK_END || effectiveEndHour < WORK_START)) {
                                            return null;
                                        }

                                        const topPosition = getYPosition(effectiveStartHour, effectiveStartMinutes);
                                        const endPosition = getYPosition(effectiveEndHour, effectiveEndMinutes);
                                        const height = Math.max(endPosition - topPosition, 20);

                                        const handleEditEvent = () => {
                                            setFormData({
                                                title: apt.title,
                                                type: apt.type,
                                                startDate: format(parseISO(apt.startTime), "yyyy-MM-dd"),
                                                startTime: format(parseISO(apt.startTime), "HH:mm"),
                                                endDate: format(parseISO(apt.endTime), "yyyy-MM-dd"),
                                                endTime: format(parseISO(apt.endTime), "HH:mm"),
                                                allDay: apt.allDay || false,
                                                description: apt.description || "",
                                                location: apt.location || "",
                                                isRemote: apt.isRemote || false,
                                                meetingLink: apt.meetingLink || "",
                                                recurrence: apt.recurrenceRule || "none",
                                            });
                                            setSelectedAppointment(apt);
                                            setIsCreateOpen(true); // Go directly to edit form
                                        };

                                        const handleDeleteEvent = () => {
                                            setAppointmentToDelete(apt);
                                            setDeleteConfirmOpen(true);
                                        };

                                        return (
                                            <ContextMenu key={`${apt.id}-${day.toISOString()}`}>
                                                <ContextMenuTrigger asChild>
                                                    <div
                                                        onClick={() => handleAppointmentClick(apt)}
                                                        className="absolute left-1 right-1 rounded px-1 py-0.5 text-xs cursor-pointer overflow-hidden hover:opacity-90"
                                                        style={{
                                                            top: `${topPosition}px`,
                                                            height: `${height}px`,
                                                            backgroundColor: `${config.color}20`,
                                                            borderLeft: `3px solid ${config.color}`,
                                                            // Shorter events get higher z-index so they're clickable above longer events
                                                            // Keep max at 30 so dialogs (z-50) appear above
                                                            zIndex: Math.max(1, 30 - Math.floor(height / 20)),
                                                        }}
                                                    >
                                                        <div className="font-medium truncate text-[11px]">
                                                            {isMultiDay && !isFirstDay ? "↳ " : ""}{apt.title}
                                                        </div>
                                                        {duration >= 45 && (
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {isMultiDay ? (
                                                                    isFirstDay ? `${format(start, "HH:mm")} →` :
                                                                        isLastDay ? `→ ${format(end, "HH:mm")}` :
                                                                            "Hele dag"
                                                                ) : (
                                                                    `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </ContextMenuTrigger>
                                                <ContextMenuContent className="z-[200]">
                                                    <ContextMenuItem onClick={handleEditEvent}>
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Wijzigen
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem onClick={handleDeleteEvent} className="text-red-600 focus:text-red-600">
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Verwijderen
                                                    </ContextMenuItem>
                                                </ContextMenuContent>
                                            </ContextMenu>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // Month view
    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const weeks = [];

        for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7));
        }

        return (
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="grid grid-cols-7 border-b">
                    {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map(day => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                <div className="flex-1 grid grid-rows-6">
                    {weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="grid grid-cols-7 border-b">
                            {week.map(day => {
                                const dayAppts = appointments.filter(apt =>
                                    isSameDay(parseISO(apt.startTime), day)
                                );
                                const inMonth = isSameMonth(day, currentDate);

                                return (
                                    <div
                                        key={day.toISOString()}
                                        className={`p-1 border-r min-h-[80px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 ${!inMonth ? "opacity-40" : ""
                                            } ${isToday(day) ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                                        onClick={() => {
                                            setCurrentDate(day);
                                            setViewMode("day");
                                        }}
                                    >
                                        <div className={`text-sm mb-1 ${isToday(day) ? "font-bold text-blue-600" : ""}`}>
                                            {format(day, "d")}
                                        </div>
                                        <div className="space-y-0.5">
                                            {dayAppts.slice(0, 3).map(apt => renderEventCard(apt, true))}
                                            {dayAppts.length > 3 && (
                                                <div className="text-xs text-muted-foreground">
                                                    +{dayAppts.length - 3} meer
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Week view
    const renderWeekView = () => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Day headers */}
                <div className="flex border-b pl-16">
                    {days.map(day => (
                        <div
                            key={day.toISOString()}
                            className={`flex-1 p-2 text-center border-r ${isToday(day) ? "bg-blue-50 dark:bg-blue-950/30" : ""
                                }`}
                        >
                            <div className="text-xs text-muted-foreground">
                                {format(day, "EEE", { locale: nl })}
                            </div>
                            <div className={`text-lg ${isToday(day) ? "font-bold text-blue-600" : ""}`}>
                                {format(day, "d")}
                            </div>
                        </div>
                    ))}
                </div>

                {renderTimeGrid(days)}
            </div>
        );
    };

    // Day view
    const renderDayView = () => {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {renderTimeGrid([currentDate])}
            </div>
        );
    };

    // List view
    const renderListView = () => {
        const days = eachDayOfInterval({
            start: currentDate,
            end: addDays(currentDate, 13),
        });

        const groupedAppts = days.map(day => ({
            date: day,
            appointments: appointments.filter(apt =>
                isSameDay(parseISO(apt.startTime), day)
            ),
        }));

        return (
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {groupedAppts.map(({ date, appointments: dayAppts }) => (
                    <div key={date.toISOString()}>
                        <div
                            className={`text-sm font-medium mb-2 ${isToday(date) ? "text-blue-600" : "text-muted-foreground"
                                }`}
                        >
                            {format(date, "EEEE d MMMM", { locale: nl })}
                            {isToday(date) && <Badge variant="secondary" className="ml-2">Vandaag</Badge>}
                        </div>
                        {dayAppts.length === 0 ? (
                            <div className="text-sm text-muted-foreground pl-4">Geen afspraken</div>
                        ) : (
                            <div className="space-y-2 pl-4">
                                {dayAppts.map(apt => (
                                    <Card
                                        key={apt.id}
                                        className="cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => handleAppointmentClick(apt)}
                                    >
                                        <CardContent className="p-3 flex items-center gap-3">
                                            <div
                                                className="w-1 h-10 rounded-full"
                                                style={{ backgroundColor: TYPE_CONFIG[apt.type].color }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{apt.title}</div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    {format(parseISO(apt.startTime), "HH:mm")} -{" "}
                                                    {format(parseISO(apt.endTime), "HH:mm")}
                                                    {apt.location && (
                                                        <>
                                                            <MapPin className="w-3 h-3 ml-2" />
                                                            <span className="truncate">{apt.location}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                style={{ backgroundColor: `${TYPE_CONFIG[apt.type].color}20` }}
                                            >
                                                {TYPE_CONFIG[apt.type].label}
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // Create/Edit form modal content - use as JSX variable, not component
    const formContent = (
        <div className="space-y-4">
            <div>
                <Label htmlFor="title">Titel</Label>
                <Input
                    id="title"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Afspraak titel..."
                />
            </div>

            <div>
                <Label>Type</Label>
                <Select
                    value={formData.type}
                    onValueChange={v => setFormData(prev => ({ ...prev, type: v as AppointmentType }))}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(TYPE_CONFIG).map(([key, { label, color }]) => (
                            <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                    {label}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <Checkbox
                    id="allDay"
                    checked={formData.allDay}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, allDay: !!checked }))}
                />
                <Label htmlFor="allDay">Hele dag</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Start datum</Label>
                    <Input
                        type="date"
                        value={formData.startDate}
                        onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                </div>
                {!formData.allDay && (
                    <div>
                        <Label>Start tijd</Label>
                        <Input
                            type="time"
                            value={formData.startTime}
                            onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Eind datum</Label>
                    <Input
                        type="date"
                        value={formData.endDate}
                        onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                </div>
                {!formData.allDay && (
                    <div>
                        <Label>Eind tijd</Label>
                        <Input
                            type="time"
                            value={formData.endTime}
                            onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        />
                    </div>
                )}
            </div>

            <div>
                <Label>Locatie</Label>
                <Input
                    value={formData.location}
                    onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Locatie (optioneel)"
                />
            </div>

            <div>
                <Label>Omschrijving</Label>
                <Textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Notities..."
                    rows={3}
                />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navigation />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header - Responsive */}
                <header className="border-b bg-card">
                    {/* Mobile: Stacked layout */}
                    <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
                        {/* Left: Navigation buttons */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* Nieuw button - hidden on mobile (use FAB instead) */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCreateModal()}
                                className="hidden sm:flex"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Nieuw
                            </Button>

                            <div className="flex items-center border rounded-md">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                                    onClick={goToToday}
                                >
                                    {isMobile ? "Nu" : "Vandaag"}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Center: Date with navigation - only on desktop */}
                        <div className="hidden sm:flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="font-semibold capitalize text-sm md:text-base min-w-[180px] text-center">
                                {headerText}
                            </span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Right: View toggle and export */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* View mode toggles */}
                            <div className="flex border rounded-md overflow-hidden">
                                {[
                                    { mode: "month" as const, label: "M" },
                                    { mode: "week" as const, label: "W", hideOnMobile: true },
                                    { mode: "day" as const, label: "D" },
                                    { mode: "list" as const, label: <List className="w-3 h-3 sm:w-4 sm:h-4" /> },
                                ].filter(item => !isMobile || !item.hideOnMobile).map(({ mode, label }) => (
                                    <Button
                                        key={mode}
                                        variant={viewMode === mode ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-7 sm:h-8 px-2 sm:px-3 rounded-none text-xs sm:text-sm"
                                        onClick={() => setViewMode(mode)}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>

                            {/* Export button - hidden on mobile */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            window.open(`/api/appointments/export.ics?userId=${user?.id}`, "_blank");
                                        }}
                                    >
                                        Exporteer als iCal
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Mobile: Date row */}
                    {isMobile && (
                        <div className="px-3 pb-2 text-center">
                            <span className="font-semibold text-sm capitalize">{headerText}</span>
                        </div>
                    )}
                </header>

                {/* Main content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar - Hidden on mobile */}
                    {!isMobile && (
                        <aside className="w-80 border-r p-4 space-y-4 overflow-auto bg-card flex-shrink-0">
                            {/* Mini calendar */}
                            <div className="flex justify-center">
                                <Calendar
                                    mode="single"
                                    selected={currentDate}
                                    onSelect={date => date && setCurrentDate(date)}
                                    className="rounded-md border"
                                    locale={nl}
                                />
                            </div>

                            {/* Type filters */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium">Types</h4>
                                {Object.entries(TYPE_CONFIG).map(([key, { label, color }]) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`filter-${key}`}
                                            checked={typeFilters.includes(key as AppointmentType)}
                                            onCheckedChange={checked => {
                                                setTypeFilters(prev =>
                                                    checked
                                                        ? [...prev, key as AppointmentType]
                                                        : prev.filter(t => t !== key)
                                                );
                                            }}
                                        />
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: color }}
                                        />
                                        <Label htmlFor={`filter-${key}`} className="text-sm cursor-pointer">
                                            {label}
                                        </Label>
                                    </div>
                                ))}
                            </div>

                            {/* User filter */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium">Medewerker</h4>
                                <Select value={userFilter} onValueChange={setUserFilter}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Alle medewerkers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle medewerkers</SelectItem>
                                        {users?.map(u => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.firstName} {u.lastName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </aside>
                    )}

                    {/* Calendar view */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-background">
                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                            </div>
                        ) : (
                            <>
                                {viewMode === "month" && renderMonthView()}
                                {viewMode === "week" && renderWeekView()}
                                {viewMode === "day" && renderDayView()}
                                {viewMode === "list" && renderListView()}
                            </>
                        )}
                    </div>
                </div>

                {/* Mobile floating button */}
                {isMobile && (
                    <Button
                        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
                        onClick={() => openCreateModal()}
                    >
                        <Plus className="w-6 h-6" />
                    </Button>
                )}
            </main>

            {/* Create/Edit modal - Desktop */}
            {!isMobile && (
                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) setSelectedAppointment(null);
                }}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{selectedAppointment ? "Afspraak bewerken" : "Nieuwe afspraak"}</DialogTitle>
                        </DialogHeader>
                        {formContent}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => {
                                setIsCreateOpen(false);
                                setSelectedAppointment(null);
                            }}>
                                Annuleren
                            </Button>
                            <Button onClick={handleCreate} disabled={!formData.title || createMutation.isPending || updateMutation.isPending}>
                                {(createMutation.isPending || updateMutation.isPending)
                                    ? (selectedAppointment ? "Opslaan..." : "Aanmaken...")
                                    : (selectedAppointment ? "Opslaan" : "Aanmaken")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Create/Edit drawer - Mobile */}
            {isMobile && (
                <Drawer open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) setSelectedAppointment(null);
                }}>
                    <DrawerContent>
                        <DrawerHeader>
                            <DrawerTitle>{selectedAppointment ? "Afspraak bewerken" : "Nieuwe afspraak"}</DrawerTitle>
                        </DrawerHeader>
                        <div className="px-4 pb-4 max-h-[70vh] overflow-auto">
                            {formContent}
                        </div>
                        <DrawerFooter className="border-t pt-4">
                            <Button onClick={handleCreate} disabled={!formData.title || createMutation.isPending || updateMutation.isPending}>
                                {(createMutation.isPending || updateMutation.isPending)
                                    ? (selectedAppointment ? "Opslaan..." : "Aanmaken...")
                                    : (selectedAppointment ? "Opslaan" : "Aanmaken")}
                            </Button>
                            <Button variant="outline" onClick={() => {
                                setIsCreateOpen(false);
                                setSelectedAppointment(null);
                            }}>
                                Annuleren
                            </Button>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            )}

            {/* Detail modal */}
            {selectedAppointment && (
                <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: TYPE_CONFIG[selectedAppointment.type].color }}
                                />
                                <span className="truncate">{selectedAppointment.title}</span>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="flex items-center gap-3 text-sm">
                                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span>
                                    {format(parseISO(selectedAppointment.startTime), "EEEE d MMMM yyyy", { locale: nl })}
                                    <br />
                                    {format(parseISO(selectedAppointment.startTime), "HH:mm")} -{" "}
                                    {format(parseISO(selectedAppointment.endTime), "HH:mm")}
                                </span>
                            </div>

                            {selectedAppointment.location && (
                                <div className="flex items-center gap-3 text-sm">
                                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <span>{selectedAppointment.location}</span>
                                </div>
                            )}

                            {selectedAppointment.description && (
                                <div className="text-sm text-muted-foreground pl-7">
                                    {selectedAppointment.description}
                                </div>
                            )}

                            {selectedAppointment.isRecurring && (
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <Repeat className="w-4 h-4 flex-shrink-0" />
                                    <span>Herhalende afspraak</span>
                                </div>
                            )}

                            <Badge style={{ backgroundColor: `${TYPE_CONFIG[selectedAppointment.type].color}20` }}>
                                {TYPE_CONFIG[selectedAppointment.type].label}
                            </Badge>
                        </div>

                        <DialogFooter className="flex-row gap-2 sm:gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-none"
                                onClick={() => {
                                    // Fill form with appointment data
                                    setFormData({
                                        title: selectedAppointment.title,
                                        type: selectedAppointment.type,
                                        startDate: format(parseISO(selectedAppointment.startTime), "yyyy-MM-dd"),
                                        startTime: format(parseISO(selectedAppointment.startTime), "HH:mm"),
                                        endDate: format(parseISO(selectedAppointment.endTime), "yyyy-MM-dd"),
                                        endTime: format(parseISO(selectedAppointment.endTime), "HH:mm"),
                                        allDay: selectedAppointment.allDay || false,
                                        description: selectedAppointment.description || "",
                                        location: selectedAppointment.location || "",
                                        isRemote: selectedAppointment.isRemote || false,
                                        meetingLink: selectedAppointment.meetingLink || "",
                                        recurrence: selectedAppointment.recurrenceRule || "none",
                                    });
                                    setIsDetailOpen(false);
                                    setIsCreateOpen(true);
                                }}
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                Wijzigen
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                className="flex-1 sm:flex-none"
                                onClick={() => {
                                    setAppointmentToDelete(selectedAppointment);
                                    setDeleteConfirmOpen(true);
                                }}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Verwijderen
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Afspraak verwijderen</AlertDialogTitle>
                        <AlertDialogDescription>
                            Weet je zeker dat je deze afspraak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                                if (appointmentToDelete) {
                                    // For non-recurring appointments, don't send scope/originalStart
                                    // This ensures the backend deletes the entire series
                                    deleteMutation.mutate({
                                        id: appointmentToDelete.seriesId,
                                        scope: appointmentToDelete.isRecurring ? "single" : undefined,
                                        originalStart: appointmentToDelete.isRecurring ? appointmentToDelete.originalStart : undefined,
                                    });
                                    setIsDetailOpen(false);
                                    setDeleteConfirmOpen(false);
                                    setAppointmentToDelete(null);
                                }
                            }}
                        >
                            Verwijderen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
