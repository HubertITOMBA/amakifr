"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { actionGetNotesFraisArchive } from "@/actions/frais-avances";

type ArchiveDetail = {
  id: string;
  dateDepense: string | Date;
  montantDemande: string | number;
  soumiseAt: string | Date;
  statutFinal?: string;
  montantAccepte?: string | number | null;
  decideeAt?: string | Date | null;
  archivedAt: string | Date;
  retentionEndsAt: string | Date;
  reidentifiabilityNotice: string;
  Justificatifs: Array<{
    id: string;
    rang: number;
    typeMime: string;
    taille: number;
    statut: string;
  }>;
};

/**
 * Détail archive privée + téléchargement READY uniquement.
 */
export default function AdminFraisAvancesArchiveDetailPage() {
  const params = useParams();
  const archiveId = String(params?.id || "");
  const [data, setData] = useState<ArchiveDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!archiveId) return;
    void (async () => {
      const res = await actionGetNotesFraisArchive(archiveId);
      if (!res.success) {
        setError(res.error);
        setData(null);
        return;
      }
      setData(res.data as ArchiveDetail);
      setError(null);
    })();
  }, [archiveId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-3xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-lg space-y-1">
          <CardTitle>Archive privée</CardTitle>
          <p className="text-sm text-slate-200 font-normal">
            Données potentiellement personnelles — pas une archive anonyme.
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {data ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-semibold">Montant :</span>{" "}
                {String(data.montantDemande)} €
              </p>
              {data.statutFinal ? (
                <p>
                  <span className="font-semibold">Statut final :</span>{" "}
                  {data.statutFinal}
                </p>
              ) : null}
              {data.montantAccepte != null ? (
                <p>
                  <span className="font-semibold">Montant accepté :</span>{" "}
                  {String(data.montantAccepte)} €
                </p>
              ) : null}
              <p>
                <span className="font-semibold">Date dépense :</span>{" "}
                {new Date(data.dateDepense).toLocaleDateString("fr-FR")}
              </p>
              <p>
                <span className="font-semibold">Soumise le :</span>{" "}
                {new Date(data.soumiseAt).toLocaleString("fr-FR")}
              </p>
              <p>
                <span className="font-semibold">Archivée le :</span>{" "}
                {new Date(data.archivedAt).toLocaleString("fr-FR")}
              </p>
              <p>
                <span className="font-semibold">Fin conservation :</span>{" "}
                {new Date(data.retentionEndsAt).toLocaleString("fr-FR")}
              </p>
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                Notice : {data.reidentifiabilityNotice}
              </p>
              <ul className="space-y-2">
                {data.Justificatifs.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
                  >
                    <span>
                      justificatif-{j.rang}{" "}
                      <span className="text-xs text-slate-500">
                        ({j.statut})
                      </span>
                    </span>
                    {j.statut === "READY" ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`/api/frais-avances/archives/justificatifs/${j.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Télécharger
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">
                        En attente de déplacement
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link
            href="/admin/frais-avances/archives"
            className="text-sm text-blue-700 underline"
          >
            Retour à la liste des archives
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
