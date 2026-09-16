"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionUploadNoteFraisJustificatif } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type UploadJustificatifDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  expectedVersion: number;
  onDone: () => void | Promise<void>;
};

/**
 * Dialog d'ajout d'un justificatif (PDF / image).
 */
export function UploadJustificatifDialog({
  open,
  onOpenChange,
  noteId,
  expectedVersion,
  onDone,
}: UploadJustificatifDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error("Sélectionnez un fichier");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("noteId", noteId);
      fd.append("expectedVersion", String(expectedVersion));
      fd.append("file", file);
      const res = await actionUploadNoteFraisJustificatif(fd);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Justificatif ajouté");
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      onOpenChange(false);
      await onDone();
    } finally {
      setUploading(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Ajouter un justificatif"
      description="PDF ou image (JPEG, PNG, WebP)."
      icon={<Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="upload-justificatif-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-sm h-8 sm:h-9 border-slate-300"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="upload-justificatif-form"
            disabled={uploading}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm h-8 sm:h-9"
            data-testid="upload-justificatif-submit"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi…
              </>
            ) : (
              "Ajouter"
            )}
          </Button>
        </>
      }
    >
      <form id="upload-justificatif-form" onSubmit={onSubmit}>
        <section className={FRAIS_AVANCES_SECTION_CLASS}>
          <div className="space-y-1">
            <Label htmlFor="nf-justificatif-file" className={FRAIS_AVANCES_LABEL_CLASS}>
              Fichier *
            </Label>
            <Input
              id="nf-justificatif-file"
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploading}
              className={FRAIS_AVANCES_INPUT_CLASS}
              onChange={(e) =>
                setFileName(e.target.files?.[0]?.name ?? null)
              }
            />
            {fileName ? (
              <p className="text-xs text-slate-600 truncate" title={fileName}>
                {fileName}
              </p>
            ) : null}
          </div>
        </section>
      </form>
    </FraisAvancesDialogShell>
  );
}
