"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { actionListAdminNotesFrais } from "@/actions/frais-avances";

type AdminNote = {
  id: string;
  libelle: string;
  alerteSansDestinataire: boolean;
  soumiseAt: string | Date | null;
  Adherent?: { firstname: string; lastname: string };
};

/**
 * Liste admin des notes soumises (badge alerte sans destinataire).
 */
export default function AdminFraisAvancesPage() {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [onlyAlerte, setOnlyAlerte] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await actionListAdminNotesFrais({
        onlyAlerteSansDestinataire: onlyAlerte,
      });
      if (!res.success) {
        setError(res.error);
        setNotes([]);
        return;
      }
      setNotes(res.data as AdminNote[]);
      setError(null);
    })();
  }, [onlyAlerte]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-5xl border-blue-200 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white rounded-t-lg">
          <CardTitle>Notes de frais soumises</CardTitle>
          <div className="flex gap-2">
            <Link href="/admin/frais-avances/archives">
              <Button type="button" variant="secondary" className="text-slate-900">
                Archives privées
              </Button>
            </Link>
            <Button
            type="button"
            variant={onlyAlerte ? "secondary" : "outline"}
            className="text-slate-900"
            onClick={() => setOnlyAlerte((v) => !v)}
          >
            {onlyAlerte ? "Toutes" : "Sans destinataire"}
          </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-2">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/admin/frais-avances/${n.id}`}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-blue-50"
                >
                  <span>
                    <span className="font-medium">{n.libelle}</span>
                    {n.Adherent ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {n.Adherent.firstname} {n.Adherent.lastname}
                      </span>
                    ) : null}
                  </span>
                  {n.alerteSansDestinataire ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Sans destinataire
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
