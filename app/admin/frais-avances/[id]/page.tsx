"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Banknote, FilePenLine, Gavel, GitMerge, MinusCircle, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  actionGetNoteFrais,
  actionGetNoteFraisCapabilities,
  actionGetNoteFraisFinancialView,
} from "@/actions/frais-avances";
import { DecideNoteFraisDialog } from "@/components/frais-avances/DecideNoteFraisDialog";
import { ExecuteRemboursementDialog } from "@/components/frais-avances/ExecuteRemboursementDialog";
import { ExecuteCompensationDialog } from "@/components/frais-avances/ExecuteCompensationDialog";
import { ExecuteMixteDialog } from "@/components/frais-avances/ExecuteMixteDialog";
import { CorrectReferenceDialog } from "@/components/frais-avances/CorrectReferenceDialog";
import { CorrectMontantDialog } from "@/components/frais-avances/CorrectMontantDialog";
import { RecordRestitutionDialog } from "@/components/frais-avances/RecordRestitutionDialog";
import type { CompensationCibleOption } from "@/components/frais-avances/CompensationCiblesFields";
import { NoteFraisHistoriqueReglements } from "@/components/frais-avances/NoteFraisHistoriqueReglements";
import {
  NoteFraisEtatFinancierBadge,
  NoteFraisModeBadge,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";
import {
  moneyIsStrictlyPositive,
  moneyRestantNonNegatif,
} from "@/lib/frais-avances/money-cents";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";
import type { NoteFraisHistoriqueReglementDto } from "@/lib/frais-avances/dto";
import type { NoteFraisCapabilitiesDto } from "@/lib/services/frais-avances/note-frais-capabilities-service";

type NoteDetail = {
  id: string;
  libelle: string;
  statut: string;
  version: number;
  montantDemande: string | number;
  montantAccepte?: string | number | null;
  motifDecision?: string | null;
  alerteSansDestinataire?: boolean;
  description?: string | null;
  etatFinancier?: string;
  restantDu?: string;
  Justificatifs?: { id: string; nomFichierOrig: string; statut: string }[];
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
  historiqueReglements?: NoteFraisHistoriqueReglementDto[];
};

type FinancialView = {
  noteId: string;
  statut: string;
  version: number;
  montantAccepte: string | null;
  modeChoix: string | null;
  etatFinancier: string;
  restantDu: string;
  montantRembourseUtilise: string | null;
  montantCompensationUtilise: string | null;
  remboursements: Array<{
    id: string;
    montantTotal: string;
    moyen: string;
    reference?: string;
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
      reference?: string;
    };
  }>;
  corrections?: Array<{
    id: string;
    reglementId: string;
    type: "REFERENCE" | "MONTANT_NEGATIF";
    createdAt: string;
    montantCorrection?: string;
  }>;
};

function financialToHistorique(
  fin: FinancialView
): NoteFraisHistoriqueReglementDto[] {
  const entries: NoteFraisHistoriqueReglementDto[] = [];
  for (const op of fin.operationsMixte ?? []) {
    const entry: NoteFraisHistoriqueReglementDto = {
      kind: "MIXTE",
      id: op.id,
      executeAt: op.executeAt,
      montantRemboursement: op.remboursement.montantTotal,
      montantCompensation: op.compensation.montantTotal,
      moyen: op.remboursement.moyen,
    };
    if (op.remboursement.reference) {
      entry.reference = op.remboursement.reference;
    }
    entries.push(entry);
  }
  for (const r of fin.remboursements) {
    if (r.operationId) continue;
    const entry: NoteFraisHistoriqueReglementDto = {
      kind: "REMBOURSEMENT_SIMPLE",
      id: r.id,
      executeAt: r.executeAt,
      montantRemboursement: r.montantTotal,
      moyen: r.moyen,
    };
    if (r.reference) entry.reference = r.reference;
    entries.push(entry);
  }
  for (const c of fin.corrections ?? []) {
    const entry: NoteFraisHistoriqueReglementDto = {
      kind:
        c.type === "REFERENCE"
          ? "CORRECTION_REFERENCE"
          : "CORRECTION_MONTANT_NEGATIF",
      id: c.id,
      reglementId: c.reglementId,
      executeAt: c.createdAt,
    };
    if (c.montantCorrection) entry.montantCorrection = c.montantCorrection;
    entries.push(entry);
  }
  entries.sort(
    (a, b) => new Date(a.executeAt).getTime() - new Date(b.executeAt).getTime()
  );
  return entries;
}

/**
 * Détail admin / fallback comptable.
 */
export default function AdminNoteFraisDetailPage() {
  const params = useParams();
  const noteId = String(params.id || "");
  const enabledHint = isNotesFraisEnabledClientHint();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [financial, setFinancial] = useState<FinancialView | null>(null);
  const [caps, setCaps] = useState<NoteFraisCapabilitiesDto | null>(null);
  const [decideOpen, setDecideOpen] = useState(false);
  const [rembOpen, setRembOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [mixteOpen, setMixteOpen] = useState(false);
  const [refCorrOpen, setRefCorrOpen] = useState(false);
  const [montantCorrOpen, setMontantCorrOpen] = useState(false);
  const [restitOpen, setRestitOpen] = useState(false);
  const [restitTarget, setRestitTarget] = useState<{
    id: string;
    resteRestituable: string;
  } | null>(null);
  const [corrTarget, setCorrTarget] = useState<{
    id: string;
    type: "REMBOURSEMENT" | "COMPENSATION";
    netRestant: string;
    canCorrectReference: boolean;
    canCorrectMontant: boolean;
    lignesCompensation?: Array<{
      id: string;
      rang: number;
      typeCible: string;
      cibleId: string;
      montant: string;
      montantRestaurable: string;
    }>;
  } | null>(null);
  const [corrIdempotencyKey, setCorrIdempotencyKey] = useState(
    () => `corr-${noteId}-${Date.now()}`
  );
  const [restitIdempotencyKey, setRestitIdempotencyKey] = useState(
    () => `restit-${noteId}-${Date.now()}`
  );
  const [idempotencyKey, setIdempotencyKey] = useState(
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

  const reload = useCallback(async () => {
    if (!enabledHint) return;
    const capsRes = await actionGetNoteFraisCapabilities(noteId);
    if (capsRes.success) setCaps(capsRes.data as NoteFraisCapabilitiesDto);

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
  }, [noteId, enabledHint]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const plafondRembStr =
    caps?.plafondRemboursementRestant ??
    (() => {
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
    })();

  const plafondCompStr =
    caps?.plafondCompensationRestant ??
    (() => {
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
    })();

  const compensationCibles: CompensationCibleOption[] = (
    note?.ChoixReglementActif?.Cibles ?? []
  )
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
        typeCible: c.typeCible as "COTISATION_MENSUELLE" | "DETTE_INITIALE",
        cibleId: c.cibleId,
        libelle: c.libelleSnapshot || c.cibleId,
        plafondRestant,
      };
    })
    .filter((c) => moneyIsStrictlyPositive(c.plafondRestant));

  const showDecide = caps?.canDecide === true;
  const showMixte = caps?.canExecuteMixte === true;
  const showRemb = caps?.canExecuteRemboursement === true;
  const showComp = caps?.canExecuteCompensation === true;
  const showCorrect =
    (caps?.canCorrectReference === true || caps?.canCorrectMontant === true) &&
    (caps?.reglementsCorrigeables?.length ?? 0) > 0;
  const showRestitution =
    caps?.canRecordRestitution === true &&
    (caps?.reglementsRestituables?.length ?? 0) > 0;
  const showReference = caps?.canReadFinancial === true;

  if (!enabledHint) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          Module indisponible.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-2xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 text-white rounded-t-lg pt-4 sm:pt-5">
          <CardTitle className="text-white">
            {note?.libelle || "Note de frais"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <Link
            href={
              financial && !note
                ? "/admin/frais-avances/comptabilite"
                : "/admin/frais-avances"
            }
            className="text-xs text-blue-700 underline"
          >
            ← Retour liste
          </Link>
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
                <NoteFraisEtatFinancierBadge etat={financial.etatFinancier} />
              </div>
              <NoteFraisHistoriqueReglements
                entries={financialToHistorique(financial)}
                showReference
              />
            </div>
          ) : null}

          {note ? (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <NoteFraisStatutBadge statut={note.statut} />
                <NoteFraisMontantBadge
                  label="Demandé"
                  value={String(note.montantDemande)}
                />
                {note.etatFinancier ? (
                  <NoteFraisEtatFinancierBadge etat={note.etatFinancier} />
                ) : null}
              </div>
              {note.alerteSansDestinataire ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Alerte : aucun destinataire habilité au moment de la
                  soumission.
                </p>
              ) : null}
              {note.montantAccepte != null ? (
                <div className="flex flex-wrap gap-2">
                  <NoteFraisMontantBadge
                    label="Accepté"
                    value={String(note.montantAccepte)}
                  />
                  {note.restantDu != null ? (
                    <NoteFraisMontantBadge
                      label="Restant dû"
                      value={note.restantDu}
                    />
                  ) : null}
                </div>
              ) : null}
              {note.motifDecision ? (
                <p className="text-sm whitespace-pre-wrap">
                  Motif : {note.motifDecision}
                </p>
              ) : null}

              {note.ChoixReglementActif ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    <NoteFraisModeBadge mode={note.ChoixReglementActif.mode} />
                    <NoteFraisMontantBadge
                      label="Plafond remb."
                      value={plafondRembStr}
                    />
                    <NoteFraisMontantBadge
                      label="Plafond comp."
                      value={plafondCompStr}
                    />
                  </div>
                  {(showMixte || showRemb || showComp) && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {showMixte ? (
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
                          Exécuter mixte (principal)
                        </Button>
                      ) : null}
                      {showRemb ? (
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
                          {showMixte
                            ? "Complément remboursement"
                            : "Remboursement"}
                        </Button>
                      ) : null}
                      {showComp ? (
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
                          {showMixte
                            ? "Complément compensation"
                            : "Compensation"}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : note.statut === "VALIDEE" ? (
                <p className="text-sm text-slate-600">
                  Aucun choix de règlement enregistré par l&apos;adhérent.
                </p>
              ) : null}

              {note.historiqueReglements?.length ? (
                <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Historique des règlements
                  </p>
                  <NoteFraisHistoriqueReglements
                    entries={note.historiqueReglements}
                    showReference={showReference}
                  />
                </section>
              ) : null}

              {showCorrect ? (
                <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                    Corrections append-only
                  </p>
                  <ul className="space-y-2">
                    {(caps?.reglementsCorrigeables ?? []).map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        <span className="font-mono text-slate-700">
                          {r.type} · net {r.netRestant} €
                        </span>
                        {r.canCorrectReference ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCorrTarget(r);
                              setCorrIdempotencyKey(
                                `corr-ref-${r.id}-${Date.now()}`
                              );
                              setRefCorrOpen(true);
                            }}
                            data-testid={`open-correct-ref-${r.id}`}
                          >
                            <FilePenLine className="h-3.5 w-3.5 mr-1" />
                            Référence
                          </Button>
                        ) : null}
                        {r.canCorrectMontant ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCorrTarget(r);
                              setCorrIdempotencyKey(
                                `corr-mnt-${r.id}-${Date.now()}`
                              );
                              setMontantCorrOpen(true);
                            }}
                            data-testid={`open-correct-mnt-${r.id}`}
                          >
                            <MinusCircle className="h-3.5 w-3.5 mr-1" />
                            Montant
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {showRestitution ? (
                <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
                    Restitutions réelles
                  </p>
                  <ul className="space-y-2">
                    {(caps?.reglementsRestituables ?? []).map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        <span className="font-mono text-slate-700">
                          REMBOURSEMENT · reste {r.resteRestituable} €
                          {r.operationId ? " (enfant MIXTE)" : ""}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRestitTarget(r);
                            setRestitIdempotencyKey(
                              `restit-${r.id}-${Date.now()}`
                            );
                            setRestitOpen(true);
                          }}
                          data-testid={`open-restit-${r.id}`}
                        >
                          <Banknote className="h-3.5 w-3.5 mr-1" />
                          Restituer
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {note.description && caps?.canReadLive ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">
                    Description
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {note.description}
                  </p>
                </div>
              ) : null}

              {caps?.canReadLive ? (
                <ul className="text-sm space-y-1">
                  {note.Justificatifs?.filter((j) => j.statut === "READY").map(
                    (j) => (
                      <li
                        key={j.id}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
                      >
                        <span className="min-w-0 break-all">
                          {j.nomFichierOrig}
                        </span>
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
              ) : null}

              {showDecide ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIdempotencyKey(`decide-${noteId}-${Date.now()}`);
                    setDecideOpen(true);
                  }}
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

      {note && showDecide ? (
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
      {note && showRemb ? (
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
      {note && showComp ? (
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
      {note && showMixte ? (
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
      {note && corrTarget && refCorrOpen ? (
        <CorrectReferenceDialog
          open={refCorrOpen}
          onOpenChange={setRefCorrOpen}
          noteId={noteId}
          reglementId={corrTarget.id}
          expectedVersion={note.version}
          idempotencyKey={corrIdempotencyKey}
          onDone={reload}
        />
      ) : null}
      {note && corrTarget && montantCorrOpen ? (
        <CorrectMontantDialog
          open={montantCorrOpen}
          onOpenChange={setMontantCorrOpen}
          noteId={noteId}
          reglementId={corrTarget.id}
          reglementType={corrTarget.type}
          expectedVersion={note.version}
          idempotencyKey={corrIdempotencyKey}
          netRestant={corrTarget.netRestant}
          lignes={corrTarget.lignesCompensation}
          onDone={reload}
        />
      ) : null}
      {note && restitTarget && restitOpen ? (
        <RecordRestitutionDialog
          open={restitOpen}
          onOpenChange={setRestitOpen}
          noteId={noteId}
          reglementId={restitTarget.id}
          expectedVersion={note.version}
          idempotencyKey={restitIdempotencyKey}
          resteRestituable={restitTarget.resteRestituable}
          onDone={reload}
        />
      ) : null}
    </div>
  );
}
