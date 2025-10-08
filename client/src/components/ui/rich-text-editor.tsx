import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered, 
  Link as LinkIcon,
  Heading2,
  RemoveFormatting
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Start typing...",
  className,
  editable = true
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Underline,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] px-3 py-2',
          className
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = () => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-md bg-background">
      {editable && (
        <div className="border-b bg-muted/50 p-2 flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 px-2',
              editor.isActive('bold') && 'bg-accent'
            )}
            data-testid="editor-bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'h-8 px-2',
              editor.isActive('italic') && 'bg-accent'
            )}
            data-testid="editor-italic"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              'h-8 px-2',
              editor.isActive('underline') && 'bg-accent'
            )}
            data-testid="editor-underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          <div className="w-px h-8 bg-border mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'h-8 px-2',
              editor.isActive('heading', { level: 2 }) && 'bg-accent'
            )}
            data-testid="editor-heading"
          >
            <Heading2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 px-2',
              editor.isActive('bulletList') && 'bg-accent'
            )}
            data-testid="editor-bullet-list"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 px-2',
              editor.isActive('orderedList') && 'bg-accent'
            )}
            data-testid="editor-ordered-list"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <div className="w-px h-8 bg-border mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={setLink}
            className={cn(
              'h-8 px-2',
              editor.isActive('link') && 'bg-accent'
            )}
            data-testid="editor-link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            className="h-8 px-2"
            data-testid="editor-clear-formatting"
          >
            <RemoveFormatting className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className={cn(!editable && 'p-3')}>
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
    </div>
  );
}
