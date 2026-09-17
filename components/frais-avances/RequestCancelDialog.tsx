"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Loader2 } from "lucide-react";
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
import { actionRequestNoteFraisReglementAnnulation } from "@/actions/frais-avances";
import { toast } from "react-toastify";
import { messageErreurNoteFrais } from "@/components/frais-avances/note-frais-badges";
import {
  FRAIS_AVANCES_INPUT_CLASS,
  FRAIS_AVANCES_LABEL_CLASS,
  FRAIS_AVANCES_SECTION_CLASS,
  FraisAvancesDialogShell,
} from "@/components/frais-avances/FraisAvancesDialogShell";

type PreuveKind =
  | "REJET_BANQUE"
  | "ANNULATION_VIREMENT"
  | "RECU_CAISSE_ANNULE"
  | "TRACE_ETABLISSEMENT"
  | "PV_TRESORERIE"
  | "JUSTIFICATIF_INTERNE"
  | "AUTRE_TRACE";

type Cible = {
  reglementId?: string;
  operationId?: string;
  type: "REMBOURSEMENT" | "COMPENSATION" | "MIXTE";
  label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  idempotencyKey: string;
  cibles: Cible[];
  onDone: () => void | Promise<void>;
};

const PREUVES_REMBOURSEMENT: { value: PreuveKind; label: string }[] = [
  { value: "REJET_BANQUE", label: "Rejet banque" },
  { value: "ANNULATION_VIREMENT", label: "Annulation virement" },
  { value: "RECU_CAISSE_ANNULE", label: "Reçu caisse annulé" },
  { value: "TRACE_ETABLISSEMENT", label: "Trace établissement" },
  { value: "AUTRE_TRACE", label: "Autre trace" },
];

const PREUVES_COMPENSATION: { value: PreuveKind; label: string }[] = [
  { value: "PV_TRESORERIE", label: "PV trésorerie" },
  { value: "JUSTIFICATIF_INTERNE", label: "Justificatif interne" },
  { value: "AUTRE_TRACE", label: "Autre trace" },
];

/**
 * Dialog de demande d'annulation (lot 4.8) — sans effet financier.
 */
export function RequestCancelDialog({
  open,
  onOpenChange,
  noteId,
  idempotencyKey,
  cibles,
  onDone,
}: Props) {
  const [cibleKey, setCibleKey] = useState("");
  const [motif, setMotif] = useState("");
  const [preuveKind, setPreuveKind] = useState<PreuveKind | "">("");
  const [preuveRef, setPreuveRef] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () =>
      cibles.find((c) =>
        c.operationId
          ? `op:${c.operationId}` === cibleKey
          : `reg:${c.reglementId}` === cibleKey
      ) ?? null,
    [cibles, cibleKey]
  );

  const preuves = useMemo(() => {
    if (!selected) return [];
    if (selected.type === "COMPENSATION") return PREUVES_COMPENSATION;
    return PREUVES_REMBOURSEMENT;
  }, [selected]);

  useEffect(() => {
    if (open) {
      setCibleKey(
        cibles[0]
          ? cibles[0].operationId
            ? `op:${cibles[0].operationId}`
            : `reg:${cibles[0].reglementId}`
          : ""
      );
      setMotif("");
      setPreuveKind("");
      setPreuveRef("");
      setConfirm(false);
    }
  }, [open, cibles]);

  useEffect(() => {
    setPreuveKind("");
  }, [cibleKey]);

  async function onConfirm() {
    if (!selected) {
      toast.warning("Sélectionnez une cible");
      return;
    }
    if (!preuveKind) {
      toast.warning("Sélectionnez une preuve");
      return;
    }
    if (!confirm) {
      toast.warning("Cochez la confirmation avant de demander");
      return;
    }
    setSubmitting(true);
    try {
      const result = await actionRequestNoteFraisReglementAnnulation({
        noteId,
        reglementId: selected.reglementId ?? null,
        operationId: selected.operationId ?? null,
        idempotencyKey,
        motif,
        preuveKind,
        preuveRef,
      });
      if (!result.success) {
        toast.error(messageErreurNoteFrais(result.code, result.error));
        return;
      }
      toast.success(result.message || "Demande d'annulation enregistrée");
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la demande"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FraisAvancesDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Demander une annulation"
      description="Double validation requise. Aucun effet financier tant que la demande n'est pas confirmée. Expire sous 30 jours."
      icon={<Ban className="h-5 w-5" />}
      testId="request-cancel-dialog"
    >
      <div className={FRAIS_AVANCES_SECTION_CLASS}>
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>Cible</Label>
          <Select value={cibleKey || undefined} onValueChange={setCibleKey}>
            <SelectTrigger className={FRAIS_AVANCES_INPUT_CLASS}>
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {cibles.map((c) => {
                const key = c.operationId
                  ? `op:${c.operationId}`
                  : `reg:${c.reglementId}`;
                return (
                  <SelectItem key={key} value={key}>
                    {c.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="annul-motif" className={FRAIS_AVANCES_LABEL_CLASS}>
            Motif
          </Label>
          <Textarea
            id="annul-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <Label className={FRAIS_AVANCES_LABEL_CLASS}>Type de preuve</Label>
          <Select
            value={preuveKind || undefined}
            onValueChange={(v) => setPreuveKind(v as PreuveKind)}
          >
            <SelectTrigger className={FRAIS_AVANCES_INPUT_CLASS}>
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {preuves.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="annul-preuve-ref" className={FRAIS_AVANCES_LABEL_CLASS}>
            Référence de preuve (8–64, sans PII)
          </Label>
          <Input
            id="annul-preuve-ref"
            value={preuveRef}
            onChange={(e) => setPreuveRef(e.target.value)}
            className={FRAIS_AVANCES_INPUT_CLASS}
            autoComplete="off"
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
            Je confirme que cette demande d&apos;annulation est justifiée et
            qu&apos;un autre trésorier/admin devra la valider.
          </span>
        </label>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={submitting || cibles.length === 0}
          className="w-full"
          data-testid="submit-request-cancel"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Enregistrer la demande
        </Button>
      </div>
    </FraisAvancesDialogShell>
  );
}
