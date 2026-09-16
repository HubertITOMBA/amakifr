"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actionSubmitNoteFrais } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";
import {
  FRAIS_AVANCES_SECTION_BLUE_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type SubmitNoteFraisConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  expectedVersion: number;
  idempotencyKey: string;
  libelle: string;
  montantDemande?: string | number;
  onDone: () => void | Promise<void>;
};

/**
 * Confirmation de soumission d'une note de frais.
 */
export function SubmitNoteFraisConfirmDialog({
  open,
  onOpenChange,
  noteId,
  expectedVersion,
  idempotencyKey,
  libelle,
  montantDemande,
  onDone,
}: SubmitNoteFraisConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setLoading(true);
    try {
      const res = await actionSubmitNoteFrais({
        noteId,
        idempotencyKey,
        expectedVersion,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message || "Soumise");
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
      title="Soumettre la note"
      description="La note passera en attente de décision."
      icon={<Send className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="submit-note-frais-dialog"
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
            disabled={loading}
            onClick={() => void onConfirm()}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm h-8 sm:h-9"
            data-testid="submit-note-frais-confirm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Soumission…
              </>
            ) : (
              "Soumettre"
            )}
          </Button>
        </>
      }
    >
      <section className={FRAIS_AVANCES_SECTION_BLUE_CLASS}>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
          {libelle}
        </p>
        <div className="flex flex-wrap gap-2">
          <NoteFraisStatutBadge statut="BROUILLON" />
          {montantDemande != null ? (
            <NoteFraisMontantBadge label="Demandé" value={montantDemande} />
          ) : null}
        </div>
      </section>
    </FraisAvancesDialogShell>
  );
}
