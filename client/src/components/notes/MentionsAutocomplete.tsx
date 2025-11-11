import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";

interface MentionsAutocompleteProps {
  users: User[];
  searchQuery: string;
  onSelect: (user: User) => void;
  position: { top: number; left: number };
  className?: string;
}

export function MentionsAutocomplete({
  users,
  searchQuery,
  onSelect,
  position,
  className,
}: MentionsAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredUsers.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(filteredUsers[selectedIndex]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredUsers, selectedIndex, onSelect]);

  if (filteredUsers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50 w-64 bg-popover border rounded-lg shadow-lg overflow-hidden",
        className
      )}
      style={{ top: position.top, left: position.left }}
      data-testid="mentions-autocomplete"
    >
      <div className="py-1">
        {filteredUsers.map((user, index) => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className={cn(
              "w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors text-left",
              index === selectedIndex && "bg-accent"
            )}
            data-testid={`mention-user-${user.id}`}
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
