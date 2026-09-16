"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Paperclip, Send, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  actionCreateCorrectedNoteFraisDraft,
  actionGetNoteFrais,
  actionListCiblesCompensationNoteFrais,
} from "@/actions/frais-avances";
import { toast } from "react-toastify";
import { UploadJustificatifDialog } from "@/components/frais-avances/UploadJustificatifDialog";
import { DeleteJustificatifConfirmDialog } from "@/components/frais-avances/DeleteJustificatifConfirmDialog";
import { SubmitNoteFraisConfirmDialog } from "@/components/frais-avances/SubmitNoteFraisConfirmDialog";
import { ChoixReglementDialog } from "@/components/frais-avances/ChoixReglementDialog";
import {
  NoteFraisModeBadge,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";

type Justificatif = {
  id: string;
  statut: string;
  nomFichierOrig: string;
};

type ChoixActif = {
  id: string;
  mode: string;
  montantReference: string | number;
  montantRemboursement: string | number;
  montantCompensation: string | number;
  Cibles: Array<{
    typeCible: string;
    cibleId: string;
    montantAutorise: string | number;
    libelleSnapshot: string | null;
    rang: number;
  }>;
};

type CibleEligible = {
  typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
  cibleId: string;
  libelle: string;
  montantRestant: string;
};

type ModeChoix = "REMBOURSEMENT" | "COMPENSATION" | "MIXTE";

/**
 * Détail / dépôt PJ / soumission / décision / choix règlement d'une note membre.
 */
export default function UserNoteFraisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = String(params.id || "");
  const [note, setNote] = useState<{
    id: string;
    libelle: string;
    statut: string;
    version: number;
    montantDemande?: string | number;
    montantAccepte?: string | number | null;
    motifDecision?: string | null;
    decideeAt?: string | Date | null;
    corrigeNoteFraisId?: string | null;
    Justificatifs: Justificatif[];
    ChoixReglementActif?: ChoixActif | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => `submit-${noteId}-${Date.now()}`);
  const [choixKey, setChoixKey] = useState(
    () => `choix-${noteId}-${Date.now()}`
  );
  const [cibles, setCibles] = useState<CibleEligible[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Justificatif | null>(null);
  const [choixOpen, setChoixOpen] = useState(false);
  const [replacingChoix, setReplacingChoix] = useState(false);
  const [choixInitialMode, setChoixInitialMode] =
    useState<ModeChoix>("REMBOURSEMENT");

  const reload = useCallback(async () => {
    const res = await actionGetNoteFrais(noteId);
    if (!res.success) {
      setError(res.error);
      setNote(null);
      return;
    }
    const data = res.data as NonNullable<typeof note>;
    setNote(data);
    setError(null);
    if (data.statut === "VALIDEE" && data.montantAccepte != null) {
      const ciblesRes = await actionListCiblesCompensationNoteFrais(noteId);
      if (ciblesRes.success && ciblesRes.data) {
        setCibles(ciblesRes.data as CibleEligible[]);
      }
    }
  }, [noteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCorrect() {
    if (!note) return;
    const res = await actionCreateCorrectedNoteFraisDraft({
      corrigeNoteFraisId: note.id,
    });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message || "Brouillon de correction créé");
    router.push(`/user/frais-avances/${res.data.id}`);
  }

  function openChoix(replace: boolean) {
    if (!note) return;
    setReplacingChoix(replace);
    setChoixKey(`choix-${noteId}-${Date.now()}`);
    setChoixInitialMode(
      replace && note.ChoixReglementActif
        ? (note.ChoixReglementActif.mode as ModeChoix)
        : "REMBOURSEMENT"
    );
    setChoixOpen(true);
  }

  const montantAccepteNum = Number(note?.montantAccepte ?? 0);
  const needsChoix =
    note?.statut === "VALIDEE" && !note.ChoixReglementActif;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-2xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 text-white rounded-t-lg pt-4 sm:pt-5">
          <CardTitle className="text-white">{note?.libelle || "Note de frais"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {note ? (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <NoteFraisStatutBadge statut={note.statut} />
                {note.montantDemande != null ? (
                  <NoteFraisMontantBadge
                    label="Demandé"
                    value={note.montantDemande}
                  />
                ) : null}
              </div>
              {note.corrigeNoteFraisId ? (
                <p className="text-xs text-slate-600">
                  Demande corrigée liée à une note rejetée précédente.
                </p>
              ) : null}
              {note.statut === "VALIDEE" || note.statut === "REJETEE" ? (
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
                    <p className="whitespace-pre-wrap text-slate-800">
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
                    Aucun mouvement financier tant que le règlement n&apos;est
                    pas exécuté.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => openChoix(true)}
                    data-testid="open-replace-choix-reglement"
                  >
                    <Wallet className="h-3.5 w-3.5 mr-1.5" />
                    Remplacer le choix
                  </Button>
                </div>
              ) : null}

              {needsChoix ? (
                <Button
                  type="button"
                  onClick={() => openChoix(false)}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                  data-testid="open-choix-reglement"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Choisir le règlement
                </Button>
              ) : null}

              <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Justificatifs
                </p>
                <ul className="text-sm space-y-2">
                  {note.Justificatifs?.map((j) => (
                    <li
                      key={j.id}
                      className="flex flex-wrap items-center gap-2 justify-between rounded-md border border-slate-200 bg-white px-2.5 py-2"
                    >
                      <span className="min-w-0 break-all">
                        {j.nomFichierOrig}{" "}
                        <span className="text-xs text-slate-500">({j.statut})</span>
                      </span>
                      <span className="flex gap-2 shrink-0">
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
                            className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(j)}
                            data-testid={`open-delete-justificatif-${j.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Supprimer
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {note.statut === "BROUILLON" ? (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-slate-300"
                      onClick={() => setUploadOpen(true)}
                      data-testid="open-upload-justificatif"
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Ajouter un justificatif
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setSubmitOpen(true)}
                      className="h-9 bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                      data-testid="open-submit-note-frais"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Soumettre
                    </Button>
                  </div>
                ) : null}
              </section>

              {note.statut === "REJETEE" ? (
                <Button type="button" onClick={() => void onCorrect()}>
                  Nouvelle demande corrigée
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {note ? (
        <>
          <UploadJustificatifDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            noteId={noteId}
            expectedVersion={note.version}
            onDone={reload}
          />
          <DeleteJustificatifConfirmDialog
            open={deleteTarget != null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
            noteId={noteId}
            justificatifId={deleteTarget?.id ?? null}
            fileName={deleteTarget?.nomFichierOrig}
            expectedVersion={note.version}
            onDone={reload}
          />
          <SubmitNoteFraisConfirmDialog
            open={submitOpen}
            onOpenChange={setSubmitOpen}
            noteId={noteId}
            expectedVersion={note.version}
            idempotencyKey={idempotencyKey}
            libelle={note.libelle}
            montantDemande={note.montantDemande}
            onDone={reload}
          />
          <ChoixReglementDialog
            open={choixOpen}
            onOpenChange={setChoixOpen}
            noteId={noteId}
            expectedNoteVersion={note.version}
            idempotencyKey={choixKey}
            montantAccepte={montantAccepteNum}
            cibles={cibles}
            initialMode={choixInitialMode}
            replacing={replacingChoix}
            onDone={reload}
            onRefreshRequired={reload}
          />
        </>
      ) : null}
    </div>
  );
}
