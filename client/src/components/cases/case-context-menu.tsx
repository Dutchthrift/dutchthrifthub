import { ReactNode, MouseEvent } from "react";
import { Archive, Eye, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface CaseContextMenuProps {
  children: ReactNode;
  caseId: string;
  isArchived?: boolean;
  onOpen: (caseId: string) => void;
  onArchive: (caseId: string) => void;
  onUnarchive: (caseId: string) => void;
  onDelete: (caseId: string) => void;
}

export function CaseContextMenu({ 
  children, 
  caseId, 
  isArchived = false,
  onOpen, 
  onArchive, 
  onUnarchive,
  onDelete 
}: CaseContextMenuProps) {
  const handleOpen = (e: MouseEvent) => {
    e.preventDefault();
    onOpen(caseId);
  };

  const handleArchive = (e: MouseEvent) => {
    e.preventDefault();
    if (isArchived) {
      onUnarchive(caseId);
    } else {
      onArchive(caseId);
    }
  };

  const handleDelete = (e: MouseEvent) => {
    e.preventDefault();
    onDelete(caseId);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56" data-testid={`context-menu-${caseId}`}>
        <ContextMenuItem onClick={handleOpen} data-testid={`context-menu-open-${caseId}`}>
          <Eye className="mr-2 h-4 w-4" />
          Open
        </ContextMenuItem>
        
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