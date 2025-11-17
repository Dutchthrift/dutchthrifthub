import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Bold, Italic, UnderlineIcon, List, ListOrdered, Link as LinkIcon, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface NoteTemplate {
  id: string;
  name: string;
  content: string;
  description?: string | null;
}

interface NoteComposerProps {
  onSubmit: (note: { content: string; plainText: string; visibility: string; tagIds: string[] }) => void;
  isPending?: boolean;
  placeholder?: string;
  availableTags?: Array<{ id: string; name: string; color: string | null }>;
  className?: string;
  contextData?: {
    orderNumber?: string;
    customerName?: string;
    [key: string]: any;
  };
}

export function NoteComposer({ onSubmit, isPending, placeholder = "Add a note...", availableTags = [], className, contextData = {} }: NoteComposerProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: templates = [] } = useQuery<NoteTemplate[]>({
    queryKey: ["/api/note-templates"],
  });

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
      visibility: "internal",
      tagIds: selectedTags,
    });

    editor.commands.clearContent();
    setSelectedTags([]);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const substituteVariables = (content: string): string => {
    let substituted = content;
    
    if (contextData.orderNumber) {
      substituted = substituted.replace(/\{\{orderNumber\}\}/g, contextData.orderNumber);
    }
    
    if (contextData.customerName) {
      substituted = substituted.replace(/\{\{customerName\}\}/g, contextData.customerName);
    }
    
    substituted = substituted.replace(/\{\{today\}\}/g, format(new Date(), "MMMM d, yyyy"));
    
    return substituted;
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template && editor) {
      const content = substituteVariables(template.content);
      editor.commands.setContent(content);
      editor.commands.focus();
    }
  };

  const selectedTagObjects = availableTags.filter((tag) => selectedTags.includes(tag.id));

  return (
    <div 
      className={cn("border rounded-lg bg-card", className)} 
      data-testid="note-composer"
      onKeyDown={handleKeyDown}
      role="form"
      aria-label="Note composer"
    >
      <div className="border-b p-2 flex items-center gap-2 bg-muted/50" role="toolbar" aria-label="Formatting toolbar">
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
        {templates.length > 0 && (
          <>
            <div className="w-px h-4 bg-border" />
            <Select value="" onValueChange={handleTemplateSelect}>
              <SelectTrigger className="w-auto h-auto p-1.5 border-0 hover:bg-accent" data-testid="note-composer-template">
                <FileText className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{template.name}</span>
                      {template.description && (
                        <span className="text-xs text-muted-foreground">{template.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <EditorContent editor={editor} />

      <div className="border-t p-3 bg-muted/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
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
          aria-label="Submit note (Ctrl+Enter)"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
