import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bold, Italic, UnderlineIcon, List, ListOrdered, Link as LinkIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@shared/schema";

interface NoteEditDialogProps {
  note: Note;
  open: boolean;
  onClose: () => void;
  onSave: (updates: { content: string; plainText: string }) => Promise<void>;
  isPending?: boolean;
}

export function NoteEditDialog({ note, open, onClose, onSave, isPending }: NoteEditDialogProps) {

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
    content: note.content,
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-3 py-2 text-sm border rounded-md",
      },
    },
  });

  const handleSave = async () => {
    if (!editor) return;

    const content = editor.getHTML();
    const plainText = editor.getText();

    await onSave({
      content,
      plainText,
    });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="note-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
          <DialogDescription>
            Make changes to your note. A revision will be saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-b p-2 flex items-center gap-2 bg-muted/50 rounded-t-md">
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={cn(
                "p-1.5 rounded hover:bg-accent",
                editor?.isActive("bold") && "bg-accent"
              )}
              data-testid="edit-bold"
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
              data-testid="edit-italic"
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
              data-testid="edit-underline"
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
              data-testid="edit-bullet-list"
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
              data-testid="edit-ordered-list"
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
              data-testid="edit-link"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
          </div>

          <EditorContent editor={editor} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending} data-testid="save-edit">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
