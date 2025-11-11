import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquarePlus, Send, User, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InternalNote, InsertInternalNote } from "@/lib/types";

// InternalNote type is imported from types

interface InternalNotesProps {
  entityType: 'customer' | 'order' | 'repair' | 'emailThread' | 'case' | 'return';
  entityId: string;
  entityTitle?: string;
}

export function InternalNotes({ entityType, entityId, entityTitle }: InternalNotesProps) {
  const [newNote, setNewNote] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: notes, isLoading } = useQuery<InternalNote[]>({
    queryKey: ['/api/notes', entityType, entityId],
  });

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: InsertInternalNote) => {
      const response = await fetch("/api/notes", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData)
      });
      if (!response.ok) throw new Error('Failed to create note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes', entityType, entityId] });
      setNewNote("");
      setIsExpanded(false);
      toast({
        title: "Note added",
        description: "Internal note has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save note. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to delete note');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes', entityType, entityId] });
      setNoteToDelete(null);
      toast({
        title: "Note deleted",
        description: "The note has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmitNote = () => {
    const noteText = newNote.replace(/<[^>]*>/g, '').trim();
    if (!noteText) return;

    const noteData: InsertInternalNote = {
      content: newNote,
      authorId: "", // Will be set by the backend using the authenticated user
      ...(entityType === 'customer' && { customerId: entityId }),
      ...(entityType === 'order' && { orderId: entityId }),
      ...(entityType === 'repair' && { repairId: entityId }),
      ...(entityType === 'emailThread' && { emailThreadId: entityId }),
      ...(entityType === 'case' && { caseId: entityId }),
      ...(entityType === 'return' && { returnId: entityId }),
    };

    createNoteMutation.mutate(noteData);
  };

  const getEntityTypeDisplay = (type: string) => {
    const displays = {
      customer: "Customer",
      order: "Order", 
      repair: "Repair",
      emailThread: "Email Thread"
    };
    return displays[type as keyof typeof displays] || type;
  };

  const getAuthorInitials = (authorId: string) => {
    // TODO: Fetch actual user data - for now using placeholder
    return "JD";
  };

  return (
    <Card className="w-full" data-testid="internal-notes-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Internal Notes</CardTitle>
            {notes && notes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notes.length}
              </Badge>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              console.log('Add Note clicked, isExpanded:', isExpanded);
              setIsExpanded(!isExpanded);
            }}
            data-testid="add-note-button"
          >
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            {isExpanded ? 'Cancel' : 'Add Note'}
          </Button>
        </div>
        {entityTitle && (
          <CardDescription>
            Notes for {getEntityTypeDisplay(entityType)}: {entityTitle}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add New Note Form */}
        {isExpanded && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20" data-testid="note-form">
            <RichTextEditor
              content={newNote}
              onChange={setNewNote}
              placeholder="Add an internal note for your team..."
              className="min-h-[100px]"
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSubmitNote}
                disabled={!newNote.replace(/<[^>]*>/g, '').trim() || createNoteMutation.isPending}
                size="sm"
                data-testid="submit-note-button"
              >
                <Send className="h-4 w-4 mr-2" />
                {createNoteMutation.isPending ? "Saving..." : "Add Note"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsExpanded(false);
                  setNewNote("");
                }}
                size="sm"
                data-testid="cancel-note-button"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Notes List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading notes...
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="space-y-4" data-testid="notes-list">
            {notes.map((note: InternalNote, index: number) => (
              <div key={note.id}>
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10">
                      {getAuthorInitials(note.authorId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Team Member</span>
                      <Clock className="h-3 w-3 ml-2" />
                      <span>{note.createdAt ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }) : 'Unknown time'}</span>
                    </div>
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    {note.mentions && note.mentions.length > 0 && (
                      <div className="flex gap-1">
                        {note.mentions.map((mentionId: string) => (
                          <Badge key={mentionId} variant="outline" className="text-xs">
                            @{mentionId.slice(0, 8)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNoteToDelete(note.id)}
                    data-testid={`delete-note-${note.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
                {index < notes.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground" data-testid="no-notes-message">
            <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No internal notes yet</p>
            <p className="text-xs mt-1">Add the first note to share information with your team</p>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!noteToDelete} onOpenChange={() => setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-note">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => noteToDelete && deleteNoteMutation.mutate(noteToDelete)}
              disabled={deleteNoteMutation.isPending}
              data-testid="confirm-delete-note"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNoteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}