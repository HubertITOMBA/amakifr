"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { actionListMyNotesFrais } from "@/actions/frais-avances";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";
import { CreateNoteFraisDraftDialog } from "@/components/frais-avances/CreateNoteFraisDraftDialog";
import {
  NoteFraisEtatFinancierBadge,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";

type NoteRow = {
  id: string;
  libelle: string;
  statut: string;
  montantDemande: string | number;
  montantAccepte?: string | number | null;
  etatFinancier?: string;
  restantDu?: string;
  ChoixReglementActif?: {
    montantRembourseUtilise: string | number;
    montantCompensationUtilise: string | number;
  } | null;
};

/**
 * Liste membre des notes de frais.
 */
export default function UserFraisAvancesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const enabledHint = isNotesFraisEnabledClientHint();

  useEffect(() => {
    if (!enabledHint) {
      setNotes([]);
      return;
    }
    void (async () => {
      const res = await actionListMyNotesFrais();
      if (!res.success) {
        setError(res.error);
        setNotes([]);
        return;
      }
      setNotes(res.data as NoteRow[]);
    })();
  }, [enabledHint]);

  if (!enabledHint) {
    return (
      <div className="p-4 sm:p-8">
        <p
          className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3"
          role="status"
        >
          Module indisponible. Les frais avancés ne sont pas activés.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-4xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 text-white rounded-t-lg pt-4 sm:pt-5">
          <CardTitle className="text-white">Mes frais avancés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
              data-testid="open-create-note-frais-draft"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nouveau brouillon
            </Button>
          </div>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/user/frais-avances/${n.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 hover:bg-blue-50/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{n.libelle}</span>
                    <NoteFraisStatutBadge statut={n.statut} />
                    {n.etatFinancier ? (
                      <NoteFraisEtatFinancierBadge etat={n.etatFinancier} />
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <NoteFraisMontantBadge
                      label="Demandé"
                      value={String(n.montantDemande)}
                    />
                    {n.montantAccepte != null ? (
                      <NoteFraisMontantBadge
                        label="Accepté"
                        value={String(n.montantAccepte)}
                      />
                    ) : null}
                    {n.restantDu != null ? (
                      <NoteFraisMontantBadge
                        label="Restant"
                        value={n.restantDu}
                      />
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <CreateNoteFraisDraftDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
        </CardContent>
      </Card>
    </div>
  );
}
