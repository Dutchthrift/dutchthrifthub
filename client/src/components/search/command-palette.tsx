import { useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  Home, 
  Inbox, 
  ShoppingCart, 
  Wrench, 
  CheckSquare, 
  BarChart3,
  Plus,
  Search,
  Mail
} from "lucide-react";
import { useLocation } from "wouter";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();

  const handleCommand = (command: string) => {
    switch (command) {
      case "home":
        setLocation("/");
        break;
      case "inbox":
        setLocation("/inbox");
        break;
      case "orders":
        setLocation("/orders");
        break;
      case "repairs":
        setLocation("/repairs");
        break;
      case "todos":
        setLocation("/todos");
        break;
      case "dashboard":
        setLocation("/dashboard");
        break;
      case "new-todo":
        // Open new todo dialog
        break;
      case "new-repair":
        // Open new repair dialog
        break;
      case "search-orders":
        setLocation("/orders");
        break;
      case "compose-email":
        // Open email composer
        break;
    }
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." data-testid="command-palette-input" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleCommand("home")} data-testid="command-home">
            <Home className="mr-2 h-4 w-4" />
            <span>Go to Home</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("inbox")} data-testid="command-inbox">
            <Inbox className="mr-2 h-4 w-4" />
            <span>Go to Inbox</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("orders")} data-testid="command-orders">
            <ShoppingCart className="mr-2 h-4 w-4" />
            <span>Go to Orders</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("repairs")} data-testid="command-repairs">
            <Wrench className="mr-2 h-4 w-4" />
            <span>Go to Repairs</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("todos")} data-testid="command-todos">
            <CheckSquare className="mr-2 h-4 w-4" />
            <span>Go to To-do's</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("dashboard")} data-testid="command-dashboard">
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Go to Dashboard</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => handleCommand("new-todo")} data-testid="command-new-todo">
            <Plus className="mr-2 h-4 w-4" />
            <span>Create New To-do</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("new-repair")} data-testid="command-new-repair">
            <Plus className="mr-2 h-4 w-4" />
            <span>Start New Repair</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("search-orders")} data-testid="command-search-orders">
            <Search className="mr-2 h-4 w-4" />
            <span>Search Orders</span>
          </CommandItem>
          <CommandItem onSelect={() => handleCommand("compose-email")} data-testid="command-compose-email">
            <Mail className="mr-2 h-4 w-4" />
            <span>Compose Email</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
