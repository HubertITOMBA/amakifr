"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Loader2 } from "lucide-react";
import { updateSondageDates } from "@/actions/sondages";
import { toast } from "react-toastify";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  sondageId: string;
  dateDebut: string;
  dateFin: string;
  /** Statut effectif (Ouvert | Cloture | Brouillon) — pas seulement le statut DB. */
  statusEffectif: string;
  onSuccess?: () => void;
};

/**
 * Édition des dates d'un sondage encore ouvert (effectif).
 * Isolé dans son propre formulaire pour ne jamais croiser
 * l’action d’autorisation des résultats collectifs.
 */
export function SondageDatesEditor({
  sondageId,
  dateDebut,
  dateFin,
  statusEffectif,
  onSuccess,
}: Props) {
  const [debut, setDebut] = useState(toDatetimeLocalValue(dateDebut));
  const [fin, setFin] = useState(toDatetimeLocalValue(dateFin));
  const [saving, setSaving] = useState(false);

  if (statusEffectif === "Cloture") {
    return (
      <p className="text-sm text-muted-foreground">
        Les dates d&apos;un sondage terminé ne sont pas modifiables.
      </p>
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    try {
      const res = await updateSondageDates({
        id: sondageId,
        dateDebut: new Date(debut),
        dateFin: new Date(fin),
      });
      if (!res.success) {
        toast.error(res.error || "Impossible de mettre à jour les dates");
        return;
      }
      toast.success(res.message || "Dates mises à jour");
      onSuccess?.();
    } catch {
      toast.error("Impossible de mettre à jour les dates");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-3" noValidate>
      <p className="text-xs text-slate-600 flex items-start gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 mt-0.5 text-blue-700 shrink-0" />
        Les réponses déjà enregistrées sont conservées. Les questions ne sont
        pas modifiées.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
        <div className="space-y-1">
          <Label htmlFor="sondage-date-debut" className="text-xs">
            Date de début
          </Label>
          <Input
            id="sondage-date-debut"
            type="datetime-local"
            className="max-w-xs"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sondage-date-fin" className="text-xs">
            Date de fin
          </Label>
          <Input
            id="sondage-date-fin"
            type="datetime-local"
            className="max-w-xs"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </div>
      </div>
      <Button
        type="submit"
        size="sm"
        className="bg-blue-700 text-white hover:bg-blue-800 font-semibold"
        disabled={saving}
      >
        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
        Enregistrer les dates
      </Button>
    </form>
  );
}
