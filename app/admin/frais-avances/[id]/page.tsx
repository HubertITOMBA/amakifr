"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Banknote, Gavel, GitMerge, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  actionGetNoteFrais,
  actionGetNoteFraisFinancialView,
} from "@/actions/frais-avances";
import { DecideNoteFraisDialog } from "@/components/frais-avances/DecideNoteFraisDialog";
import { ExecuteRemboursementDialog } from "@/components/frais-avances/ExecuteRemboursementDialog";
import { ExecuteCompensationDialog } from "@/components/frais-avances/ExecuteCompensationDialog";
import { ExecuteMixteDialog } from "@/components/frais-avances/ExecuteMixteDialog";
import type { CompensationCibleOption } from "@/components/frais-avances/CompensationCiblesFields";
import {
  NoteFraisModeBadge,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";
import {
  moneyIsStrictlyPositive,
  moneyRestantNonNegatif,
} from "@/lib/frais-avances/money-cents";

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
  etatFinancier?: string;
  restantDu?: string;
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
    montantRembourseUtilise: string | number;
    montantCompensationUtilise: string | number;
    Cibles: Array<{
      typeCible: string;
      cibleId: string;
      montantAutorise: string | number;
      montantUtilise?: string | number;
      libelleSnapshot: string | null;
      rang: number;
    }>;
  } | null;
  Remboursements?: Array<{
    id: string;
    montantTotal: string;
    moyen: string;
    executeAt: string | Date;
    reference?: string;
  }>;
};

type FinancialView = {
  noteId: string;
  statut: string;
  version: number;
  montantAccepte: string | null;
  modeChoix: string | null;
  montantRemboursement: string | null;
  montantCompensation: string | null;
  montantRembourseUtilise: string | null;
  montantCompensationUtilise: string | null;
  etatFinancier: string;
  restantDu: string;
  consomme: string;
  remboursements: Array<{
    id: string;
    montantTotal: string;
    moyen: string;
    reference: string;
    executeAt: string;
    operationId?: string | null;
  }>;
  operationsMixte?: Array<{
    id: string;
    executeAt: string;
    compensation: { reglementId: string; montantTotal: string };
    remboursement: {
      reglementId: string;
      montantTotal: string;
      moyen: string;
      reference: string;
    };
  }>;
};

/**
 * Consultation / décision admin d'une note soumise.
 * COMCPT : fallback vue financière (référence) sans détail live / justificatifs.
 */
export default function AdminNoteFraisDetailPage() {
  const params = useParams();
  const noteId = String(params.id || "");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [financial, setFinancial] = useState<FinancialView | null>(null);
  const [decideOpen, setDecideOpen] = useState(false);
  const [rembOpen, setRembOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [mixteOpen, setMixteOpen] = useState(false);
  const [idempotencyKey] = useState(
    () => `decide-${noteId}-${Date.now()}`
  );
  const [rembIdempotencyKey, setRembIdempotencyKey] = useState(
    () => `remb-${noteId}-${Date.now()}`
  );
  const [compIdempotencyKey, setCompIdempotencyKey] = useState(
    () => `comp-${noteId}-${Date.now()}`
  );
  const [mixteIdempotencyKey, setMixteIdempotencyKey] = useState(
    () => `mixte-${noteId}-${Date.now()}`
  );

  const plafondRembStr = useMemo(() => {
    const c = note?.ChoixReglementActif;
    if (!c) return "0.00";
    try {
      return moneyRestantNonNegatif(
        c.montantRemboursement,
        c.montantRembourseUtilise
      );
    } catch {
      return "0.00";
    }
  }, [note]);

  const plafondCompStr = useMemo(() => {
    const c = note?.ChoixReglementActif;
    if (!c) return "0.00";
    try {
      return moneyRestantNonNegatif(
        c.montantCompensation,
        c.montantCompensationUtilise
      );
    } catch {
      return "0.00";
    }
  }, [note]);

  const compensationCibles: CompensationCibleOption[] = useMemo(() => {
    const cibles = note?.ChoixReglementActif?.Cibles ?? [];
    return cibles
      .filter(
        (c) =>
          c.typeCible === "COTISATION_MENSUELLE" ||
          c.typeCible === "DETTE_INITIALE"
      )
      .map((c) => {
        let plafondRestant = "0.00";
        try {
          plafondRestant = moneyRestantNonNegatif(
            c.montantAutorise,
            c.montantUtilise ?? 0
          );
        } catch {
          plafondRestant = "0.00";
        }
        return {
          typeCible: c.typeCible as
            | "COTISATION_MENSUELLE"
            | "DETTE_INITIALE",
          cibleId: c.cibleId,
          libelle: c.libelleSnapshot || c.cibleId,
          plafondRestant,
        };
      })
      .filter((c) => moneyIsStrictlyPositive(c.plafondRestant));
  }, [note]);

  const mode = note?.ChoixReglementActif?.mode;
  const canExecuteRemb =
    note?.statut === "VALIDEE" &&
    (mode === "REMBOURSEMENT" || mode === "MIXTE") &&
    moneyIsStrictlyPositive(plafondRembStr);
  const canExecuteComp =
    note?.statut === "VALIDEE" &&
    (mode === "COMPENSATION" || mode === "MIXTE") &&
    moneyIsStrictlyPositive(plafondCompStr);
  const canExecuteMixte =
    note?.statut === "VALIDEE" &&
    mode === "MIXTE" &&
    moneyIsStrictlyPositive(plafondRembStr) &&
    moneyIsStrictlyPositive(plafondCompStr);

  const reload = useCallback(async () => {
    const res = await actionGetNoteFrais(noteId);
    if (res.success) {
      setNote(res.data as NoteDetail);
      setFinancial(null);
      setError(null);
      return;
    }
    const fin = await actionGetNoteFraisFinancialView(noteId);
    if (fin.success) {
      setNote(null);
      setFinancial(fin.data as FinancialView);
      setError(null);
      return;
    }
    setNote(null);
    setFinancial(null);
    setError(res.error || fin.error || "Erreur");
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
          <CardTitle className="text-white">
            {note?.libelle || "Note de frais"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {financial && !note ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 space-y-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Vue financière (comptable)
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <NoteFraisStatutBadge statut={financial.statut} />
                {financial.modeChoix ? (
                  <NoteFraisModeBadge mode={financial.modeChoix} />
                ) : null}
                {financial.montantAccepte != null ? (
                  <NoteFraisMontantBadge
                    label="Accepté"
                    value={financial.montantAccepte}
                  />
                ) : null}
                <NoteFraisMontantBadge
                  label="Restant dû"
                  value={financial.restantDu}
                />
                <span className="text-xs font-medium text-slate-700">
                  {financial.etatFinancier}
                </span>
              </div>
              {financial.remboursements.length ? (
                <ul className="text-xs space-y-1 border-t border-emerald-100 pt-2">
                  {financial.remboursements.map((r) => (
                    <li key={r.id}>
                      {r.moyen} — {r.montantTotal} € —{" "}
                      {new Date(r.executeAt).toLocaleString("fr-FR")}
                      {r.reference ? ` — réf. ${r.reference}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-600">Aucun remboursement.</p>
              )}
            </div>
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
                    <NoteFraisMontantBadge
                      label="Remboursé"
                      value={note.ChoixReglementActif.montantRembourseUtilise}
                    />
                    {note.restantDu != null ? (
                      <NoteFraisMontantBadge
                        label="Restant dû"
                        value={note.restantDu}
                      />
                    ) : null}
                    {note.etatFinancier ? (
                      <span className="text-xs font-medium text-slate-700">
                        {note.etatFinancier}
                      </span>
                    ) : null}
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
                  {note.Remboursements?.length ? (
                    <ul className="text-xs space-y-1 border-t border-blue-100 pt-2">
                      {note.Remboursements.map((r) => (
                        <li key={r.id}>
                          {r.moyen} — {r.montantTotal} € —{" "}
                          {new Date(r.executeAt).toLocaleString("fr-FR")}
                          {r.reference ? ` — réf. ${r.reference}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {canExecuteRemb || canExecuteComp || canExecuteMixte ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {canExecuteMixte ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setMixteIdempotencyKey(
                              `mixte-${noteId}-${Date.now()}`
                            );
                            setMixteOpen(true);
                          }}
                        >
                          <GitMerge className="h-4 w-4 mr-1" />
                          Exécuter mixte
                        </Button>
                      ) : null}
                      {canExecuteRemb ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRembIdempotencyKey(
                              `remb-${noteId}-${Date.now()}`
                            );
                            setRembOpen(true);
                          }}
                        >
                          <Banknote className="h-4 w-4 mr-1" />
                          Remboursement
                        </Button>
                      ) : null}
                      {canExecuteComp ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCompIdempotencyKey(
                              `comp-${noteId}-${Date.now()}`
                            );
                            setCompOpen(true);
                          }}
                        >
                          <Scale className="h-4 w-4 mr-1" />
                          Compensation
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
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
      {note && canExecuteRemb ? (
        <ExecuteRemboursementDialog
          open={rembOpen}
          onOpenChange={setRembOpen}
          noteId={noteId}
          expectedVersion={note.version}
          idempotencyKey={rembIdempotencyKey}
          plafondRestant={plafondRembStr}
          onDone={reload}
        />
      ) : null}
      {note && canExecuteComp ? (
        <ExecuteCompensationDialog
          open={compOpen}
          onOpenChange={setCompOpen}
          noteId={noteId}
          expectedVersion={note.version}
          idempotencyKey={compIdempotencyKey}
          plafondRestant={plafondCompStr}
          cibles={compensationCibles}
          onDone={reload}
        />
      ) : null}
      {note && canExecuteMixte ? (
        <ExecuteMixteDialog
          open={mixteOpen}
          onOpenChange={setMixteOpen}
          noteId={noteId}
          expectedVersion={note.version}
          idempotencyKey={mixteIdempotencyKey}
          plafondRemboursement={plafondRembStr}
          plafondCompensation={plafondCompStr}
          cibles={compensationCibles}
          onDone={reload}
          onRedirectSimple={(kind) => {
            setMixteOpen(false);
            if (kind === "REMBOURSEMENT") {
              setRembIdempotencyKey(`remb-${noteId}-${Date.now()}`);
              setRembOpen(true);
            } else {
              setCompIdempotencyKey(`comp-${noteId}-${Date.now()}`);
              setCompOpen(true);
            }
          }}
        />
      ) : null}
    </div>
  );
}
