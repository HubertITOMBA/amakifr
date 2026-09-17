"use client";

import { useEffect, useState } from "react";
import { Gavel, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionDecideNoteFrais } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  messageErreurNoteFrais,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_BLUE_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";
import { parseMoneyToCents } from "@/lib/frais-avances/money-cents";

type DecideNoteFraisDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  expectedVersion: number;
  idempotencyKey: string;
  libelle: string;
  montantDemande: string | number;
  onDone: () => void | Promise<void>;
};

/**
 * Dialog de décision admin (valider / rejeter).
 */
export function DecideNoteFraisDialog({
  open,
  onOpenChange,
  noteId,
  expectedVersion,
  idempotencyKey,
  libelle,
  montantDemande,
  onDone,
}: DecideNoteFraisDialogProps) {
  const [outcome, setOutcome] = useState<"VALIDEE" | "REJETEE">("VALIDEE");
  const [montantAccepte, setMontantAccepte] = useState(String(montantDemande ?? ""));
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setOutcome("VALIDEE");
      setMontantAccepte(String(montantDemande ?? ""));
      setMotif("");
    }
  }, [open, montantDemande]);

  const motifRequired = (() => {
    if (outcome === "REJETEE") return true;
    if (outcome !== "VALIDEE") return false;
    try {
      return (
        parseMoneyToCents(montantAccepte) < parseMoneyToCents(montantDemande)
      );
    } catch {
      return true;
    }
  })();

  async function onDecide() {
    setSubmitting(true);
    try {
      const res = await actionDecideNoteFrais({
        noteId,
        expectedVersion,
        idempotencyKey,
        outcome,
        montantAccepte: outcome === "VALIDEE" ? montantAccepte.trim() : null,
        motif: motif.trim() || null,
      });
      if (!res.success) {
        toast.error(messageErreurNoteFrais(res.code, res.error));
        return;
      }
      toast.success(res.message || "Décision enregistrée");
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
      title="Décider de la note"
      description="Validation ou rejet par le bureau (TRESOR / ADMIN)."
      icon={<Gavel className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="decide-note-frais-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-sm h-8 sm:h-9 border-slate-300"
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void onDecide()}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm h-8 sm:h-9"
            data-testid="decide-note-frais-submit"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer la décision"
            )}
          </Button>
        </>
      }
    >
      <section className={FRAIS_AVANCES_SECTION_BLUE_CLASS}>
        <p className="text-sm font-medium text-slate-900 break-words">{libelle}</p>
        <div className="flex flex-wrap gap-2">
          <NoteFraisStatutBadge statut="SOUMISE" />
          <NoteFraisMontantBadge label="Demandé" value={montantDemande} />
        </div>
      </section>

      <section className={FRAIS_AVANCES_SECTION_CLASS}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Issue *
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Issue de la décision">
          <Button
            type="button"
            size="sm"
            variant={outcome === "VALIDEE" ? "default" : "outline"}
            className="h-8 text-sm"
            onClick={() => setOutcome("VALIDEE")}
            data-testid="decide-outcome-validee"
          >
            Valider
          </Button>
          <Button
            type="button"
            size="sm"
            variant={outcome === "REJETEE" ? "default" : "outline"}
            className="h-8 text-sm"
            onClick={() => setOutcome("REJETEE")}
            data-testid="decide-outcome-rejetee"
          >
            Rejeter
          </Button>
        </div>

        {outcome === "VALIDEE" ? (
          <div className="space-y-1">
            <Label htmlFor="nf-decide-montant" className={FRAIS_AVANCES_LABEL_CLASS}>
              Montant accepté (€) *
            </Label>
            <Input
              id="nf-decide-montant"
              type="number"
              step="0.01"
              min="0.01"
              value={montantAccepte}
              onChange={(e) => setMontantAccepte(e.target.value)}
              className={FRAIS_AVANCES_INPUT_CLASS}
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="nf-decide-motif" className={FRAIS_AVANCES_LABEL_CLASS}>
            Motif{motifRequired ? " *" : " (optionnel)"}
          </Label>
          <Textarea
            id="nf-decide-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            placeholder={motifRequired ? "Motif obligatoire" : "Commentaire facultatif"}
            className="text-sm min-h-[4.5rem] border-slate-300"
            aria-required={motifRequired}
          />
        </div>
      </section>
    </FraisAvancesDialogShell>
  );
}
