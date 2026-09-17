"use client";

import { useEffect, useState } from "react";
import { FilePenLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionCorrectNoteFraisReglement } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import { messageErreurNoteFrais } from "@/components/frais-avances/note-frais-badges";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  reglementId: string;
  expectedVersion: number;
  idempotencyKey: string;
  onDone: () => void | Promise<void>;
};

/**
 * Dialog correction REFERENCE (TRESOR/ADMIN) — confirmation forte.
 */
export function CorrectReferenceDialog({
  open,
  onOpenChange,
  noteId,
  reglementId,
  expectedVersion,
  idempotencyKey,
  onDone,
}: Props) {
  const [referenceApres, setReferenceApres] = useState("");
  const [motif, setMotif] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReferenceApres("");
      setMotif("");
      setConfirm(false);
    }
  }, [open]);

  async function onConfirm() {
    if (!confirm) {
      toast.warning("Cochez la confirmation avant d'enregistrer");
      return;
    }
    setSubmitting(true);
    try {
      const res = await actionCorrectNoteFraisReglement({
        noteId,
        reglementId,
        expectedNoteVersion: expectedVersion,
        idempotencyKey,
        type: "REFERENCE",
        referenceApres,
        motif,
      });
      if (!res.success) {
        toast.error(messageErreurNoteFrais(res.code, res.error));
        return;
      }
      toast.success(res.message || "Correction de référence enregistrée");
      onOpenChange(false);
      await onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Corriger la référence"
      description="Append-only : la référence originale du règlement n'est pas modifiée. Une chaîne de corrections détermine la référence effective."
      icon={<FilePenLine className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="correct-reference-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting || !confirm}
            data-testid="confirm-correct-reference"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Enregistrer la correction
          </Button>
        </>
      }
    >
      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>Nouvelle référence</Label>
          <Input
            className={FRAIS_AVANCES_INPUT_CLASS}
            value={referenceApres}
            onChange={(e) => setReferenceApres(e.target.value)}
            maxLength={64}
            data-testid="correct-reference-apres"
          />
        </div>
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>Motif</Label>
          <Textarea
            className={FRAIS_AVANCES_INPUT_CLASS}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            maxLength={2000}
            rows={3}
            data-testid="correct-reference-motif"
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            className="mt-0.5"
            data-testid="correct-reference-confirm"
          />
          <span>
            Je confirme que cette correction enregistre une erreur de
            référence, sans modifier le règlement original.
          </span>
        </label>
      </div>
    </FraisAvancesDialogShell>
  );
}
