"use client";

import DOMPurify from "isomorphic-dompurify";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Palette,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const COLOR_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Noir", value: "#0f172a" },
  { label: "Bleu", value: "#2563eb" },
  { label: "Vert", value: "#16a34a" },
  { label: "Rouge", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
];

const FONT_SIZES = [
  { label: "Petit", value: "12px" },
  { label: "Normal", value: "14px" },
  { label: "Moyen", value: "16px" },
  { label: "Grand", value: "18px" },
];

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

/**
 * Éditeur rich-text (gras, italique, souligné, couleur, taille, listes).
 * Stockage au format HTML (sanitisé avant sortie).
 */
export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "strong",
          "em",
          "u",
          "span",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
        ],
        ALLOWED_ATTR: ["style"],
      });
      onChange(sanitized);
    },
  });

  if (!editor) return null;

  const currentFontSize =
    (editor.getAttributes("textStyle").fontSize as string | undefined) || "14px";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
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

        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-600" />

        <Select
          value={currentFontSize}
          onValueChange={(size) => {
            editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
          }}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="Taille" />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-600" />

        <div className="flex items-center gap-1" title="Couleur du texte">
          <Palette className="h-4 w-4 text-slate-500" />
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className="h-6 w-6 rounded border border-slate-300 shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: preset.value }}
              title={preset.label}
              onClick={() => editor.chain().focus().setColor(preset.value).run()}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            Reset
          </Button>
        </div>

        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-600" />

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
