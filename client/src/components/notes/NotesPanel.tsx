import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NoteComposer } from "./NoteComposer";
import { NoteItem } from "./NoteItem";
import { Button } from "@/components/ui/button";
import { Loader2, Filter } from "lucide-react";
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
  const [visibilityFilter, setVisibilityFilter] = useState<string | undefined>(undefined);

  const { data: notes = [], isLoading } = useQuery<(Note & { author?: User; tags?: NoteTag[] })[]>({
    queryKey: ["/api/notes", entityType, entityId, visibilityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (visibilityFilter) params.set("visibility", visibilityFilter);
      
      const url = `/api/notes/${entityType}/${entityId}${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch notes");
      return response.json();
    },
  });

  const { data: availableTags = [] } = useQuery<NoteTag[]>({
    queryKey: ["/api/note-tags"],
  });

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: { content: string; plainText: string; visibility: string; tagIds: string[] }) => {
      const response = await apiRequest("/api/notes", "POST", {
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
            apiRequest(`/api/notes/${newNote.id}/tags/${tagId}`, "POST")
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
      return apiRequest(`/api/notes/${noteId}/pin`, "POST");
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
      return apiRequest(`/api/notes/${noteId}/pin`, "DELETE");
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
      
      return apiRequest(`/api/notes/${noteId}`, "DELETE", { deleteReason: reason });
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
      return apiRequest(`/api/notes/${noteId}/reactions`, "POST", {
        userId: currentUser.id,
        emoji,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", entityType, entityId] });
    },
  });

  const pinnedNotes = notes.filter((note) => note.isPinned && !note.deletedAt);
  const unpinnedNotes = notes.filter((note) => !note.isPinned && !note.deletedAt);
  const deletedNotes = notes.filter((note) => note.deletedAt);

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

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground" data-testid="notes-count">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant={visibilityFilter === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => setVisibilityFilter(undefined)}
            data-testid="filter-all"
          >
            All
          </Button>
          <Button
            variant={visibilityFilter === "internal" ? "default" : "outline"}
            size="sm"
            onClick={() => setVisibilityFilter("internal")}
            data-testid="filter-internal"
          >
            Internal
          </Button>
          <Button
            variant={visibilityFilter === "customer_visible" ? "default" : "outline"}
            size="sm"
            onClick={() => setVisibilityFilter("customer_visible")}
            data-testid="filter-customer"
          >
            Customer
          </Button>
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
