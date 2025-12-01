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
import {
    Link,
    Plus,
    Package,
    Briefcase,
    Wrench,
    RotateCcw
} from "lucide-react";

interface EmailContextMenuProps {
    children: React.ReactNode;
    onCreateCase: () => void;
    onCreateReturn: () => void;
    onCreateRepair: () => void;
    onLinkOrder: () => void;
    onLinkCase: () => void;
    onLinkReturn: () => void;
    onLinkRepair: () => void;
}

export function EmailContextMenu({
    children,
    onCreateCase,
    onCreateReturn,
    onCreateRepair,
    onLinkOrder,
    onLinkCase,
    onLinkReturn,
    onLinkRepair,
}: EmailContextMenuProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                <ContextMenuSub>
                    <ContextMenuSubTrigger>
                        <Plus className="mr-2 h-4 w-4" />
                        Aanmaken
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={onCreateCase}>
                            <Briefcase className="mr-2 h-4 w-4" />
                            Nieuwe Case
                        </ContextMenuItem>
                        <ContextMenuItem onClick={onCreateReturn}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Nieuwe Retour
                        </ContextMenuItem>
                        <ContextMenuItem onClick={onCreateRepair}>
                            <Wrench className="mr-2 h-4 w-4" />
                            Nieuwe Reparatie
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

                <ContextMenuSeparator />

                <ContextMenuSub>
                    <ContextMenuSubTrigger>
                        <Link className="mr-2 h-4 w-4" />
                        Koppelen aan
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={onLinkOrder}>
                            <Package className="mr-2 h-4 w-4" />
                            Bestelling
                        </ContextMenuItem>
                        <ContextMenuItem onClick={onLinkCase}>
                            <Briefcase className="mr-2 h-4 w-4" />
                            Case
                        </ContextMenuItem>
                        <ContextMenuItem onClick={onLinkReturn}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Retour
                        </ContextMenuItem>
                        <ContextMenuItem onClick={onLinkRepair}>
                            <Wrench className="mr-2 h-4 w-4" />
                            Reparatie
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
            </ContextMenuContent>
        </ContextMenu>
    );
}
