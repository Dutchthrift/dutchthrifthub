import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";

interface LinkEntityDialogProps<T> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    searchPlaceholder?: string;
    onLink: (entity: T) => Promise<void>;
    searchFn: (query: string) => Promise<T[]>;
    renderItem: (entity: T, isSelected: boolean) => React.ReactNode;
}

export function LinkEntityDialog<T extends { id: string }>({
    open,
    onOpenChange,
    title,
    description,
    searchPlaceholder = "Zoeken...",
    onLink,
    searchFn,
    renderItem
}: LinkEntityDialogProps<T>) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEntity, setSelectedEntity] = useState<T | null>(null);
    const [isLinking, setIsLinking] = useState(false);

    const debouncedSearch = useDebounce(searchQuery, 300);

    const { data: results, isLoading } = useQuery({
        queryKey: ['search', title, debouncedSearch],
        queryFn: () => searchFn(debouncedSearch),
        enabled: open, // Always fetch when dialog is open
    });

    const handleLink = async () => {
        if (!selectedEntity) return;

        setIsLinking(true);
        try {
            await onLink(selectedEntity);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to link:", error);
        } finally {
            setIsLinking(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    <ScrollArea className="h-[300px] border rounded-md p-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : results && results.length > 0 ? (
                            <div className="space-y-2">
                                {results.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedEntity(item)}
                                        className={`cursor-pointer rounded-md border p-2 transition-colors hover:bg-accent ${selectedEntity?.id === item.id ? "bg-accent border-primary" : ""
                                            }`}
                                    >
                                        {renderItem(item, selectedEntity?.id === item.id)}
                                    </div>
                                ))}
                            </div>
                        ) : searchQuery.length > 1 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Geen resultaten gevonden
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Typ om te zoeken...
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Annuleren
                    </Button>
                    <Button onClick={handleLink} disabled={!selectedEntity || isLinking}>
                        {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Koppelen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
