"use client";

import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionRefuseNoteFraisReglementAnnulation } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import { messageErreurNoteFrais } from "@/components/frais-avances/note-frais-badges";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";
import { useExpiresCountdown } from "@/components/frais-avances/useExpiresCountdown";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  demandeId: string;
  decisionIdempotencyKey: string;
  expiresAt: string;
  cibleLabel: string;
  onDone: () => void | Promise<void>;
};

/**
 * Dialog de refus d'annulation (lot 4.8) — sans effet financier.
 */
export function RefuseCancelDialog({
  open,
  onOpenChange,
  noteId,
  demandeId,
  decisionIdempotencyKey,
  expiresAt,
  cibleLabel,
  onDone,
}: Props) {
  const [decisionMotif, setDecisionMotif] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const countdown = useExpiresCountdown(open ? expiresAt : null);

  useEffect(() => {
    if (open) {
      setDecisionMotif("");
      setConfirm(false);
    }
  }, [open]);

  async function onConfirm() {
    if (countdown.expired) {
      toast.error("Cette demande a expiré");
      return;
    }
    if (!confirm) {
      toast.warning("Cochez la confirmation avant de refuser");
      return;
    }
    setSubmitting(true);
    try {
      const result = await actionRefuseNoteFraisReglementAnnulation({
        noteId,
        demandeId,
        decisionIdempotencyKey,
        decisionMotif,
      });
      if (!result.success) {
        toast.error(messageErreurNoteFrais(result.code, result.error));
        return;
      }
      toast.success(result.message || "Annulation refusée");
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du refus");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Refuser l'annulation"
      description={`Cible : ${cibleLabel}. Aucun effet financier.`}
      icon={<XCircle className="h-5 w-5" />}
      testId="refuse-cancel-dialog"
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
        <div className="space-y-1">
          <Label htmlFor="refuse-motif" className={FRAIS_AVANCES_LABEL_CLASS}>
            Motif du refus
          </Label>
          <Textarea
            id="refuse-motif"
            value={decisionMotif}
            onChange={(e) => setDecisionMotif(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            rows={3}
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            className="mt-0.5"
            disabled={countdown.expired}
          />
          <span>Je confirme le refus de cette demande d&apos;annulation.</span>
        </label>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={submitting || countdown.expired}
          className="w-full"
          data-testid="submit-refuse-cancel"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Refuser
        </Button>
      </div>
    </FraisAvancesDialogShell>
  );
}
