"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { actionGetNoteFrais } from "@/actions/frais-avances";

/**
 * Consultation admin d'une note soumise (pas de décision financière en étape 1).
 */
export default function AdminNoteFraisDetailPage() {
  const params = useParams();
  const noteId = String(params.id || "");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{
    libelle: string;
    statut: string;
    alerteSansDestinataire?: boolean;
    description?: string | null;
    Justificatifs?: { id: string; nomFichierOrig: string; statut: string }[];
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await actionGetNoteFrais(noteId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setNote(res.data as typeof note);
    })();
  }, [noteId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-2xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white rounded-t-lg">
          <CardTitle>{note?.libelle || "Note de frais"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {note ? (
            <>
              <p className="text-sm">Statut : {note.statut}</p>
              {note.alerteSansDestinataire ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Alerte : aucun destinataire habilité au moment de la
                  soumission (prise en charge organisationnelle — pas une
                  erreur technique).
                </p>
              ) : null}
              <p className="text-sm whitespace-pre-wrap">{note.description}</p>
              <ul className="text-sm space-y-1">
                {note.Justificatifs?.filter((j) => j.statut === "READY").map(
                  (j) => (
                    <li key={j.id}>
                      {j.nomFichierOrig}{" "}
                      <a
                        className="text-blue-700 underline text-xs"
                        href={`/api/frais-avances/justificatifs/${j.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Télécharger
                      </a>
                    </li>
                  )
                )}
              </ul>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
