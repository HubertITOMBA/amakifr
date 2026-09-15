"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actionDeleteNoteFraisJustificatif,
  actionGetNoteFrais,
  actionSubmitNoteFrais,
  actionUploadNoteFraisJustificatif,
} from "@/actions/frais-avances";
import { toast } from "react-toastify";

type Justificatif = {
  id: string;
  statut: string;
  nomFichierOrig: string;
};

/**
 * Détail / dépôt PJ / soumission d'une note membre.
 */
export default function UserNoteFraisDetailPage() {
  const params = useParams();
  const noteId = String(params.id || "");
  const [note, setNote] = useState<{
    id: string;
    libelle: string;
    statut: string;
    version: number;
    Justificatifs: Justificatif[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [idempotencyKey] = useState(() => `submit-${noteId}-${Date.now()}`);

  const reload = useCallback(async () => {
    const res = await actionGetNoteFrais(noteId);
    if (!res.success) {
      setError(res.error);
      setNote(null);
      return;
    }
    setNote(res.data as typeof note);
    setError(null);
  }, [noteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onUpload(file: File | null) {
    if (!file || !note) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("noteId", noteId);
      fd.append("expectedVersion", String(note.version));
      fd.append("file", file);
      const res = await actionUploadNoteFraisJustificatif(fd);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Justificatif ajouté");
      await reload();
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(justificatifId: string) {
    if (!note) return;
    const res = await actionDeleteNoteFraisJustificatif({
      noteId,
      justificatifId,
      expectedVersion: note.version,
    });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Pièce supprimée");
    await reload();
  }

  async function onSubmit() {
    if (!note) return;
    const res = await actionSubmitNoteFrais({
      noteId,
      idempotencyKey,
      expectedVersion: note.version,
    });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message || "Soumise");
    await reload();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-2xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white rounded-t-lg">
          <CardTitle>{note?.libelle || "Note de frais"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {note ? (
            <>
              <p className="text-sm">
                Statut : <strong>{note.statut}</strong>
              </p>
              <ul className="text-sm space-y-2">
                {note.Justificatifs?.map((j) => (
                  <li
                    key={j.id}
                    className="flex flex-wrap items-center gap-2 justify-between"
                  >
                    <span>
                      {j.nomFichierOrig} — {j.statut}
                    </span>
                    <span className="flex gap-2">
                      {j.statut === "READY" ? (
                        <a
                          className="text-blue-700 underline text-xs"
                          href={`/api/frais-avances/justificatifs/${j.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Télécharger
                        </a>
                      ) : null}
                      {note.statut === "BROUILLON" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => void onDelete(j.id)}
                        >
                          Supprimer
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {note.statut === "BROUILLON" ? (
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={(e) =>
                      void onUpload(e.target.files?.[0] ?? null)
                    }
                  />
                  <Button type="button" onClick={() => void onSubmit()}>
                    Soumettre
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
