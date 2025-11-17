import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NoteComposer } from "./NoteComposer";
import { NoteItem } from "./NoteItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Filter, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Note, NoteTag, User } from "@shared/schema";

interface NotesPanelProps {
  entityType: string;
  entityId: string;
  currentUser: User;
  className?: string;
}

export function NotesPanel({ entityType, entityId, currentUser, className }: NotesPanelProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState<string | undefined>(undefined);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: notes = [], isLoading } = useQuery<(Note & { author?: User; tags?: NoteTag[] })[]>({
    queryKey: ["/api/notes", entityType, entityId, authorFilter, selectedTagFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (authorFilter) params.set("authorId", authorFilter);
      if (selectedTagFilters.length > 0) {
        selectedTagFilters.forEach(tagId => params.append("tagIds", tagId));
      }
      
      const url = `/api/notes/${entityType}/${entityId}${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch notes");
      return response.json();
    },
  });

  const { data: availableTags = [] } = useQuery<NoteTag[]>({
    queryKey: ["/api/note-tags"],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users/list"],
  });

  const uniqueAuthors = useMemo(() => {
    const authorMap = new Map<string, User>();
    notes.forEach(note => {
      if (note.author && !authorMap.has(note.author.id)) {
        authorMap.set(note.author.id, note.author);
      }
    });
    return Array.from(authorMap.values());
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let filtered = [...notes];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        note.plainText?.toLowerCase().includes(query) ||
        note.content?.toLowerCase().includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(note => {
        if (!note.createdAt) return false;
        const noteDate = new Date(note.createdAt);
        return noteDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(note => {
        if (!note.createdAt) return false;
        const noteDate = new Date(note.createdAt);
        return noteDate <= toDate;
      });
    }

    return filtered;
  }, [notes, searchQuery, dateFrom, dateTo]);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagFilters(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setAuthorFilter(undefined);
    setSelectedTagFilters([]);
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = searchQuery || authorFilter || selectedTagFilters.length > 0 || dateFrom || dateTo;

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: { content: string; plainText: string; visibility: string; tagIds: string[] }) => {
      const response = await apiRequest("POST", "/api/notes", {
        entityType,
        entityId,
        content: noteData.content,
        plainText: noteData.plainText,
        visibility: noteData.visibility,
        authorId: currentUser.id,
      });
      const newNote = await response.json();
      
      if (noteData.tagIds.length > 0) {
        await Promise.all(
          noteData.tagIds.map((tagId) =>
            apiRequest("POST", `/api/notes/${newNote.id}/tags/${tagId}`)
          )
        );
      }
      
      return newNote;
    },
    onSuccess: async (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", entityType, entityId] });
      toast({
        title: "Note added",
        description: "Your note has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const pinNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("POST", `/api/notes/${noteId}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", entityType, entityId] });
      toast({ title: "Note pinned" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to pin note",
        variant: "destructive",
      });
    },
  });

  const unpinNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("DELETE", `/api/notes/${noteId}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", entityType, entityId] });
      toast({ title: "Note unpinned" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const reason = window.prompt("Why are you deleting this note?");
      if (!reason) throw new Error("Delete reason is required");
      
      return apiRequest("DELETE", `/api/notes/${noteId}`, { deleteReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", entityType, entityId] });
      toast({ title: "Note deleted" });
    },
    onError: (error: any) => {
      if (error.message !== "Delete reason is required") {
        toast({
          title: "Error",
          description: "Failed to delete note",
          variant: "destructive",
        });
      }
    },
  });

  const reactToNoteMutation = useMutation({
    mutationFn: async ({ noteId, emoji }: { noteId: string; emoji: string }) => {
      return apiRequest("POST", `/api/notes/${noteId}/reactions`, {
        userId: currentUser.id,
        emoji,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", entityType, entityId] });
    },
  });

  const pinnedNotes = filteredNotes.filter((note) => note.isPinned && !note.deletedAt);
  const unpinnedNotes = filteredNotes.filter((note) => !note.isPinned && !note.deletedAt);
  const deletedNotes = filteredNotes.filter((note) => note.deletedAt);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="notes-panel">
      <NoteComposer
        onSubmit={(noteData) => createNoteMutation.mutate(noteData)}
        isPending={createNoteMutation.isPending}
        availableTags={availableTags}
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="notes-search-input"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-start sm:items-center">
          {uniqueAuthors.length > 0 && (
            <Select value={authorFilter || "all"} onValueChange={(val) => setAuthorFilter(val === "all" ? undefined : val)}>
              <SelectTrigger className="w-[150px] h-9" data-testid="filter-author">
                <SelectValue placeholder="All authors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All authors</SelectItem>
                {uniqueAuthors.map((author) => (
                  <SelectItem key={author.id} value={author.id}>
                    {author.firstName} {author.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {availableTags.length > 0 && (
            <Select value="" onValueChange={toggleTagFilter}>
              <SelectTrigger className="w-[120px] h-9" data-testid="filter-tags">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                {availableTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color || "#64748b" }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="w-[140px] h-9"
              data-testid="filter-date-from"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="w-[140px] h-9"
              data-testid="filter-date-to"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              data-testid="filter-clear-all"
            >
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {selectedTagFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Active tag filters:</span>
            {selectedTagFilters.map((tagId) => {
              const tag = availableTags.find((t) => t.id === tagId);
              if (!tag) return null;
              const tagColor = tag.color || "#64748b";
              return (
                <Badge
                  key={tagId}
                  variant="secondary"
                  className="gap-1"
                  style={{ backgroundColor: tagColor + "20", color: tagColor, borderColor: tagColor }}
                  data-testid={`filter-tag-badge-${tagId}`}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => toggleTagFilter(tagId)}
                    className="hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground" data-testid="notes-count">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
            {hasActiveFilters && notes.length !== filteredNotes.length && (
              <span className="text-xs ml-1">(filtered from {notes.length})</span>
            )}
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        {pinnedNotes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pinned
            </h4>
            {pinnedNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                currentUserId={currentUser.id}
                onPin={(noteId) => pinNoteMutation.mutate(noteId)}
                onUnpin={(noteId) => unpinNoteMutation.mutate(noteId)}
                onDelete={(noteId) => deleteNoteMutation.mutate(noteId)}
                onReact={(noteId, emoji) => reactToNoteMutation.mutate({ noteId, emoji })}
              />
            ))}
          </div>
        )}

        {unpinnedNotes.length > 0 && (
          <div className="space-y-2">
            {pinnedNotes.length > 0 && (
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                All Notes
              </h4>
            )}
            {unpinnedNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                currentUserId={currentUser.id}
                onPin={(noteId) => pinNoteMutation.mutate(noteId)}
                onUnpin={(noteId) => unpinNoteMutation.mutate(noteId)}
                onDelete={(noteId) => deleteNoteMutation.mutate(noteId)}
                onReact={(noteId, emoji) => reactToNoteMutation.mutate({ noteId, emoji })}
              />
            ))}
          </div>
        )}

        {deletedNotes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
              Deleted ({deletedNotes.length})
            </h4>
            {deletedNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                currentUserId={currentUser.id}
              />
            ))}
          </div>
        )}

        {notes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No notes yet. Add one above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
