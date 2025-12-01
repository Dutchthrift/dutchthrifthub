import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Archive, ArchiveRestore } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";

interface ReturnQuickActionsProps {
    returnData: any;
    onUpdate: (data: any) => void;
    isUpdating: boolean;
}

const STATUS_OPTIONS = [
    { value: "nieuw_onderweg", label: "Nieuw/Onderweg" },
    { value: "ontvangen_controle", label: "Ontvangen - Controle" },
    { value: "akkoord_terugbetaling", label: "Akkoord - Terugbetaling" },
    { value: "vermiste_pakketten", label: "Vermiste Pakketten" },
    { value: "wachten_klant", label: "Wachten op Klant" },
    { value: "opnieuw_versturen", label: "Opnieuw Versturen" },
    { value: "klaar", label: "Klaar" },
    { value: "niet_ontvangen", label: "Niet Ontvangen" },
];

const PRIORITY_OPTIONS = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
];

export function ReturnQuickActions({ returnData, onUpdate, isUpdating }: ReturnQuickActionsProps) {
    const [userSearchOpen, setUserSearchOpen] = useState(false);

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ["/api/users"],
    });

    const assignedUser = users.find((u) => u.id === returnData.assignedUserId);

    return (
        <Card className="mb-6">
            <CardContent className="pt-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        <Select
                            value={returnData.status}
                            onValueChange={(value) => onUpdate({ status: value })}
                            disabled={isUpdating}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Priority:</span>
                        <Select
                            value={returnData.priority}
                            onValueChange={(value) => onUpdate({ priority: value })}
                            disabled={isUpdating}
                        >
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PRIORITY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Assigned:</span>
                        <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={userSearchOpen}
                                    className="w-[200px] justify-between"
                                    disabled={isUpdating}
                                >
                                    {assignedUser
                                        ? `${assignedUser.firstName} ${assignedUser.lastName}`
                                        : "Unassigned"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search users..." />
                                    <CommandList>
                                        <CommandEmpty>No user found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                onSelect={() => {
                                                    onUpdate({ assignedUserId: null });
                                                    setUserSearchOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        !returnData.assignedUserId ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                Unassigned
                                            </CommandItem>
                                            {users.map((user) => (
                                                <CommandItem
                                                    key={user.id}
                                                    onSelect={() => {
                                                        onUpdate({ assignedUserId: user.id });
                                                        setUserSearchOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            returnData.assignedUserId === user.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {user.firstName} {user.lastName}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="ml-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdate({ isArchived: !returnData.isArchived })}
                            disabled={isUpdating}
                        >
                            {returnData.isArchived ? (
                                <>
                                    <ArchiveRestore className="h-4 w-4 mr-2" />
                                    Unarchive
                                </>
                            ) : (
                                <>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
