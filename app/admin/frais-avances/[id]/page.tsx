"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actionDecideNoteFrais,
  actionGetNoteFrais,
} from "@/actions/frais-avances";
import { toast } from "react-toastify";

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
  const [outcome, setOutcome] = useState<"VALIDEE" | "REJETEE">("VALIDEE");
  const [montantAccepte, setMontantAccepte] = useState("");
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    setMontantAccepte(String(data.montantDemande ?? ""));
    setError(null);
  }, [noteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onDecide() {
    if (!note) return;
    setSubmitting(true);
    try {
      const res = await actionDecideNoteFrais({
        noteId,
        expectedVersion: note.version,
        idempotencyKey,
        outcome,
        montantAccepte:
          outcome === "VALIDEE" ? Number(montantAccepte) : null,
        motif: motif.trim() || null,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message || "Décision enregistrée");
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  const decided =
    note?.statut === "VALIDEE" || note?.statut === "REJETEE";

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
              <p className="text-sm">
                Statut : <strong>{note.statut}</strong>
              </p>
              <p className="text-sm">
                Montant demandé : {String(note.montantDemande)} €
              </p>
              {note.alerteSansDestinataire ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Alerte : aucun destinataire habilité au moment de la
                  soumission (prise en charge organisationnelle — pas une
                  erreur technique).
                </p>
              ) : null}
              {decided ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1 text-sm">
                  <p>
                    Décision : <strong>{note.statut}</strong>
                  </p>
                  {note.montantAccepte != null ? (
                    <p>Montant accepté : {String(note.montantAccepte)} €</p>
                  ) : null}
                  {note.motifDecision ? (
                    <p className="whitespace-pre-wrap">
                      Motif : {note.motifDecision}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {note.ChoixReglementActif ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-1 text-sm">
                  <p>
                    Choix adhérent :{" "}
                    <strong>{note.ChoixReglementActif.mode}</strong>
                  </p>
                  <p>
                    Remboursement :{" "}
                    {String(note.ChoixReglementActif.montantRemboursement)} €
                  </p>
                  <p>
                    Compensation :{" "}
                    {String(note.ChoixReglementActif.montantCompensation)} €
                  </p>
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
              {note.statut === "SOUMISE" ? (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-700">
                    Décision (TRESOR / ADMIN)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={outcome === "VALIDEE" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOutcome("VALIDEE")}
                    >
                      Valider
                    </Button>
                    <Button
                      type="button"
                      variant={outcome === "REJETEE" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOutcome("REJETEE")}
                    >
                      Rejeter
                    </Button>
                  </div>
                  {outcome === "VALIDEE" ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide bg-slate-100 px-2 py-1 rounded-t-md block">
                        Montant accepté (€)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={montantAccepte}
                        onChange={(e) => setMontantAccepte(e.target.value)}
                        className="bg-blue-50 border-blue-200"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide bg-slate-100 px-2 py-1 rounded-t-md block">
                      Motif
                      {outcome === "REJETEE" ||
                      (outcome === "VALIDEE" &&
                        Number(montantAccepte) <
                          Number(note.montantDemande))
                        ? " (obligatoire)"
                        : " (optionnel si acceptation totale)"}
                    </label>
                    <textarea
                      className="w-full min-h-[80px] rounded-md rounded-tl-none border border-blue-200 bg-blue-50 p-2 text-sm"
                      value={motif}
                      onChange={(e) => setMotif(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => void onDecide()}
                  >
                    {submitting ? "Enregistrement…" : "Enregistrer la décision"}
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
