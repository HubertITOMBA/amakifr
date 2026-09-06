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
  status: string;
  onSuccess?: () => void;
};

/**
 * Édition des dates d'un sondage (brouillon ou ouvert) sans toucher aux réponses.
 */
export function SondageDatesEditor({
  sondageId,
  dateDebut,
  dateFin,
  status,
  onSuccess,
}: Props) {
  const [debut, setDebut] = useState(toDatetimeLocalValue(dateDebut));
  const [fin, setFin] = useState(toDatetimeLocalValue(dateFin));
  const [saving, setSaving] = useState(false);

  if (status === "Cloture") {
    return (
      <p className="text-sm text-muted-foreground">
        Les dates d&apos;un sondage clôturé ne sont pas modifiables.
      </p>
    );
  }

  async function onSave() {
    setSaving(true);
    try {
      const res = await updateSondageDates({
        id: sondageId,
        dateDebut: new Date(debut),
        dateFin: new Date(fin),
      });
      if (!res.success) {
        toast.error(res.error || "Erreur");
        return;
      }
      toast.success(res.message || "Dates mises à jour");
      onSuccess?.();
    } catch {
      toast.error("Erreur lors de la mise à jour des dates");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <CalendarClock className="h-4 w-4 text-blue-600" />
        Modifier les dates
      </div>
      <p className="text-xs text-muted-foreground">
        Les réponses déjà enregistrées sont conservées. Les questions ne sont pas
        modifiées.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="sondage-date-debut" className="text-xs">
            Date de début
          </Label>
          <Input
            id="sondage-date-debut"
            type="datetime-local"
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
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="bg-blue-600 hover:bg-blue-700"
        disabled={saving}
        onClick={() => void onSave()}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : null}
        Enregistrer les dates
      </Button>
    </div>
  );
}
