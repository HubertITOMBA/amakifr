"use client";

import DOMPurify from "isomorphic-dompurify";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const COLOR_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Noir", value: "#0f172a" }, // slate-900
  { label: "Bleu", value: "#2563eb" }, // blue-600
  { label: "Vert", value: "#16a34a" }, // green-600
  { label: "Rouge", value: "#dc2626" }, // red-600
  { label: "Orange", value: "#ea580c" }, // orange-600
];

/**
 * Éditeur rich-text (gras, italique, souligné, listes).
 * Stockage au format HTML (sanitisé avant sortie).
 */
export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    // TipTap: éviter les mismatches d'hydratation (SSR détecté)
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const sanitized = DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
      });
      onChange(sanitized);
    },
  });

  if (!editor) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 w-8 p-0", editor.isActive("bold") && "border-blue-300 bg-blue-50")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 w-8 p-0", editor.isActive("italic") && "border-blue-300 bg-blue-50")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 w-8 p-0", editor.isActive("underline") && "border-blue-300 bg-blue-50")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "border-blue-300 bg-blue-50")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "border-blue-300 bg-blue-50")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      {placeholder && !editor.getText().trim() ? (
        <div className="-mt-[220px] pointer-events-none select-none px-3 py-2 text-sm text-slate-400">
          {placeholder}
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}

