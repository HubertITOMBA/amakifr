"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { actionListNotesFraisArchives } from "@/actions/frais-avances";

type ArchiveRow = {
  id: string;
  dateDepense: string | Date;
  montantDemande: string | number;
  archivedAt: string | Date;
  retentionEndsAt: string | Date;
  reidentifiabilityNotice: string;
};

/**
 * Liste archive privée des notes soumises (données potentiellement personnelles).
 * Accès : ADMIN | TRESOR | COMCPT actifs.
 */
export default function AdminFraisAvancesArchivesPage() {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await actionListNotesFraisArchives();
      if (!res.success) {
        setError(res.error);
        setRows([]);
        return;
      }
      setRows(res.data as ArchiveRow[]);
      setError(null);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-5xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-lg space-y-2">
          <CardTitle>Archive privée — notes de frais</CardTitle>
          <p className="text-sm text-slate-200 font-normal">
            Archive privée contenant des données potentiellement personnelles
            (date et montant réidentifiables). Ce n&apos;est pas une archive
            anonyme.
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-3">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="space-y-2">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/frais-avances/archives/${a.id}`}
                  className="block rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium">
                    {String(a.montantDemande)} € —{" "}
                    {new Date(a.dateDepense).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Archivée le{" "}
                    {new Date(a.archivedAt).toLocaleString("fr-FR")} · fin
                    conservation{" "}
                    {new Date(a.retentionEndsAt).toLocaleString("fr-FR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {rows.length === 0 && !error ? (
            <p className="text-sm text-slate-600">Aucune archive.</p>
          ) : null}
          <Link
            href="/admin/frais-avances"
            className="text-sm text-blue-700 underline"
          >
            Retour aux notes soumises
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
