"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actionConfirmNoteFraisReglementAnnulation } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import { messageErreurNoteFrais } from "@/components/frais-avances/note-frais-badges";
import {
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";
import { useExpiresCountdown } from "@/components/frais-avances/useExpiresCountdown";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  demandeId: string;
  expectedVersion: number;
  decisionIdempotencyKey: string;
  expiresAt: string;
  cibleLabel: string;
  /** Affiche l'attestation remboursement et/ou compensation. */
  cibleTypes: Array<"REMBOURSEMENT" | "COMPENSATION" | "MIXTE">;
  onDone: () => void | Promise<void>;
};

/**
 * Dialog de confirmation d'annulation (lot 4.8) — effet financier.
 * L'attestation `true` est transmise au serveur (jamais case UI seule).
 */
export function ConfirmCancelDialog({
  open,
  onOpenChange,
  noteId,
  demandeId,
  expectedVersion,
  decisionIdempotencyKey,
  expiresAt,
  cibleLabel,
  cibleTypes,
  onDone,
}: Props) {
  const [attestation, setAttestation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const countdown = useExpiresCountdown(open ? expiresAt : null);

  const needsRemb =
    cibleTypes.includes("REMBOURSEMENT") || cibleTypes.includes("MIXTE");
  const needsComp =
    cibleTypes.includes("COMPENSATION") || cibleTypes.includes("MIXTE");

  useEffect(() => {
    if (open) setAttestation(false);
  }, [open]);

  async function onConfirm() {
    if (countdown.expired) {
      toast.error("Cette demande a expiré");
      return;
    }
    if (!attestation) {
      toast.warning("Cochez l'attestation avant de confirmer");
      return;
    }
    setSubmitting(true);
    try {
      const result = await actionConfirmNoteFraisReglementAnnulation({
        noteId,
        demandeId,
        expectedNoteVersion: expectedVersion,
        decisionIdempotencyKey,
        attestation: true,
      });
      if (!result.success) {
        toast.error(messageErreurNoteFrais(result.code, result.error));
        return;
      }
      toast.success(result.message || "Annulation confirmée");
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la confirmation"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Confirmer l'annulation"
      description={`Cible : ${cibleLabel}. Applique l'effet financier (inverse des compteurs / cibles).`}
      icon={<CheckCircle2 className="h-5 w-5" />}
      testId="confirm-cancel-dialog"
    >
      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <p
          className={`text-xs font-medium ${
            countdown.expired ? "text-red-700" : "text-amber-800"
          }`}
          data-testid="cancel-countdown"
        >
          {countdown.expired
            ? "Demande expirée"
            : `Expire dans ${countdown.label}`}
        </p>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={attestation}
            onChange={(e) => setAttestation(e.target.checked)}
            className="mt-0.5"
            disabled={countdown.expired}
            data-testid="confirm-cancel-attestation"
          />
          <span>
            {needsRemb ? (
              <>
                J&apos;atteste que le remboursement n&apos;a jamais été
                effectivement crédité ou a été annulé avant effet.
              </>
            ) : null}
            {needsRemb && needsComp ? <br /> : null}
            {needsComp ? (
              <>
                J&apos;atteste la validation de l&apos;inversion des créances
                compensées.
              </>
            ) : null}
          </span>
        </label>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={submitting || countdown.expired || !attestation}
          className="w-full"
          data-testid="submit-confirm-cancel"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Confirmer l&apos;annulation
        </Button>
      </div>
    </FraisAvancesDialogShell>
  );
}
