import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Bold, Italic, UnderlineIcon, List, ListOrdered, Link as LinkIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoteComposerProps {
  onSubmit: (note: { content: string; plainText: string; visibility: string; tagIds: string[] }) => void;
  isPending?: boolean;
  placeholder?: string;
  availableTags?: Array<{ id: string; name: string; color: string | null }>;
  className?: string;
}

export function NoteComposer({ onSubmit, isPending, placeholder = "Add a note...", availableTags = [], className }: NoteComposerProps) {
  const [visibility, setVisibility] = useState<string>("internal");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 dark:text-blue-400 underline cursor-pointer",
        },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none focus:outline-none min-h-[80px] px-3 py-2 text-sm",
      },
    },
  });

  const handleSubmit = () => {
    if (!editor) return;

    const content = editor.getHTML();
    const plainText = editor.getText();

    if (!plainText.trim()) return;

    onSubmit({
      content,
      plainText,
      visibility,
      tagIds: selectedTags,
    });

    editor.commands.clearContent();
    setSelectedTags([]);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const selectedTagObjects = availableTags.filter((tag) => selectedTags.includes(tag.id));

  return (
    <div className={cn("border rounded-lg bg-card", className)} data-testid="note-composer">
      <div className="border-b p-2 flex items-center gap-2 bg-muted/50">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={cn(
            "p-1.5 rounded hover:bg-accent",
            editor?.isActive("bold") && "bg-accent"
          )}
          data-testid="note-composer-bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={cn(
            "p-1.5 rounded hover:bg-accent",
            editor?.isActive("italic") && "bg-accent"
          )}
          data-testid="note-composer-italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={cn(
            "p-1.5 rounded hover:bg-accent",
            editor?.isActive("underline") && "bg-accent"
          )}
          data-testid="note-composer-underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={cn(
            "p-1.5 rounded hover:bg-accent",
            editor?.isActive("bulletList") && "bg-accent"
          )}
          data-testid="note-composer-bullet-list"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-1.5 rounded hover:bg-accent",
            editor?.isActive("orderedList") && "bg-accent"
          )}
          data-testid="note-composer-ordered-list"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) {
              editor?.chain().focus().setLink({ href: url }).run();
            }
          }}
          className={cn(
            "p-1.5 rounded hover:bg-accent",
            editor?.isActive("link") && "bg-accent"
          )}
          data-testid="note-composer-link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>

      <EditorContent editor={editor} />

      <div className="border-t p-3 bg-muted/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger className="w-[140px] h-8" data-testid="note-composer-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal only</SelectItem>
              <SelectItem value="customer_visible">Customer visible</SelectItem>
              <SelectItem value="system">System note</SelectItem>
            </SelectContent>
          </Select>

          {selectedTagObjects.map((tag) => {
            const tagColor = tag.color || "#64748b";
            return (
              <Badge
                key={tag.id}
                variant="secondary"
                className="gap-1"
                style={{ backgroundColor: tagColor + "20", color: tagColor, borderColor: tagColor }}
                data-testid={`note-composer-tag-${tag.id}`}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}

          {availableTags.length > 0 && selectedTags.length < availableTags.length && (
            <Select value="" onValueChange={toggleTag}>
              <SelectTrigger className="w-[100px] h-8" data-testid="note-composer-add-tag">
                <SelectValue placeholder="Add tag..." />
              </SelectTrigger>
              <SelectContent>
                {availableTags
                  .filter((tag) => !selectedTags.includes(tag.id))
                  .map((tag) => (
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
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || !editor?.getText().trim()}
          data-testid="note-composer-submit"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
