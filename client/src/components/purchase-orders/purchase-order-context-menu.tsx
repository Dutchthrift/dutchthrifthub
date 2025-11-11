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

interface PurchaseOrderContextMenuProps {
  children: ReactNode;
  purchaseOrderId: string;
  currentStatus: string;
  isArchived?: boolean;
  onOpen: (purchaseOrderId: string) => void;
  onArchive: (purchaseOrderId: string) => void;
  onUnarchive: (purchaseOrderId: string) => void;
  onDelete: (purchaseOrderId: string) => void;
  onStatusChange: (purchaseOrderId: string, newStatus: string) => void;
}

export function PurchaseOrderContextMenu({ 
  children, 
  purchaseOrderId,
  currentStatus,
  isArchived = false,
  onOpen, 
  onArchive, 
  onUnarchive,
  onDelete,
  onStatusChange
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

  const handleStatusChange = (newStatus: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStatusChange(purchaseOrderId, newStatus);
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
        
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid={`context-menu-status-${purchaseOrderId}`}>
            <ListChecks className="mr-2 h-4 w-4" />
            Wijzig Status
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem 
              onClick={handleStatusChange("aangekocht")}
              disabled={currentStatus === "aangekocht"}
              data-testid={`context-menu-status-aangekocht-${purchaseOrderId}`}
            >
              Aangekocht
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={handleStatusChange("ontvangen")}
              disabled={currentStatus === "ontvangen"}
              data-testid={`context-menu-status-ontvangen-${purchaseOrderId}`}
            >
              Ontvangen
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={handleStatusChange("verwerkt")}
              disabled={currentStatus === "verwerkt"}
              data-testid={`context-menu-status-verwerkt-${purchaseOrderId}`}
            >
              Verwerkt
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
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
