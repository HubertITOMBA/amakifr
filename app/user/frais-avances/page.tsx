"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { actionListMyNotesFrais } from "@/actions/frais-avances";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";

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
        <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 text-white rounded-t-lg">
          <CardTitle>Mes frais avancés</CardTitle>
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
          <div className="flex justify-end">
            {enabledHint ? (
              <Button asChild>
                <Link href="/user/frais-avances/nouveau">Nouveau brouillon</Link>
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
                  className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-blue-50"
                >
                  <span className="font-medium">{n.libelle}</span>
                  <span className="ml-2 text-xs uppercase text-slate-500">
                    {n.statut}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
