"use client";

import { useState } from "react";
import { Loader2, Play, Square, Eye, SkipForward, Radio, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  closeSondageLiveQuestion,
  openNextSondageLiveQuestion,
  revealSondageLiveQuestionCorrige,
  setSondageModeEnDirect,
} from "@/actions/sondages";

type LiveQuestion = {
  id: string;
  ordre: number;
  libelle: string;
  liveEtat?: string;
};

interface SondageLivePilotPanelProps {
  sondageId: string;
  modeEnDirect: boolean;
  status: string;
  questions: LiveQuestion[];
  onChanged: () => void;
  /** Bouton clôture affiché à part (présentation). */
  onCloturerQuiz?: () => void;
}

const ETAT_COLORS: Record<string, string> = {
  EnAttente: "bg-slate-200 text-slate-900 border-slate-400",
  Ouverte: "bg-green-200 text-green-950 border-green-600",
  Fermee: "bg-amber-200 text-amber-950 border-amber-600",
  CorrigeRevele: "bg-blue-200 text-blue-950 border-blue-600",
};

const ETAT_COLORS_TERMINE: Record<string, string> = {
  ...ETAT_COLORS,
  EnAttente: "bg-slate-300 text-slate-900 border-slate-500",
};

const ETAT_LABELS: Record<string, string> = {
  EnAttente: "En attente",
  Ouverte: "Ouverte aux réponses",
  Fermee: "Réponses fermées",
  CorrigeRevele: "Corrigé révélé",
};

/** Libellé d’état : « Non diffusée » seulement dans le résumé d’un quiz terminé. */
function liveEtatLabelForDisplay(
  etat: string,
  opts: { quizTermine: boolean }
): string {
  if (etat === "EnAttente" && opts.quizTermine) {
    return "Non diffusée";
  }
  return ETAT_LABELS[etat] ?? etat;
}

/**
 * Pilote ADMIN du quiz En direct — présentation prioritaire sous le titre.
 */
export function SondageLivePilotPanel({
  sondageId,
  modeEnDirect,
  status,
  questions,
  onChanged,
  onCloturerQuiz,
}: SondageLivePilotPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const sorted = [...questions].sort((a, b) => a.ordre - b.ordre);
  const total = sorted.length;
  const ouverte = sorted.find((q) => q.liveEtat === "Ouverte");
  const nextPending = sorted.find(
    (q) => (q.liveEtat ?? "EnAttente") === "EnAttente"
  );
  const focus =
    ouverte ??
    [...sorted]
      .reverse()
      .find((q) => q.liveEtat === "Fermee" || q.liveEtat === "CorrigeRevele") ??
    null;
  const canPilot = status === "Ouvert";
  const quizTermine = status === "Cloture";
  const diffusionTerminee =
    !ouverte && !nextPending && sorted.some((q) => q.liveEtat !== "EnAttente");

  const run = async (
    key: string,
    fn: () => Promise<{ success: boolean; error?: string; message?: string }>
  ) => {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) {
        toast.error(res.error || "Action impossible");
        return;
      }
      toast.success(res.message || "OK");
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  if (!modeEnDirect) {
    return (
      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-white py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-700" />
            Mode En direct
            <Badge className="bg-slate-200 text-slate-800 border border-slate-400">
              Inactif
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <p className="text-sm text-slate-700">
            Diffusez les questions une par une. Chronomètre et classement hors
            de cette version.
          </p>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700 font-semibold"
            disabled={busy !== null || !canPilot}
            onClick={() =>
              run("enable", () =>
                setSondageModeEnDirect({ id: sondageId, enabled: true })
              )
            }
          >
            {busy === "enable" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Activer le mode En direct
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (quizTermine || diffusionTerminee) {
    return (
      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="bg-slate-100 py-3">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-slate-700" />
            Quiz terminé
            <Badge className="bg-slate-800 text-white border-0">
              {quizTermine ? "Clôturé" : "Diffusion terminée"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <p className="text-sm text-slate-700">
            Résumé des {total} question{total > 1 ? "s" : ""}
          </p>
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {sorted.map((q) => {
              const etat = q.liveEtat ?? "EnAttente";
              return (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="text-sm text-slate-900 min-w-0">
                    <span className="font-semibold text-slate-600 mr-2">
                      Q{q.ordre + 1}
                    </span>
                    {q.libelle}
                  </span>
                  <Badge
                    className={`${(quizTermine || diffusionTerminee
                      ? ETAT_COLORS_TERMINE
                      : ETAT_COLORS)[etat] ?? ETAT_COLORS.EnAttente} border shrink-0`}
                  >
                    {liveEtatLabelForDisplay(etat, {
                      quizTermine: quizTermine || diffusionTerminee,
                    })}
                  </Badge>
                </li>
              );
            })}
          </ul>
          {!quizTermine && canPilot && onCloturerQuiz ? (
            <div className="pt-2 border-t border-slate-200">
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700 font-semibold shadow-sm"
                disabled={busy !== null}
                onClick={onCloturerQuiz}
              >
                Clôturer le quiz
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const focusEtat = focus?.liveEtat ?? "EnAttente";
  const focusIndex = focus ? focus.ordre + 1 : nextPending ? nextPending.ordre + 1 : 1;
  const autres = sorted.filter((q) => q.id !== focus?.id);

  return (
    <Card className="border-blue-300 shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 sm:px-5">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <Radio className="h-4 w-4" />
          Pilote En direct
          <Badge className="bg-white text-blue-900 border-0 font-semibold">
            Actif
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Question active mise en évidence */}
        <div className="rounded-lg border-2 border-blue-400 bg-blue-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-bold text-blue-950">
              Question {focusIndex} sur {total}
            </p>
            {focus ? (
              <Badge
                className={`${ETAT_COLORS[focusEtat] ?? ETAT_COLORS.EnAttente} border text-sm px-2.5 py-1 font-semibold`}
              >
                {ETAT_LABELS[focusEtat] ?? focusEtat}
              </Badge>
            ) : (
              <Badge className={`${ETAT_COLORS.EnAttente} border text-sm px-2.5 py-1 font-semibold`}>
                En attente
              </Badge>
            )}
          </div>

          {focus ? (
            <p className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
              {focus.libelle}
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              Aucune question en cours — ouvrez la prochaine.
            </p>
          )}

          {/* Commandes : un seul fermer ; après fermeture → révéler + suivante */}
          <div className="flex flex-wrap gap-2 pt-1">
            {!focus && nextPending && canPilot ? (
              <Button
                type="button"
                className="bg-blue-700 text-white hover:bg-blue-800 font-semibold shadow-sm"
                disabled={busy !== null}
                onClick={() =>
                  run("open-next", () =>
                    openNextSondageLiveQuestion({ sondageId })
                  )
                }
              >
                {busy === "open-next" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Ouvrir la question {nextPending.ordre + 1}
              </Button>
            ) : null}

            {focusEtat === "Ouverte" && focus ? (
              <Button
                type="button"
                className="bg-amber-300 text-amber-950 hover:bg-amber-400 border border-amber-600 font-semibold shadow-sm"
                disabled={busy !== null}
                onClick={() =>
                  run("close", () =>
                    closeSondageLiveQuestion({
                      sondageId,
                      questionId: focus.id,
                    })
                  )
                }
              >
                {busy === "close" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2 fill-current" />
                )}
                Fermer les réponses
              </Button>
            ) : null}

            {focusEtat === "Fermee" && focus ? (
              <>
                <Button
                  type="button"
                  className="bg-blue-700 text-white hover:bg-blue-800 font-semibold shadow-sm"
                  disabled={busy !== null}
                  onClick={() =>
                    run("reveal", () =>
                      revealSondageLiveQuestionCorrige({
                        sondageId,
                        questionId: focus.id,
                      })
                    )
                  }
                >
                  {busy === "reveal" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Révéler le corrigé
                </Button>
                {nextPending && canPilot ? (
                  <Button
                    type="button"
                    className="bg-blue-600 text-white hover:bg-blue-700 font-semibold shadow-sm"
                    disabled={busy !== null}
                    onClick={() =>
                      run("next", () =>
                        openNextSondageLiveQuestion({ sondageId })
                      )
                    }
                  >
                    {busy === "next" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <SkipForward className="h-4 w-4 mr-2" />
                    )}
                    Question suivante
                  </Button>
                ) : null}
              </>
            ) : null}

            {focusEtat === "CorrigeRevele" && nextPending && canPilot ? (
              <Button
                type="button"
                className="bg-blue-700 text-white hover:bg-blue-800 font-semibold shadow-sm"
                disabled={busy !== null}
                onClick={() =>
                  run("next-after-reveal", () =>
                    openNextSondageLiveQuestion({ sondageId })
                  )
                }
              >
                {busy === "next-after-reveal" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <SkipForward className="h-4 w-4 mr-2" />
                )}
                Question suivante
              </Button>
            ) : null}
          </div>
        </div>

        {/* Liste compacte des autres questions */}
        {autres.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
              Autres questions
            </p>
            <ul className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
              {autres.map((q) => {
                const etat = q.liveEtat ?? "EnAttente";
                return (
                  <li
                    key={q.id}
                    className="flex flex-wrap items-center gap-2 px-3 py-1.5"
                  >
                    <span className="text-xs font-bold text-slate-500 w-8 shrink-0">
                      Q{q.ordre + 1}
                    </span>
                    <span className="text-sm text-slate-800 flex-1 min-w-0 truncate">
                      {q.libelle}
                    </span>
                    <Badge
                      className={`${ETAT_COLORS[etat] ?? ETAT_COLORS.EnAttente} border text-[11px] shrink-0`}
                    >
                      {ETAT_LABELS[etat] ?? etat}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* Clôturer à part */}
        {canPilot && onCloturerQuiz ? (
          <div className="pt-2 border-t border-slate-200">
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700 font-semibold shadow-sm"
              disabled={busy !== null}
              onClick={onCloturerQuiz}
            >
              Clôturer le quiz
            </Button>
            <p className="text-xs text-slate-600 mt-1.5">
              Arrête définitivement les réponses. Distinct de la fermeture
              d&apos;une question.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
