"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actionCreateAndActivateRetentionPolicy,
  actionGetNotesFraisConservationState,
  actionLeverLegalHold,
  actionPoseLegalHoldArchive,
  actionPoseLegalHoldPeriode,
} from "@/actions/frais-avances/conservation";
import { Loader2, ShieldAlert } from "lucide-react";

type HoldRow = {
  id: string;
  cibleType: string;
  archiveId: string | null;
  periodeCle: string | null;
  statut: string;
  motif: string | null;
  referenceDossier: string | null;
  posedAt: string;
  leveAt: string | null;
  expiresAt: string | null;
};

type ConservationState = {
  canWrite: boolean;
  canManageHold: boolean;
  active: {
    id: string;
    version: number;
    p1Years: number;
    p2Years: number;
    p3Years: number;
    exerciceClotureMois: number;
    exerciceClotureJour: number;
    reportsSansEcheance: boolean;
    motif: string;
    effectiveAt: string | Date;
    activatedAt: string | Date | null;
    occVersion: number;
  } | null;
  versions: Array<{
    id: string;
    version: number;
    statut: string;
    p1Years: number;
    p2Years: number;
    p3Years: number;
    exerciceClotureMois: number;
    exerciceClotureJour: number;
    reportsSansEcheance: boolean;
    motif: string;
    effectiveAt: string | Date;
    activatedAt: string | Date | null;
  }>;
  due: {
    archivesDueP2: number;
    piecesDueP1: number;
    journalDueP3: number;
    nextEndsAt: string | null;
  };
  holds: HoldRow[];
  archivesForHold: Array<{
    id: string;
    dateDepense: string;
    montantDemande: string;
    retentionEndsAt: string;
    archivedAt: string;
  }>;
  legalWarning: string;
};

/**
 * Paramètres de conservation notes de frais (lot 4.10).
 * ADMIN écrit politiques + legal holds ; TRESOR/COMCPT lecture seule.
 */
export default function ConservationParametresPage() {
  const formId = useId();
  const [state, setState] = useState<ConservationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [p1Years, setP1Years] = useState(10);
  const [p2Years, setP2Years] = useState(10);
  const [p3Years, setP3Years] = useState(10);
  const [clotureMois, setClotureMois] = useState(12);
  const [clotureJour, setClotureJour] = useState(31);
  const [motif, setMotif] = useState("");
  const [effectiveAt, setEffectiveAt] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [holdCible, setHoldCible] = useState<"ARCHIVE" | "JOURNAL_PERIODE">(
    "ARCHIVE"
  );
  const [holdArchiveId, setHoldArchiveId] = useState("");
  const [holdPeriode, setHoldPeriode] = useState("");
  const [holdMotif, setHoldMotif] = useState("");
  const [holdRef, setHoldRef] = useState("");
  const [holdExpires, setHoldExpires] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await actionGetNotesFraisConservationState();
    if (!res.success) {
      setError(res.error);
      setState(null);
    } else {
      setError(null);
      setState(res.data as ConservationState);
      if (res.data.active) {
        setP1Years(res.data.active.p1Years);
        setP2Years(res.data.active.p2Years);
        setP3Years(res.data.active.p3Years);
        setClotureMois(res.data.active.exerciceClotureMois);
        setClotureJour(res.data.active.exerciceClotureJour);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function submitActivation() {
    startTransition(async () => {
      const key = `ret-act-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await actionCreateAndActivateRetentionPolicy({
        p1Years,
        p2Years,
        p3Years,
        exerciceClotureMois: clotureMois,
        exerciceClotureJour: clotureJour,
        reportsSansEcheance: true,
        motif,
        effectiveAt: new Date(effectiveAt).toISOString(),
        activationIdempotencyKey: key,
        confirmProspectiveOnly: true,
      });
      if (!res.success) {
        toast.error(res.error || "Échec activation");
        return;
      }
      toast.success(res.message || "Politique activée");
      setConfirmOpen(false);
      setMotif("");
      await load();
    });
  }

  function submitHold() {
    startTransition(async () => {
      if (holdMotif.trim().length < 5) {
        toast.error("Motif de hold obligatoire (min. 5 caractères)");
        return;
      }
      const expiresAt = holdExpires ? new Date(holdExpires).toISOString() : undefined;
      if (holdCible === "ARCHIVE") {
        if (!holdArchiveId.trim()) {
          toast.error("Sélectionnez ou saisissez un identifiant d'archive");
          return;
        }
        const res = await actionPoseLegalHoldArchive({
          archiveId: holdArchiveId.trim(),
          motif: holdMotif,
          referenceDossier: holdRef || undefined,
          expiresAt,
        });
        if (!res.success) {
          toast.error(res.error || "Échec pose hold");
          return;
        }
        toast.success(res.message || "Hold posé");
      } else {
        if (!holdPeriode.trim()) {
          toast.error("Période journal obligatoire (ex. 2024)");
          return;
        }
        const res = await actionPoseLegalHoldPeriode({
          periodeCle: holdPeriode.trim(),
          motif: holdMotif,
          referenceDossier: holdRef || undefined,
          expiresAt,
        });
        if (!res.success) {
          toast.error(res.error || "Échec pose hold période");
          return;
        }
        toast.success(res.message || "Hold période posé");
      }
      setHoldMotif("");
      setHoldRef("");
      setHoldExpires("");
      await load();
    });
  }

  function leverHold(holdId: string) {
    startTransition(async () => {
      const res = await actionLeverLegalHold({ holdId });
      if (!res.success) {
        toast.error(res.error || "Échec levée hold");
        return;
      }
      toast.success(res.message || "Hold levé");
      await load();
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-4xl border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-lg space-y-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" aria-hidden />
            Conservation — notes de frais
          </CardTitle>
          <p className="text-sm text-slate-200 font-normal">
            Politiques P1/P2/P3 et legal holds. V1 : effet immédiat,
            reportsSansEcheance=true obligatoire.
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-8" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {state?.legalWarning ? (
            <div
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
              role="note"
            >
              {state.legalWarning}
            </div>
          ) : null}

          {state?.active ? (
            <section aria-labelledby={`${formId}-active`} className="space-y-2">
              <h2 id={`${formId}-active`} className="text-sm font-semibold text-slate-800">
                Politique ACTIVE (v{state.active.version})
              </h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">P1 (années)</dt>
                  <dd className="font-mono">{state.active.p1Years}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">P2 (années)</dt>
                  <dd className="font-mono">{state.active.p2Years}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">P3 (années)</dt>
                  <dd className="font-mono">{state.active.p3Years}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Clôture exercice</dt>
                  <dd className="font-mono">
                    {String(state.active.exerciceClotureJour).padStart(2, "0")}/
                    {String(state.active.exerciceClotureMois).padStart(2, "0")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Date d&apos;effet</dt>
                  <dd className="font-mono text-xs">
                    {new Date(state.active.effectiveAt).toLocaleDateString("fr-FR")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Reports sans échéance</dt>
                  <dd>oui (V1 obligatoire)</dd>
                </div>
              </dl>
            </section>
          ) : (
            <p className="text-sm text-red-700" role="alert">
              Aucune politique ACTIVE valide — archivage fail-closed.
            </p>
          )}

          {state?.due ? (
            <section aria-labelledby={`${formId}-due`} className="space-y-1">
              <h2 id={`${formId}-due`} className="text-sm font-semibold text-slate-800">
                Échéances (compteurs anonymes)
              </h2>
              <p className="text-sm text-slate-700">
                PJ dues P1 : {state.due.piecesDueP1} · Archives dues P2 :{" "}
                {state.due.archivesDueP2} · Journal dû P3 : {state.due.journalDueP3}
              </p>
              <p className="text-xs text-slate-500">
                Prochaine échéance :{" "}
                {state.due.nextEndsAt
                  ? new Date(state.due.nextEndsAt).toLocaleString("fr-FR")
                  : "aucune"}
              </p>
            </section>
          ) : null}

          {/* Legal holds */}
          <section
            aria-labelledby={`${formId}-holds`}
            className="space-y-3 border-t pt-4"
          >
            <h2 id={`${formId}-holds`} className="text-sm font-semibold text-slate-800">
              Legal holds
            </h2>
            <p className="text-xs text-slate-600">
              Un hold ACTIF bloque la purge P1, la purge P2 et la consolidation P3
              de la cible. Expiration automatique = levée sans purge dans la même
              transaction.
            </p>

            {state?.canManageHold ? (
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`${formId}-cible`}
                      checked={holdCible === "ARCHIVE"}
                      onChange={() => setHoldCible("ARCHIVE")}
                    />
                    Archive
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`${formId}-cible`}
                      checked={holdCible === "JOURNAL_PERIODE"}
                      onChange={() => setHoldCible("JOURNAL_PERIODE")}
                    />
                    Période journal (P3)
                  </label>
                </div>
                {holdCible === "ARCHIVE" ? (
                  <div className="space-y-1">
                    <Label htmlFor={`${formId}-arch`}>Archive cible</Label>
                    <select
                      id={`${formId}-arch`}
                      className="w-full rounded-md border border-slate-300 p-2 text-sm"
                      value={holdArchiveId}
                      onChange={(e) => setHoldArchiveId(e.target.value)}
                    >
                      <option value="">— Choisir —</option>
                      {(state.archivesForHold ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.montantDemande} € ·{" "}
                          {new Date(a.dateDepense).toLocaleDateString("fr-FR")} ·{" "}
                          {a.id.slice(0, 10)}…
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Ou coller un archiveId"
                      value={holdArchiveId}
                      onChange={(e) => setHoldArchiveId(e.target.value)}
                      className="mt-1"
                      aria-label="Identifiant archive"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor={`${formId}-per`}>Période (ex. 2024)</Label>
                    <Input
                      id={`${formId}-per`}
                      value={holdPeriode}
                      onChange={(e) => setHoldPeriode(e.target.value)}
                      maxLength={16}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor={`${formId}-hmotif`}>Motif (obligatoire)</Label>
                  <textarea
                    id={`${formId}-hmotif`}
                    className="w-full min-h-[60px] rounded-md border border-slate-300 p-2 text-sm"
                    value={holdMotif}
                    onChange={(e) => setHoldMotif(e.target.value)}
                    aria-required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`${formId}-href`}>Référence dossier (opt.)</Label>
                    <Input
                      id={`${formId}-href`}
                      value={holdRef}
                      onChange={(e) => setHoldRef(e.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${formId}-hexp`}>Expiration (opt.)</Label>
                    <Input
                      id={`${formId}-hexp`}
                      type="datetime-local"
                      value={holdExpires}
                      onChange={(e) => setHoldExpires(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={pending || holdMotif.trim().length < 5}
                  onClick={submitHold}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Poser le legal hold"
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-600" role="status">
                Pose / levée réservées à un ADMIN actif.
              </p>
            )}

            <ul className="space-y-1 text-sm">
              {(state?.holds ?? []).map((h) => (
                <li
                  key={h.id}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <span className="font-medium">
                      {h.statut} · {h.cibleType}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {h.archiveId
                        ? `archive ${h.archiveId.slice(0, 12)}…`
                        : `période ${h.periodeCle}`}
                      {" · "}
                      posé {new Date(h.posedAt).toLocaleString("fr-FR")}
                      {h.motif ? ` · ${h.motif.slice(0, 80)}` : ""}
                    </span>
                  </div>
                  {state?.canManageHold && h.statut === "ACTIF" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => leverHold(h.id)}
                    >
                      Lever
                    </Button>
                  ) : null}
                </li>
              ))}
              {(state?.holds ?? []).length === 0 ? (
                <li className="text-xs text-slate-500">Aucun hold.</li>
              ) : null}
            </ul>
          </section>

          {state?.canWrite ? (
            <section aria-labelledby={`${formId}-form`} className="space-y-3 border-t pt-4">
              <h2 id={`${formId}-form`} className="text-sm font-semibold text-slate-800">
                Nouvelle version (effet immédiat)
              </h2>
              <p className="text-xs text-slate-600">
                Aucune archive / journal existant ne sera recalculé. Date d&apos;effet
                ≤ aujourd&apos;hui. Reports sans échéance forcé (V1).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`${formId}-p1`}>P1 années</Label>
                  <Input
                    id={`${formId}-p1`}
                    type="number"
                    min={1}
                    max={50}
                    value={p1Years}
                    onChange={(e) => setP1Years(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${formId}-p2`}>P2 années</Label>
                  <Input
                    id={`${formId}-p2`}
                    type="number"
                    min={1}
                    max={50}
                    value={p2Years}
                    onChange={(e) => setP2Years(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${formId}-p3`}>P3 années</Label>
                  <Input
                    id={`${formId}-p3`}
                    type="number"
                    min={1}
                    max={50}
                    value={p3Years}
                    onChange={(e) => setP3Years(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${formId}-mois`}>Mois clôture</Label>
                  <Input
                    id={`${formId}-mois`}
                    type="number"
                    min={1}
                    max={12}
                    value={clotureMois}
                    onChange={(e) => setClotureMois(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${formId}-jour`}>Jour clôture</Label>
                  <Input
                    id={`${formId}-jour`}
                    type="number"
                    min={1}
                    max={31}
                    value={clotureJour}
                    onChange={(e) => setClotureJour(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${formId}-effet`}>Date d&apos;effet (≤ aujourd&apos;hui)</Label>
                  <Input
                    id={`${formId}-effet`}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={effectiveAt}
                    onChange={(e) => setEffectiveAt(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-600" role="note">
                Reports anonymes sans échéance : obligatoire en V1 (non modifiable).
              </p>
              <div className="space-y-1">
                <Label htmlFor={`${formId}-motif`}>Motif (obligatoire)</Label>
                <textarea
                  id={`${formId}-motif`}
                  className="w-full min-h-[80px] rounded-md border border-slate-300 p-2 text-sm"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  required
                  aria-required
                />
              </div>
              {!confirmOpen ? (
                <Button
                  type="button"
                  disabled={pending || motif.trim().length < 10}
                  onClick={() => setConfirmOpen(true)}
                >
                  Prévisualiser et confirmer
                </Button>
              ) : (
                <div
                  className="rounded-md border border-blue-300 bg-blue-50 p-3 space-y-2"
                  role="dialog"
                  aria-labelledby={`${formId}-confirm-title`}
                >
                  <h3 id={`${formId}-confirm-title`} className="text-sm font-semibold">
                    Confirmation — impact prospectif uniquement
                  </h3>
                  <p className="text-xs text-slate-700">
                    Nouvelle politique P1={p1Years} / P2={p2Years} / P3={p3Years} ans,
                    clôture {String(clotureJour).padStart(2, "0")}/
                    {String(clotureMois).padStart(2, "0")}. Aucune archive existante
                    modifiée. Application immédiate.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" disabled={pending} onClick={submitActivation}>
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Activer cette version"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setConfirmOpen(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </section>
          ) : state ? (
            <p className="text-sm text-slate-600" role="status">
              Lecture seule — seul un ADMIN actif peut modifier la politique.
            </p>
          ) : null}

          {state?.versions && state.versions.length > 0 ? (
            <section aria-labelledby={`${formId}-hist`} className="space-y-2 border-t pt-4">
              <h2 id={`${formId}-hist`} className="text-sm font-semibold text-slate-800">
                Historique des versions (lecture seule)
              </h2>
              <ul className="space-y-1 text-sm">
                {state.versions.map((v) => (
                  <li
                    key={v.id}
                    className="rounded border border-slate-200 px-2 py-1.5 bg-white"
                  >
                    <span className="font-medium">
                      v{v.version} — {v.statut}
                    </span>
                    <span className="block text-xs text-slate-500">
                      P1={v.p1Years} P2={v.p2Years} P3={v.p3Years} · effet{" "}
                      {new Date(v.effectiveAt).toLocaleDateString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link
            href="/admin/frais-avances"
            className="inline-block text-sm text-blue-700 hover:underline"
          >
            Retour aux frais avancés
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
