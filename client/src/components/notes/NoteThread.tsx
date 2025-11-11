import { useState } from "react";
import { NoteItem } from "./NoteItem";
import { NoteComposer } from "./NoteComposer";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note, NoteTag, User } from "@shared/schema";

interface NoteThreadProps {
  note: Note & { author?: User; tags?: NoteTag[]; replies?: (Note & { author?: User; tags?: NoteTag[] })[] };
  currentUserId: string;
  onReply: (parentId: string, noteData: { content: string; plainText: string; visibility: string; tagIds: string[] }) => void;
  onEdit?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  onPin?: (noteId: string) => void;
  onUnpin?: (noteId: string) => void;
  onReact?: (noteId: string, emoji: string) => void;
  availableTags?: NoteTag[];
  isPending?: boolean;
  depth?: number;
  className?: string;
}

export function NoteThread({
  note,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReact,
  availableTags = [],
  isPending,
  depth = 0,
  className,
}: NoteThreadProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const hasReplies = note.replies && note.replies.length > 0;
  const canReply = depth < 2; // Max depth of 2

  const handleReply = (noteData: { content: string; plainText: string; visibility: string; tagIds: string[] }) => {
    onReply(note.id, noteData);
    setShowReplyComposer(false);
  };

  return (
    <div className={cn("", className)} data-testid={`note-thread-${note.id}`}>
      <div className={cn(depth > 0 && "ml-8 pl-4 border-l-2 border-muted")}>
        <NoteItem
          note={note}
          currentUserId={currentUserId}
          onReply={canReply ? () => setShowReplyComposer(!showReplyComposer) : undefined}
          onEdit={onEdit}
          onDelete={onDelete}
          onPin={depth === 0 ? onPin : undefined}
          onUnpin={depth === 0 ? onUnpin : undefined}
          onReact={onReact}
        />

        {showReplyComposer && canReply && (
          <div className="mt-3 mb-3">
            <NoteComposer
              onSubmit={handleReply}
              isPending={isPending}
              placeholder="Write a reply..."
              availableTags={availableTags}
            />
          </div>
        )}

        {hasReplies && (
          <div className="mt-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
              data-testid={`toggle-replies-${note.id}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {note.replies?.length || 0} {note.replies?.length === 1 ? "reply" : "replies"}
            </button>

            {isExpanded && note.replies && (
              <div className="space-y-3">
                {note.replies.map((reply) => (
                  <NoteThread
                    key={reply.id}
                    note={reply}
                    currentUserId={currentUserId}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReact={onReact}
                    availableTags={availableTags}
                    isPending={isPending}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
