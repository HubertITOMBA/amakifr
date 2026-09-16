"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Gavel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { actionGetNoteFrais } from "@/actions/frais-avances";
import { DecideNoteFraisDialog } from "@/components/frais-avances/DecideNoteFraisDialog";
import {
  NoteFraisModeBadge,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";

type NoteDetail = {
  id: string;
  libelle: string;
  statut: string;
  version: number;
  montantDemande: string | number;
  montantAccepte?: string | number | null;
  motifDecision?: string | null;
  decideeAt?: string | Date | null;
  alerteSansDestinataire?: boolean;
  description?: string | null;
  Justificatifs?: { id: string; nomFichierOrig: string; statut: string }[];
  Decision?: {
    statutFinal: string;
    montantAccepte: string | number | null;
    motif: string | null;
    decideeAt: string | Date;
  } | null;
  ChoixReglementActif?: {
    mode: string;
    montantRemboursement: string | number;
    montantCompensation: string | number;
    Cibles: Array<{
      typeCible: string;
      cibleId: string;
      montantAutorise: string | number;
      libelleSnapshot: string | null;
      rang: number;
    }>;
  } | null;
};

/**
 * Consultation / décision admin d'une note soumise.
 */
export default function AdminNoteFraisDetailPage() {
  const params = useParams();
  const noteId = String(params.id || "");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [decideOpen, setDecideOpen] = useState(false);
  const [idempotencyKey] = useState(
    () => `decide-${noteId}-${Date.now()}`
  );

  const reload = useCallback(async () => {
    const res = await actionGetNoteFrais(noteId);
    if (!res.success) {
      setError(res.error);
      setNote(null);
      return;
    }
    const data = res.data as NoteDetail;
    setNote(data);
    setError(null);
  }, [noteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const decided =
    note?.statut === "VALIDEE" || note?.statut === "REJETEE";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-2xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 text-white rounded-t-lg pt-4 sm:pt-5">
          <CardTitle className="text-white">{note?.libelle || "Note de frais"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {note ? (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <NoteFraisStatutBadge statut={note.statut} />
                <NoteFraisMontantBadge
                  label="Demandé"
                  value={note.montantDemande}
                />
              </div>
              {note.alerteSansDestinataire ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Alerte : aucun destinataire habilité au moment de la
                  soumission (prise en charge organisationnelle — pas une
                  erreur technique).
                </p>
              ) : null}
              {decided ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Décision
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <NoteFraisStatutBadge statut={note.statut} />
                    {note.montantAccepte != null ? (
                      <NoteFraisMontantBadge
                        label="Accepté"
                        value={note.montantAccepte}
                      />
                    ) : null}
                  </div>
                  {note.motifDecision ? (
                    <p className="whitespace-pre-wrap">
                      Motif : {note.motifDecision}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {note.ChoixReglementActif ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    <NoteFraisModeBadge mode={note.ChoixReglementActif.mode} />
                    <NoteFraisMontantBadge
                      label="Remboursement"
                      value={note.ChoixReglementActif.montantRemboursement}
                    />
                    <NoteFraisMontantBadge
                      label="Compensation"
                      value={note.ChoixReglementActif.montantCompensation}
                    />
                  </div>
                  {note.ChoixReglementActif.Cibles?.length ? (
                    <ul className="text-xs space-y-1 list-disc pl-4">
                      {note.ChoixReglementActif.Cibles.map((c) => (
                        <li key={`${c.typeCible}:${c.cibleId}`}>
                          {c.libelleSnapshot || c.cibleId} —{" "}
                          {String(c.montantAutorise)} €
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-xs text-slate-600">
                    Lecture seule — aucun règlement exécuté à ce stade.
                  </p>
                </div>
              ) : note.statut === "VALIDEE" ? (
                <p className="text-sm text-slate-600">
                  Aucun choix de règlement enregistré par l&apos;adhérent.
                </p>
              ) : null}
              {note.description ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">
                    Description
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{note.description}</p>
                </div>
              ) : null}
              <ul className="text-sm space-y-1">
                {note.Justificatifs?.filter((j) => j.statut === "READY").map(
                  (j) => (
                    <li
                      key={j.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
                    >
                      <span className="min-w-0 break-all">{j.nomFichierOrig}</span>
                      <a
                        className="text-blue-700 underline text-xs shrink-0"
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
              {note.statut === "SOUMISE" ? (
                <Button
                  type="button"
                  onClick={() => setDecideOpen(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                  data-testid="open-decide-note-frais"
                >
                  <Gavel className="h-4 w-4 mr-2" />
                  Décider
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {note ? (
        <DecideNoteFraisDialog
          open={decideOpen}
          onOpenChange={setDecideOpen}
          noteId={noteId}
          expectedVersion={note.version}
          idempotencyKey={idempotencyKey}
          libelle={note.libelle}
          montantDemande={note.montantDemande}
          onDone={reload}
        />
      ) : null}
    </div>
  );
}
