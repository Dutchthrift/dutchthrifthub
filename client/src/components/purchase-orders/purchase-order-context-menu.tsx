import { ReactNode, MouseEvent } from "react";
import { Archive, Eye, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface PurchaseOrderContextMenuProps {
  children: ReactNode;
  purchaseOrderId: string;
  isArchived?: boolean;
  onOpen: (purchaseOrderId: string) => void;
  onArchive: (purchaseOrderId: string) => void;
  onUnarchive: (purchaseOrderId: string) => void;
  onDelete: (purchaseOrderId: string) => void;
}

export function PurchaseOrderContextMenu({ 
  children, 
  purchaseOrderId, 
  isArchived = false,
  onOpen, 
  onArchive, 
  onUnarchive,
  onDelete 
}: PurchaseOrderContextMenuProps) {
  const handleOpen = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen(purchaseOrderId);
  };

  const handleArchive = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isArchived) {
      onUnarchive(purchaseOrderId);
    } else {
      onArchive(purchaseOrderId);
    }
  };

  const handleDelete = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(purchaseOrderId);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56" data-testid={`context-menu-${purchaseOrderId}`}>
        <ContextMenuItem onClick={handleOpen} data-testid={`context-menu-open-${purchaseOrderId}`}>
          <Eye className="mr-2 h-4 w-4" />
          Open
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleArchive} data-testid={`context-menu-archive-${purchaseOrderId}`}>
          <Archive className="mr-2 h-4 w-4" />
          {isArchived ? "Unarchive" : "Archive"}
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem 
          onClick={handleDelete} 
          className="text-destructive focus:text-destructive"
          data-testid={`context-menu-delete-${purchaseOrderId}`}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
