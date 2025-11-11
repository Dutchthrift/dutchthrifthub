import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pin, MoreVertical, Reply, Edit, Trash, Eye, EyeOff, ThumbsUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note, NoteTag, User } from "@shared/schema";

interface NoteItemProps {
  note: Note & { author?: User; tags?: NoteTag[] };
  currentUserId: string;
  onReply?: (noteId: string) => void;
  onEdit?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  onPin?: (noteId: string) => void;
  onUnpin?: (noteId: string) => void;
  onReact?: (noteId: string, emoji: string) => void;
  className?: string;
}

export function NoteItem({
  note,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReact,
  className,
}: NoteItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isAuthor = note.authorId === currentUserId;
  const isPinned = note.isPinned;
  const visibilityIcon = note.visibility === "customer_visible" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />;
  const visibilityLabel = note.visibility === "customer_visible" ? "Customer visible" : note.visibility === "system" ? "System" : "Internal";

  const authorInitials = note.author
    ? `${note.author.username[0]}${note.author.email[0]}`.toUpperCase()
    : "?";

  return (
    <div
      className={cn(
        "border rounded-lg bg-card",
        isPinned && "border-[var(--brand-orange-600)] shadow-sm",
        note.deletedAt && "opacity-50",
        className
      )}
      data-testid={`note-item-${note.id}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-muted">
              {authorInitials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium" data-testid="note-author">
                {note.author?.username || "Unknown"}
              </span>
              <span className="text-xs text-muted-foreground" data-testid="note-timestamp">
                {note.createdAt ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }) : "Recently"}
              </span>
              {note.editedAt && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
              {isPinned && (
                <Pin className="h-3 w-3 text-[var(--brand-orange-600)]" data-testid="note-pinned-icon" />
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {visibilityIcon}
                <span>{visibilityLabel}</span>
              </div>
            </div>

            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {note.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-xs h-5"
                    style={tag.color ? { backgroundColor: tag.color + "20", borderColor: tag.color, color: tag.color } : undefined}
                    data-testid={`note-tag-${tag.id}`}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}

            <div
              className={cn(
                "prose prose-sm dark:prose-invert max-w-none",
                !isExpanded && "line-clamp-3"
              )}
              dangerouslySetInnerHTML={{ __html: note.renderedHtml || note.content }}
              data-testid="note-content"
            />

            {note.plainText && note.plainText.length > 200 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-blue-600 dark:text-blue-400 mt-1 hover:underline"
                data-testid="note-expand-toggle"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}

            {note.deletedAt && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>Deleted by {note.deletedBy}</span>
                {note.deleteReason && <span>• {note.deleteReason}</span>}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="note-menu">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onReply && (
                <DropdownMenuItem onClick={() => onReply(note.id)} data-testid="note-menu-reply">
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </DropdownMenuItem>
              )}
              {isAuthor && onEdit && !note.deletedAt && (
                <DropdownMenuItem onClick={() => onEdit(note.id)} data-testid="note-menu-edit">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {!note.deletedAt && (
                <>
                  {isPinned ? (
                    <DropdownMenuItem onClick={() => onUnpin?.(note.id)} data-testid="note-menu-unpin">
                      <Pin className="h-4 w-4 mr-2" />
                      Unpin
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onPin?.(note.id)} data-testid="note-menu-pin">
                      <Pin className="h-4 w-4 mr-2" />
                      Pin
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {isAuthor && onDelete && !note.deletedAt && (
                <DropdownMenuItem onClick={() => onDelete(note.id)} className="text-red-600 dark:text-red-400" data-testid="note-menu-delete">
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {onReact && !note.deletedAt && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <button
              onClick={() => onReact(note.id, "👍")}
              className="text-sm hover:bg-accent px-2 py-1 rounded"
              data-testid="note-react-thumbsup"
            >
              👍
            </button>
            <button
              onClick={() => onReact(note.id, "👀")}
              className="text-sm hover:bg-accent px-2 py-1 rounded"
              data-testid="note-react-eyes"
            >
              👀
            </button>
            <button
              onClick={() => onReact(note.id, "✅")}
              className="text-sm hover:bg-accent px-2 py-1 rounded"
              data-testid="note-react-check"
            >
              ✅
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
