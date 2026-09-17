"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionExecuteNoteFraisRemboursement } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import {
  messageErreurNoteFrais,
  NoteFraisMontantBadge,
} from "@/components/frais-avances/note-frais-badges";
import { datetimeLocalToIso } from "@/lib/frais-avances/datetime-local";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_BLUE_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type ExecuteRemboursementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  expectedVersion: number;
  idempotencyKey: string;
  /** Plafond restant en chaîne monétaire (ex. "40.00"). */
  plafondRestant: string;
  onDone: () => void | Promise<void>;
};

/**
 * Dialog minimal d'exécution d'un remboursement (TRESOR/ADMIN).
 */
export function ExecuteRemboursementDialog({
  open,
  onOpenChange,
  noteId,
  expectedVersion,
  idempotencyKey,
  plafondRestant,
  onDone,
}: ExecuteRemboursementDialogProps) {
  const [montant, setMontant] = useState(plafondRestant);
  const [moyen, setMoyen] = useState<"VIREMENT" | "ESPECES">("VIREMENT");
  const [reference, setReference] = useState("");
  const [executeLocal, setExecuteLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tzLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
    } catch {
      return "local";
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMontant(plafondRestant);
      setMoyen("VIREMENT");
      setReference("");
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setExecuteLocal(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
      );
    }
  }, [open, plafondRestant]);

  async function onConfirm() {
    setSubmitting(true);
    try {
      let executeAt: string;
      try {
        executeAt = datetimeLocalToIso(executeLocal);
      } catch {
        toast.error("Date/heure d'exécution invalide");
        return;
      }
      const res = await actionExecuteNoteFraisRemboursement({
        noteId,
        expectedNoteVersion: expectedVersion,
        idempotencyKey,
        montant,
        moyen,
        reference,
        executeAt,
      });
      if (!res.success) {
        toast.error(messageErreurNoteFrais(res.code, res.error));
        return;
      }
      toast.success(res.message || "Remboursement enregistré");
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
      title="Exécuter un remboursement"
      description={`Décaissement bancaire ou caisse (fuseau navigateur : ${tzLabel}). La date est convertie en UTC côté serveur.`}
      icon={<Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
      testId="execute-remboursement-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm()}
            aria-busy={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
            ) : null}
            Confirmer le remboursement
          </Button>
        </>
      }
    >
      <div className={FRAIS_AVANCES_SECTION_BLUE_CLASS}>
        <NoteFraisMontantBadge
          label="Plafond restant"
          value={plafondRestant}
        />
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Partiels autorisés jusqu&apos;au plafond du choix ACTIF.
        </p>
      </div>

      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <div className="space-y-1">
          <Label htmlFor="remb-montant" className={FRAIS_AVANCES_LABEL_CLASS}>
            Montant (€)
          </Label>
          <Input
            id="remb-montant"
            inputMode="decimal"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            aria-required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="remb-moyen" className={FRAIS_AVANCES_LABEL_CLASS}>
            Moyen
          </Label>
          <Select
            value={moyen}
            onValueChange={(v) => setMoyen(v as "VIREMENT" | "ESPECES")}
          >
            <SelectTrigger id="remb-moyen" className={FRAIS_AVANCES_INPUT_CLASS}>
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIREMENT">Virement</SelectItem>
              <SelectItem value="ESPECES">Espèces</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="remb-ref" className={FRAIS_AVANCES_LABEL_CLASS}>
            {moyen === "ESPECES"
              ? "N° / référence de reçu"
              : "Référence bancaire"}
          </Label>
          <Input
            id="remb-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            maxLength={64}
            autoComplete="off"
            aria-required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="remb-date" className={FRAIS_AVANCES_LABEL_CLASS}>
            Date et heure d&apos;exécution
          </Label>
          <Input
            id="remb-date"
            type="datetime-local"
            value={executeLocal}
            onChange={(e) => setExecuteLocal(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            aria-required
            aria-describedby="remb-date-help"
          />
          <p id="remb-date-help" className="text-xs text-slate-500">
            Saisie en heure locale ({tzLabel}), envoyée en ISO UTC. Tolérance
            serveur : jusqu&apos;à +5 minutes.
          </p>
        </div>
      </div>
    </FraisAvancesDialogShell>
  );
}
