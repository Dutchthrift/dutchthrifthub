import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Mail, 
  Inbox, 
  Send, 
  Archive, 
  Star, 
  Circle,
  Search,
  Package,
  PackageX
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailSidebarProps {
  selectedFolder: string;
  selectedFilter?: 'with-order' | 'without-order' | null;
  onFolderChange: (folder: string) => void;
  onFilterChange: (filter: 'with-order' | 'without-order' | null) => void;
  onCompose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts?: {
    inbox?: number;
    sent?: number;
    archived?: number;
    starred?: number;
    unread?: number;
    withOrder?: number;
    withoutOrder?: number;
  };
}

export function EmailSidebar({
  selectedFolder,
  selectedFilter,
  onFolderChange,
  onFilterChange,
  onCompose,
  searchQuery,
  onSearchChange,
  counts = {},
}: EmailSidebarProps) {
  const folders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: counts.inbox },
    { id: 'starred', label: 'Starred', icon: Star, count: counts.starred },
    { id: 'sent', label: 'Sent', icon: Send, count: counts.sent },
    { id: 'archived', label: 'Archived', icon: Archive, count: counts.archived },
    { id: 'unread', label: 'Unread', icon: Circle, count: counts.unread },
  ];

  const filters = [
    { id: 'with-order', label: 'With Order', icon: Package, count: counts.withOrder },
    { id: 'without-order', label: 'Without Order', icon: PackageX, count: counts.withoutOrder },
  ];

  return (
    <div className="flex flex-col h-full bg-background border-r" data-testid="email-sidebar">
      {/* Compose Button */}
      <div className="p-4 border-b">
        <Button
          onClick={onCompose}
          className="w-full bg-blue-600 hover:bg-blue-700"
          data-testid="sidebar-compose-button"
        >
          <Mail className="mr-2 h-4 w-4" />
          Compose
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="sidebar-search-input"
          />
        </div>
      </div>

      {/* Folders */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="mb-4">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFolderChange(folder.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedFolder === folder.id
                    ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium"
                    : "hover:bg-accent text-foreground"
                )}
                data-testid={`folder-${folder.id}`}
              >
                <div className="flex items-center gap-3">
                  <folder.icon className="h-5 w-5" />
                  <span>{folder.label}</span>
                </div>
                {folder.count !== undefined && folder.count > 0 && (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      selectedFolder === folder.id
                        ? "bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        : "bg-muted text-muted-foreground"
                    )}
                    data-testid={`count-${folder.id}`}
                  >
                    {folder.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filters Section */}
          <div className="border-t pt-4">
            <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase">
              Filters
            </div>
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => onFilterChange(filter.id as 'with-order' | 'without-order')}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedFilter === filter.id
                    ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium"
                    : "hover:bg-accent text-foreground"
                )}
                data-testid={`filter-${filter.id}`}
              >
                <div className="flex items-center gap-3">
                  <filter.icon className="h-5 w-5" />
                  <span>{filter.label}</span>
                </div>
                {filter.count !== undefined && filter.count > 0 && (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      selectedFilter === filter.id
                        ? "bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        : "bg-muted text-muted-foreground"
                    )}
                    data-testid={`count-${filter.id}`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
