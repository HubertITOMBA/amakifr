"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actionDeleteNoteFraisJustificatif } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type DeleteJustificatifConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  justificatifId: string | null;
  fileName?: string;
  expectedVersion: number;
  onDone: () => void | Promise<void>;
};

/**
 * Confirmation de suppression d'un justificatif.
 */
export function DeleteJustificatifConfirmDialog({
  open,
  onOpenChange,
  noteId,
  justificatifId,
  fileName,
  expectedVersion,
  onDone,
}: DeleteJustificatifConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    if (!justificatifId) return;
    setLoading(true);
    try {
      const res = await actionDeleteNoteFraisJustificatif({
        noteId,
        justificatifId,
        expectedVersion,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Pièce supprimée");
      onOpenChange(false);
      await onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Supprimer le justificatif"
      description="Cette action retire la pièce du brouillon."
      icon={<Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="delete-justificatif-dialog"
      contentClassName="max-w-md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-sm h-8 sm:h-9 border-slate-300"
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={loading || !justificatifId}
            onClick={() => void onConfirm()}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white text-sm h-8 sm:h-9"
            data-testid="delete-justificatif-confirm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Suppression…
              </>
            ) : (
              "Supprimer"
            )}
          </Button>
        </>
      }
    >
      <section className={FRAIS_AVANCES_SECTION_CLASS}>
        <p className="text-sm text-slate-800 dark:text-slate-100">
          Confirmez la suppression
          {fileName ? (
            <>
              {" "}
              de <strong className="font-semibold break-all">{fileName}</strong>
            </>
          ) : null}
          .
        </p>
      </section>
    </FraisAvancesDialogShell>
  );
}
