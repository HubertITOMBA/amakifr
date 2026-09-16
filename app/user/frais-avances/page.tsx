"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { actionListMyNotesFrais } from "@/actions/frais-avances";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";
import { CreateNoteFraisDraftDialog } from "@/components/frais-avances/CreateNoteFraisDraftDialog";
import { NoteFraisStatutBadge } from "@/components/frais-avances/note-frais-badges";

type NoteRow = {
  id: string;
  libelle: string;
  statut: string;
  montantDemande: unknown;
  updatedAt: string | Date;
};

/**
 * Liste membre des notes de frais (étape 1).
 */
export default function UserFraisAvancesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const enabledHint = isNotesFraisEnabledClientHint();

  useEffect(() => {
    void (async () => {
      const res = await actionListMyNotesFrais();
      if (!res.success) {
        setError(res.error);
        setNotes([]);
        return;
      }
      setNotes(res.data as NoteRow[]);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-4xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 text-white rounded-t-lg pt-4 sm:pt-5">
          <CardTitle className="text-white">Mes frais avancés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {!enabledHint ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
              Module désactivé (NOTES_FRAIS_ENABLED≠true). Les actions serveur
              refusent explicitement toute opération.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            {enabledHint ? (
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
                data-testid="open-create-note-frais-draft"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau brouillon
              </Button>
            ) : (
              <Button type="button" disabled>
                Nouveau brouillon
              </Button>
            )}
          </div>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/user/frais-avances/${n.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-blue-50"
                >
                  <span className="font-medium">{n.libelle}</span>
                  <NoteFraisStatutBadge statut={n.statut} />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <CreateNoteFraisDraftDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
