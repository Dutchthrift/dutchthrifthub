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
    MoreHorizontal,
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
                return <CheckCircle className="h-4 w-4" />;
            case "in_progress":
                return <Clock className="h-4 w-4" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "done":
                return "Done";
            case "in_progress":
                return "In Progress";
            case "todo":
                return "To Do";
            default:
                return status;
        }
    };

    const getPriorityLabel = (priority: string) => {
        return priority.charAt(0).toUpperCase() + priority.slice(1);
    };

    const getAssignedUser = () => {
        if (!todo.assignedUserId) return null;
        return users.find((u) => u.id === todo.assignedUserId);
    };

    return (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border" data-testid="quick-actions-bar">
            {/* Status Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isUpdating} data-testid="quick-status-button">
                        {getStatusIcon(todo.status || "todo")}
                        <span className="ml-2">{getStatusLabel(todo.status || "todo")}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => onStatusChange("todo")} data-testid="status-todo">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        To Do
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange("in_progress")} data-testid="status-in-progress">
                        <Clock className="h-4 w-4 mr-2" />
                        In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange("done")} data-testid="status-done">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Done
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isUpdating} data-testid="quick-priority-button">
                        <Flag className="h-4 w-4" />
                        <span className="ml-2">{getPriorityLabel(todo.priority || "medium")}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => onPriorityChange("urgent")} data-testid="priority-urgent">
                        <Badge variant="destructive" className="mr-2">Urgent</Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPriorityChange("high")} data-testid="priority-high">
                        <Badge variant="destructive" className="mr-2">High</Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPriorityChange("medium")} data-testid="priority-medium">
                        <Badge variant="secondary" className="mr-2">Medium</Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPriorityChange("low")} data-testid="priority-low">
                        <Badge variant="outline" className="mr-2">Low</Badge>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Assign User Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isUpdating} data-testid="quick-assign-button">
                        <User className="h-4 w-4" />
                        <span className="ml-2">
                            {getAssignedUser()
                                ? `${getAssignedUser()?.firstName} ${getAssignedUser()?.lastName}`
                                : "Unassigned"}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                    <DropdownMenuItem onClick={() => onAssignUser(null)} data-testid="assign-none">
                        <User className="h-4 w-4 mr-2" />
                        Unassigned
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
                <span className="ml-2">
                    {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : "No due date"}
                </span>
            </Button>

            {/* More Actions */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={isUpdating} data-testid="quick-more-button">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem data-testid="quick-clear-due-date" onClick={() => onDueDateChange(null)}>
                        Clear due date
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
