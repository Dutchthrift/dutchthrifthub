import { ReactNode, MouseEvent } from "react";
import { Archive, Eye, Trash2, ListChecks } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface CaseContextMenuProps {
  children: ReactNode;
  caseId: string;
  currentStatus: string;
  isArchived?: boolean;
  onOpen: (caseId: string) => void;
  onArchive: (caseId: string) => void;
  onUnarchive: (caseId: string) => void;
  onDelete: (caseId: string) => void;
  onStatusChange: (caseId: string, newStatus: string) => void;
}

export function CaseContextMenu({ 
  children, 
  caseId, 
  currentStatus,
  isArchived = false,
  onOpen, 
  onArchive, 
  onUnarchive,
  onDelete,
  onStatusChange
}: CaseContextMenuProps) {
  const handleOpen = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen(caseId);
  };

  const handleArchive = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isArchived) {
      onUnarchive(caseId);
    } else {
      onArchive(caseId);
    }
  };

  const handleDelete = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(caseId);
  };

  const handleStatusChange = (newStatus: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStatusChange(caseId, newStatus);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56" data-testid={`context-menu-${caseId}`}>
        <ContextMenuItem onClick={handleOpen} data-testid={`context-menu-open-${caseId}`}>
          <Eye className="mr-2 h-4 w-4" />
          Open
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid={`context-menu-status-${caseId}`}>
            <ListChecks className="mr-2 h-4 w-4" />
            Wijzig Status
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem 
              onClick={handleStatusChange("new")}
              disabled={currentStatus === "new"}
              data-testid={`context-menu-status-new-${caseId}`}
            >
              Nieuw
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={handleStatusChange("in_progress")}
              disabled={currentStatus === "in_progress"}
              data-testid={`context-menu-status-in_progress-${caseId}`}
            >
              In Behandeling
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={handleStatusChange("waiting_customer")}
              disabled={currentStatus === "waiting_customer"}
              data-testid={`context-menu-status-waiting_customer-${caseId}`}
            >
              Wachtend op Klant
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={handleStatusChange("resolved")}
              disabled={currentStatus === "resolved"}
              data-testid={`context-menu-status-resolved-${caseId}`}
            >
              Opgelost
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleArchive} data-testid={`context-menu-archive-${caseId}`}>
          <Archive className="mr-2 h-4 w-4" />
          {isArchived ? "Unarchive" : "Archive"}
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem 
          onClick={handleDelete} 
          className="text-destructive focus:text-destructive"
          data-testid={`context-menu-delete-${caseId}`}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}