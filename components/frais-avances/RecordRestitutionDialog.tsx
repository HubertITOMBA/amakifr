"use client";

import { useEffect, useState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionRecordNoteFraisRestitution } from "@/actions/frais-avances";
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
  resteRestituable: string;
  onDone: () => void | Promise<void>;
};

/**
 * Dialog d'enregistrement d'une restitution réelle (lot 4.7).
 */
export function RecordRestitutionDialog({
  open,
  onOpenChange,
  noteId,
  reglementId,
  expectedVersion,
  idempotencyKey,
  resteRestituable,
  onDone,
}: Props) {
  const [montant, setMontant] = useState(resteRestituable);
  const [moyen, setMoyen] = useState<"VIREMENT" | "ESPECES">("VIREMENT");
  const [reference, setReference] = useState("");
  const [dateRestitution, setDateRestitution] = useState("");
  const [motif, setMotif] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMontant(resteRestituable);
      setMoyen("VIREMENT");
      setReference("");
      setMotif("");
      setConfirm(false);
      const now = new Date();
      setDateRestitution(now.toISOString().slice(0, 19) + "Z");
    }
  }, [open, resteRestituable]);

  async function onConfirm() {
    if (!confirm) {
      toast.warning("Cochez la confirmation avant d'enregistrer");
      return;
    }
    setSubmitting(true);
    try {
      const result = await actionRecordNoteFraisRestitution({
        noteId,
        reglementId,
        expectedNoteVersion: expectedVersion,
        idempotencyKey,
        montant,
        moyen,
        reference,
        dateRestitution,
        motif,
      });
      if (!result.success) {
        toast.error(messageErreurNoteFrais(result.code, result.error));
        return;
      }
      toast.success(result.message || "Restitution enregistrée");
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la restitution"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Enregistrer une restitution"
      description={`Reste restituable : ${resteRestituable} €. Entrée bancaire réelle — distincte d'une correction.`}
      icon={<Banknote className="h-5 w-5" />}
    >
      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <div className="space-y-1">
          <Label htmlFor="rest-montant" className={FRAIS_AVANCES_LABEL_CLASS}>
            Montant (€)
          </Label>
          <Input
            id="rest-montant"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            inputMode="decimal"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>Moyen</Label>
          <Select
            value={moyen}
            onValueChange={(v) => setMoyen(v as "VIREMENT" | "ESPECES")}
          >
            <SelectTrigger className={FRAIS_AVANCES_INPUT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIREMENT">Virement</SelectItem>
              <SelectItem value="ESPECES">Espèces (reçu/caisse)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rest-ref" className={FRAIS_AVANCES_LABEL_CLASS}>
            Référence
          </Label>
          <Input
            id="rest-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            placeholder={
              moyen === "ESPECES" ? "N° reçu / caisse" : "Réf. virement"
            }
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rest-date" className={FRAIS_AVANCES_LABEL_CLASS}>
            Date (ISO avec fuseau)
          </Label>
          <Input
            id="rest-date"
            value={dateRestitution}
            onChange={(e) => setDateRestitution(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rest-motif" className={FRAIS_AVANCES_LABEL_CLASS}>
            Motif
          </Label>
          <Textarea
            id="rest-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
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
          />
          <span>
            Je confirme que ce montant est bien revenu à l&apos;association
            (entrée bancaire réelle, pas une correction d&apos;erreur).
          </span>
        </label>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="w-full"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Enregistrer la restitution
        </Button>
      </div>
    </FraisAvancesDialogShell>
  );
}
