"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actionCreateCorrectedNoteFraisDraft,
  actionDeleteNoteFraisJustificatif,
  actionGetNoteFrais,
  actionListCiblesCompensationNoteFrais,
  actionSetChoixReglementNoteFrais,
  actionSubmitNoteFrais,
  actionUploadNoteFraisJustificatif,
} from "@/actions/frais-avances";
import { toast } from "react-toastify";

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
  const [uploading, setUploading] = useState(false);
  const [idempotencyKey] = useState(() => `submit-${noteId}-${Date.now()}`);
  const [choixKey, setChoixKey] = useState(
    () => `choix-${noteId}-${Date.now()}`
  );
  const [cibles, setCibles] = useState<CibleEligible[]>([]);
  const [mode, setMode] = useState<ModeChoix>("REMBOURSEMENT");
  const [montantRemboursement, setMontantRemboursement] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [savingChoix, setSavingChoix] = useState(false);
  const [editingChoix, setEditingChoix] = useState(false);

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
      setMontantRemboursement(String(data.montantAccepte));
      const ciblesRes = await actionListCiblesCompensationNoteFrais(noteId);
      if (ciblesRes.success && ciblesRes.data) {
        setCibles(ciblesRes.data as CibleEligible[]);
      }
    }
  }, [noteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const montantAccepteNum = Number(note?.montantAccepte ?? 0);

  const selectedCibles = useMemo(() => {
    return cibles
      .map((c, idx) => {
        const key = `${c.typeCible}:${c.cibleId}`;
        const raw = allocations[key]?.trim() || "";
        if (!raw) return null;
        const montant = Number(raw);
        if (!Number.isFinite(montant) || montant <= 0) return null;
        return {
          typeCible: c.typeCible,
          cibleId: c.cibleId,
          montantAutorise: montant,
          rang: idx,
          libelle: c.libelle,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [allocations, cibles]);

  const sumCompensation = selectedCibles.reduce(
    (s, c) => s + c.montantAutorise,
    0
  );

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

  function syncModeDefaults(next: ModeChoix) {
    setMode(next);
    if (next === "REMBOURSEMENT") {
      setMontantRemboursement(String(montantAccepteNum));
      setAllocations({});
    } else if (next === "COMPENSATION") {
      setMontantRemboursement("0");
    } else {
      setMontantRemboursement(
        String(Math.max(0, montantAccepteNum - sumCompensation).toFixed(2))
      );
    }
  }

  async function onSaveChoix() {
    if (!note || note.statut !== "VALIDEE") return;
    setSavingChoix(true);
    try {
      let remb = Number(montantRemboursement);
      let comp = sumCompensation;
      if (mode === "REMBOURSEMENT") {
        remb = montantAccepteNum;
        comp = 0;
      } else if (mode === "COMPENSATION") {
        remb = 0;
        comp = sumCompensation;
      } else {
        remb = Number(montantRemboursement);
        comp = sumCompensation;
      }

      const res = await actionSetChoixReglementNoteFrais({
        noteId,
        expectedNoteVersion: note.version,
        idempotencyKey: choixKey,
        mode,
        montantRemboursement: remb,
        montantCompensation: mode === "REMBOURSEMENT" ? 0 : comp,
        cibles: mode === "REMBOURSEMENT" ? [] : selectedCibles,
      });
      if (!res.success) {
        toast.error(res.error);
        if (res.code === "REFRESH_REQUIRED") {
          await reload();
        }
        return;
      }
      toast.success(res.message || "Choix enregistré");
      setChoixKey(`choix-${noteId}-${Date.now()}`);
      setEditingChoix(false);
      await reload();
    } finally {
      setSavingChoix(false);
    }
  }

  const showChoixForm =
    note?.statut === "VALIDEE" &&
    (!note.ChoixReglementActif || editingChoix);

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
              {note.montantDemande != null ? (
                <p className="text-sm">
                  Montant demandé : {String(note.montantDemande)} €
                </p>
              ) : null}
              {note.corrigeNoteFraisId ? (
                <p className="text-xs text-slate-600">
                  Demande corrigée liée à une note rejetée précédente.
                </p>
              ) : null}
              {note.statut === "VALIDEE" || note.statut === "REJETEE" ? (
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

              {note.ChoixReglementActif && !editingChoix ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2 text-sm">
                  <p>
                    Choix de règlement :{" "}
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
                    Aucun mouvement financier tant que le règlement n&apos;est
                    pas exécuté.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingChoix(true);
                      setChoixKey(`choix-${noteId}-${Date.now()}`);
                      syncModeDefaults(
                        note.ChoixReglementActif!.mode as ModeChoix
                      );
                    }}
                  >
                    Remplacer le choix
                  </Button>
                </div>
              ) : null}

              {showChoixForm ? (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-700">
                    Choix de règlement
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      ["REMBOURSEMENT", "COMPENSATION", "MIXTE"] as ModeChoix[]
                    ).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant={mode === m ? "default" : "outline"}
                        onClick={() => syncModeDefaults(m)}
                      >
                        {m === "REMBOURSEMENT"
                          ? "Remboursement"
                          : m === "COMPENSATION"
                            ? "Compensation"
                            : "Mixte"}
                      </Button>
                    ))}
                  </div>
                  {mode === "MIXTE" ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide bg-slate-100 px-2 py-1 rounded-t-md block">
                        Montant remboursement (€)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={montantRemboursement}
                        onChange={(e) =>
                          setMontantRemboursement(e.target.value)
                        }
                        className="bg-blue-50 border-blue-200"
                      />
                    </div>
                  ) : null}
                  {mode !== "REMBOURSEMENT" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600">
                        Affectez exactement les montants (somme = compensation).
                        Si un restant a baissé, actualisez.
                      </p>
                      {cibles.length === 0 ? (
                        <p className="text-sm text-amber-800">
                          Aucune cible éligible (dette / cotisation ordinaire).
                        </p>
                      ) : (
                        cibles.map((c) => {
                          const key = `${c.typeCible}:${c.cibleId}`;
                          return (
                            <div
                              key={key}
                              className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2 items-end"
                            >
                              <div>
                                <p className="text-xs font-medium text-slate-800">
                                  {c.libelle}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Restant : {c.montantRestant} €
                                </p>
                              </div>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                value={allocations[key] ?? ""}
                                onChange={(e) =>
                                  setAllocations((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                className="bg-blue-50 border-blue-200 h-8 text-sm"
                              />
                            </div>
                          );
                        })
                      )}
                      <p className="text-xs">
                        Compensation sélectionnée : {sumCompensation.toFixed(2)}{" "}
                        €
                        {mode === "MIXTE"
                          ? ` · Remboursement : ${Number(montantRemboursement || 0).toFixed(2)} € · Total : ${(sumCompensation + Number(montantRemboursement || 0)).toFixed(2)} € / ${montantAccepteNum.toFixed(2)} €`
                          : ` / ${montantAccepteNum.toFixed(2)} €`}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={savingChoix}
                      onClick={() => void onSaveChoix()}
                    >
                      {savingChoix ? "Enregistrement…" : "Enregistrer le choix"}
                    </Button>
                    {editingChoix ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingChoix(false)}
                      >
                        Annuler
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

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
              {note.statut === "REJETEE" ? (
                <Button type="button" onClick={() => void onCorrect()}>
                  Nouvelle demande corrigée
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
