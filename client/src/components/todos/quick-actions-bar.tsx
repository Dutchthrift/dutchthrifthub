import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle,
    Clock,
    AlertCircle,
    User,
    Calendar,
    Flag,
} from "lucide-react";
import type { Todo, User as UserType } from "@/lib/types";

interface QuickActionsBarProps {
    todo: Todo;
    users: UserType[];
    onStatusChange: (status: string) => void;
    onPriorityChange: (priority: string) => void;
    onAssignUser: (userId: string | null) => void;
    onDueDateChange: (date: string | null) => void;
    isUpdating?: boolean;
}

export function QuickActionsBar({
    todo,
    users,
    onStatusChange,
    onPriorityChange,
    onAssignUser,
    onDueDateChange,
    isUpdating = false,
}: QuickActionsBarProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case "done":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "in_progress":
                return <Clock className="h-4 w-4 text-blue-500" />;
            default:
                return <AlertCircle className="h-4 w-4 text-amber-500" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "done":
                return "Afgerond";
            case "in_progress":
                return "Bezig";
            case "todo":
                return "Te Doen";
            default:
                return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "done":
                return "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20";
            case "in_progress":
                return "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20";
            case "todo":
                return "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20";
            default:
                return "";
        }
    };

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case "urgent":
                return "Urgent";
            case "high":
                return "Hoog";
            case "medium":
                return "Normaal";
            case "low":
                return "Laag";
            default:
                return priority;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "urgent":
                return "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20";
            case "high":
                return "bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20";
            case "medium":
                return "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20";
            case "low":
                return "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20";
            default:
                return "";
        }
    };

    const getAssignedUser = () => {
        if (!todo.assignedUserId) return null;
        return users.find((u) => u.id === todo.assignedUserId);
    };

    return (
        <div className="flex flex-wrap items-center gap-2" data-testid="quick-actions-bar">
            {/* Status Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        className={`${getStatusColor(todo.status || "todo")} border`}
                        data-testid="quick-status-button"
                    >
                        {getStatusIcon(todo.status || "todo")}
                        <span className="ml-1.5 text-xs font-medium">{getStatusLabel(todo.status || "todo")}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => onStatusChange("todo")} data-testid="status-todo">
                        <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                        Te Doen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange("in_progress")} data-testid="status-in-progress">
                        <Clock className="h-4 w-4 mr-2 text-blue-500" />
                        Bezig
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange("done")} data-testid="status-done">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        Afgerond
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        className={`${getPriorityColor(todo.priority || "medium")} border`}
                        data-testid="quick-priority-button"
                    >
                        <Flag className="h-4 w-4" />
                        <span className="ml-1.5 text-xs font-medium">{getPriorityLabel(todo.priority || "medium")}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => onPriorityChange("urgent")} data-testid="priority-urgent">
                        <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                        Urgent
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPriorityChange("high")} data-testid="priority-high">
                        <div className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                        Hoog
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPriorityChange("medium")} data-testid="priority-medium">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                        Normaal
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPriorityChange("low")} data-testid="priority-low">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                        Laag
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Assign User Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isUpdating} data-testid="quick-assign-button">
                        <User className="h-4 w-4" />
                        <span className="ml-1.5 text-xs">
                            {getAssignedUser()
                                ? `${getAssignedUser()?.firstName}`
                                : "Niemand"}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                    <DropdownMenuItem onClick={() => onAssignUser(null)} data-testid="assign-none">
                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                        Niemand
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {users.map((user) => (
                        <DropdownMenuItem
                            key={user.id}
                            onClick={() => onAssignUser(user.id)}
                            data-testid={`assign-${user.id}`}
                        >
                            <User className="h-4 w-4 mr-2" />
                            {user.firstName} {user.lastName}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Due Date */}
            <Button variant="outline" size="sm" disabled={isUpdating} data-testid="quick-due-date-button">
                <Calendar className="h-4 w-4" />
                <span className="ml-1.5 text-xs">
                    {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : "Geen deadline"}
                </span>
            </Button>
        </div>
    );
}
