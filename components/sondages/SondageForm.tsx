"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "react-toastify";
import type { SondageKind, SondageQuestionType } from "@prisma/client";
import { createSondage, updateSondage, addQuestionsToSondage } from "@/actions/sondages";
import { cn } from "@/lib/utils";

/** Champ de saisie : fond clair, bordure visible, focus marqué, texte foncé. */
const fieldControlClass =
  "bg-white border-2 border-slate-400 text-slate-900 placeholder:text-slate-400 " +
  "focus:!border-blue-700 focus:!ring-4 focus:!ring-blue-600/50 " +
  "focus-visible:!border-blue-700 focus-visible:!ring-4 focus-visible:!ring-blue-600/50 " +
  "focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-blue-700 " +
  "aria-invalid:!border-red-600 aria-invalid:!ring-red-600/35";

const fieldLabelClass = "text-sm font-semibold text-slate-900";
const fieldHintClass = "text-xs text-slate-600 leading-snug";
const fieldErrorClass = "text-xs font-medium text-red-700";
const secondaryBtnClass =
  "border-2 border-slate-600 text-slate-900 bg-white hover:bg-slate-50 font-semibold " +
  "focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

function RequiredMark() {
  return (
    <span className="text-red-700 font-bold" aria-hidden="true">
      *
    </span>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className={cn(fieldLabelClass, "gap-1")}>
      {children}
      {required ? <RequiredMark /> : null}
    </Label>
  );
}

function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={fieldHintClass}>
      {children}
    </p>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={fieldErrorClass}>
      {message}
    </p>
  );
}

export type SondageFormQuestion = {
  ordre: number;
  section: string;
  libelle: string;
  type: SondageQuestionType;
  obligatoire: boolean;
  maxSelections: string;
  minCaracteres: string;
  maxCaracteres: string;
  explication: string;
  options: Array<{
    ordre: number;
    libelle: string;
    permetTexteLibre: boolean;
    estCorrecte: boolean;
  }>;
  lignesMatrice: Array<{ ordre: number; libelle: string }>;
};

export type SondageFormValues = {
  sujet: string;
  introduction: string;
  conclusion: string;
  dateDebut: string;
  dateFin: string;
  kind: SondageKind;
  /** Quiz uniquement — diffusion question par question. */
  modeEnDirect: boolean;
  questions: SondageFormQuestion[];
};

const QUESTION_TYPE_LABELS: Record<SondageQuestionType, string> = {
  ChoixUnique: "Choix unique",
  ChoixMultiple: "Choix multiple",
  TexteLibre: "Texte libre",
  Matrice: "Tableau (matrice)",
};

function toDatetimeLocalValue(date?: string | Date): string {
  const d = date ? new Date(date) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultQuestion(ordre: number, forQuiz = false): SondageFormQuestion {
  return {
    ordre,
    section: "",
    libelle: "",
    type: "ChoixUnique",
    obligatoire: true,
    maxSelections: "",
    minCaracteres: "",
    maxCaracteres: "2000",
    explication: "",
    options: [
      { ordre: 0, libelle: "", permetTexteLibre: false, estCorrecte: forQuiz },
      { ordre: 1, libelle: "", permetTexteLibre: false, estCorrecte: false },
    ],
    lignesMatrice: [{ ordre: 0, libelle: "" }],
  };
}

function buildDefaultValues(initial?: Partial<SondageFormValues>): SondageFormValues {
  const now = new Date();
  const fin = new Date(now);
  fin.setDate(fin.getDate() + 14);
  const kind = initial?.kind ?? "Sondage";

  return {
    sujet: initial?.sujet ?? "",
    introduction: initial?.introduction ?? "",
    conclusion: initial?.conclusion ?? "",
    dateDebut: initial?.dateDebut ?? toDatetimeLocalValue(now),
    dateFin: initial?.dateFin ?? toDatetimeLocalValue(fin),
    kind,
    modeEnDirect: kind === "Quiz" ? Boolean(initial?.modeEnDirect) : false,
    questions: initial?.questions?.length
      ? initial.questions
      : [defaultQuestion(0, kind === "Quiz")],
  };
}

interface SondageFormProps {
  sondageId?: string;
  initialData?: Partial<SondageFormValues>;
  readOnly?: boolean;
  /** Mode dédié : ajouter des questions à un sondage déjà ouvert */
  addQuestionsOnly?: boolean;
  onSuccess?: (id: string) => void;
}

/**
 * Formulaire de création / édition d'un sondage (admin).
 * En mode `addQuestionsOnly`, seules les nouvelles questions sont saisies.
 */
export function SondageForm({
  sondageId,
  initialData,
  readOnly = false,
  addQuestionsOnly = false,
  onSuccess,
}: SondageFormProps) {
  const formHintId = useId();
  const [values, setValues] = useState<SondageFormValues>(() =>
    buildDefaultValues(
      addQuestionsOnly
        ? {
            kind: initialData?.kind ?? "Sondage",
            questions: [
              defaultQuestion(0, (initialData?.kind ?? "Sondage") === "Quiz"),
            ],
          }
        : initialData
    )
  );
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /**
   * Validation client : messages précis sous chaque champ concerné.
   */
  const validateFields = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!addQuestionsOnly) {
      if (!values.sujet.trim()) {
        errs.sujet = "Indiquez le sujet du questionnaire.";
      }
      if (!values.dateDebut) {
        errs.dateDebut = "Indiquez la date de début.";
      }
      if (!values.dateFin) {
        errs.dateFin = "Indiquez la date de fin.";
      } else if (
        values.dateDebut &&
        new Date(values.dateFin) <= new Date(values.dateDebut)
      ) {
        errs.dateFin = "La date de fin doit être postérieure à la date de début.";
      }
    }

    values.questions.forEach((q, qi) => {
      if (!q.libelle.trim()) {
        errs[`q${qi}.libelle`] = "Indiquez le libellé de la question.";
      }
      const needsOptions =
        values.kind === "Quiz" ||
        q.type === "ChoixUnique" ||
        q.type === "ChoixMultiple" ||
        q.type === "Matrice";
      if (needsOptions) {
        const filled = q.options.filter((o) => o.libelle.trim());
        if (filled.length < 2) {
          errs[`q${qi}.options`] =
            "Ajoutez au moins deux choix avec un libellé.";
        } else {
          q.options.forEach((o, oi) => {
            if (!o.libelle.trim()) {
              errs[`q${qi}.opt${oi}`] = "Indiquez le libellé de ce choix.";
            }
          });
        }
        if (values.kind === "Quiz" && !q.options.some((o) => o.estCorrecte && o.libelle.trim())) {
          errs[`q${qi}.correct`] =
            "Cochez une bonne réponse parmi les choix renseignés.";
        }
      }
      if (q.type === "Matrice" && values.kind !== "Quiz") {
        const lignes = q.lignesMatrice.filter((l) => l.libelle.trim());
        if (lignes.length < 1) {
          errs[`q${qi}.lignes`] = "Ajoutez au moins une ligne au tableau.";
        }
      }
    });

    return errs;
  };

  const updateQuestion = (index: number, patch: Partial<SondageFormQuestion>) => {
    setValues((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const addQuestion = () => {
    setValues((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        defaultQuestion(prev.questions.length, prev.kind === "Quiz"),
      ],
    }));
  };

  const setKind = (kind: SondageKind) => {
    setValues((prev) => ({
      ...prev,
      kind,
      modeEnDirect: kind === "Quiz" ? prev.modeEnDirect : false,
      questions:
        kind === "Quiz"
          ? prev.questions.map((q) => ({
              ...q,
              type: "ChoixUnique" as const,
              options: q.options.map((o, oi) => ({
                ...o,
                estCorrecte: oi === 0,
              })),
            }))
          : prev.questions.map((q) => ({
              ...q,
              options: q.options.map((o) => ({ ...o, estCorrecte: false })),
              explication: "",
            })),
    }));
  };

  const removeQuestion = (index: number) => {
    setValues((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((_, i) => i !== index)
        .map((q, i) => ({ ...q, ordre: i })),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    const errs = validateFields();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrigez les champs signalés avant d’enregistrer.");
      const firstKey = Object.keys(errs)[0];
      if (firstKey) {
        const el = document.querySelector(
          `[data-field="${CSS.escape(firstKey)}"]`
        ) as HTMLElement | null;
        el?.focus();
      }
      return;
    }

    setSaving(true);
    try {
      const isQuiz = values.kind === "Quiz";
      const questionsPayload = values.questions.map((q, i) => ({
        ordre: i,
        section: q.section.trim() || null,
        libelle: q.libelle.trim(),
        type: isQuiz ? ("ChoixUnique" as const) : q.type,
        obligatoire: q.obligatoire,
        maxSelections: q.maxSelections ? Number(q.maxSelections) : null,
        minCaracteres: q.minCaracteres ? Number(q.minCaracteres) : null,
        maxCaracteres: q.maxCaracteres ? Number(q.maxCaracteres) : null,
        explication: isQuiz ? q.explication.trim() || null : null,
        options:
          q.type === "TexteLibre" && !isQuiz
            ? []
            : q.options
                .filter((o) => o.libelle.trim())
                .map((o, oi) => ({
                  ordre: oi,
                  libelle: o.libelle.trim(),
                  permetTexteLibre: isQuiz ? false : o.permetTexteLibre,
                  estCorrecte: isQuiz ? Boolean(o.estCorrecte) : false,
                })),
        lignesMatrice:
          q.type === "Matrice" && !isQuiz
            ? q.lignesMatrice
                .filter((l) => l.libelle.trim())
                .map((l, li) => ({ ordre: li, libelle: l.libelle.trim() }))
            : [],
      }));

      if (addQuestionsOnly) {
        if (!sondageId) {
          toast.error("Identifiant du sondage manquant");
          return;
        }
        const result = await addQuestionsToSondage({
          id: sondageId,
          questions: questionsPayload,
        });
        if (!result.success) {
          toast.error(result.error || "Erreur lors de l'ajout des questions");
          return;
        }
        toast.success(result.message || "Questions ajoutées");
        // Conserver le kind (Quiz/Sondage) pour ne pas basculer le formulaire
        // vers un type incorrect après un ajout réussi.
        setValues(
          buildDefaultValues({
            kind: values.kind,
            modeEnDirect: values.modeEnDirect,
            questions: [defaultQuestion(0, values.kind === "Quiz")],
          })
        );
        onSuccess?.(sondageId);
        return;
      }

      const payload = {
        sujet: values.sujet.trim(),
        introduction: values.introduction.trim() || null,
        conclusion: values.conclusion.trim() || null,
        dateDebut: new Date(values.dateDebut),
        dateFin: new Date(values.dateFin),
        kind: values.kind,
        modeEnDirect: values.kind === "Quiz" ? values.modeEnDirect : false,
        questions: questionsPayload,
      };

      const result = sondageId
        ? await updateSondage({ ...payload, id: sondageId })
        : await createSondage(payload);

      if (!result.success) {
        toast.error(result.error || "Erreur lors de l'enregistrement");
        return;
      }

      toast.success(result.message || "Sondage enregistré");
      const newId =
        result.success && "id" in result && typeof result.id === "string"
          ? result.id
          : sondageId || "";
      onSuccess?.(newId);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const kindLocked = readOnly || Boolean(sondageId);
  const kindLabel = values.kind === "Quiz" ? "quiz" : "sondage";
  const submitLabel = addQuestionsOnly
    ? values.kind === "Quiz"
      ? "Ajouter au quiz"
      : "Ajouter au sondage"
    : "Enregistrer en brouillon";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <p
        id={formHintId}
        className="text-sm font-semibold text-slate-800 rounded-md border border-slate-300 bg-slate-50 px-3 py-2"
      >
        <span className="text-red-700 font-bold" aria-hidden="true">
          *
        </span>{" "}
        Champ obligatoire
      </p>

      {addQuestionsOnly && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Les questions déjà publiées restent inchangées. Les nouvelles questions
          seront ajoutées à la fin du {kindLabel}. Les adhérents qui ont déjà répondu
          pourront compléter leur réponse.
        </div>
      )}

      {!addQuestionsOnly && (
        <>
          <div className="space-y-2">
            <p
              id="sondage-kind-label"
              className={cn(fieldLabelClass, "flex items-center gap-1")}
            >
              Type de questionnaire
              <RequiredMark />
            </p>
            <div
              role="radiogroup"
              aria-labelledby="sondage-kind-label"
              aria-required="true"
              className="grid gap-3 sm:grid-cols-2"
              onKeyDown={(e) => {
                if (kindLocked) return;
                if (e.key !== "ArrowRight" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowUp") {
                  return;
                }
                e.preventDefault();
                setKind(values.kind === "Sondage" ? "Quiz" : "Sondage");
              }}
            >
              {(
                [
                  {
                    value: "Sondage" as const,
                    title: "Sondage",
                    desc: "Recueillir l’avis des adhérents.",
                  },
                  {
                    value: "Quiz" as const,
                    title: "Quiz",
                    desc: "Poser des questions avec une bonne réponse et un corrigé.",
                  },
                ] as const
              ).map((opt) => {
                const selected = values.kind === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={kindLocked ? -1 : 0}
                    disabled={kindLocked}
                    onClick={() => setKind(opt.value)}
                    className={[
                      "flex flex-col gap-1 rounded-lg border-2 p-3 sm:p-4 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-600/50 focus-visible:border-blue-600",
                      selected
                        ? "border-blue-700 bg-blue-50 shadow-sm"
                        : "border-slate-400 bg-white hover:border-slate-600",
                      kindLocked ? "opacity-90 cursor-default" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <span className="flex items-center justify-between gap-2 pointer-events-none">
                      <span className="font-semibold text-slate-900">{opt.title}</span>
                      {selected ? (
                        <span className="text-[10px] uppercase tracking-wide font-bold text-blue-900 bg-blue-200 px-1.5 py-0.5 rounded">
                          Sélectionné
                        </span>
                      ) : null}
                    </span>
                    <span className={cn(fieldHintClass, "sm:text-sm pointer-events-none")}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {values.kind === "Quiz" ? (
            <div className="flex items-start gap-2 rounded-md border-2 border-teal-600 bg-teal-50 p-3">
              <Checkbox
                id="mode-en-direct"
                checked={values.modeEnDirect}
                disabled={kindLocked}
                onCheckedChange={(c) =>
                  setValues((p) => ({ ...p, modeEnDirect: c === true }))
                }
              />
              <div className="space-y-1 min-w-0">
                <Label
                  htmlFor="mode-en-direct"
                  className={cn(fieldLabelClass, "cursor-pointer")}
                >
                  En direct
                </Label>
                <FieldHint>
                  Diffuse une question à la fois via le pilote ADMIN. Pas de
                  chronomètre ni de classement dans cette version.
                </FieldHint>
              </div>
            </div>
          ) : null}

          <Card className="border-2 border-slate-300 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
              <CardTitle className="text-base text-slate-900">
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="sondage-sujet" required>
                  Sujet (unique)
                </FieldLabel>
                <Input
                  id="sondage-sujet"
                  data-field="sujet"
                  value={values.sujet}
                  onChange={(e) => {
                    clearFieldError("sujet");
                    setValues((p) => ({ ...p, sujet: e.target.value }));
                  }}
                  disabled={readOnly}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.sujet)}
                  aria-describedby={
                    fieldErrors.sujet ? "err-sujet" : formHintId
                  }
                  maxLength={255}
                  placeholder="Ex. Bilan des 6 premiers mois"
                  className={fieldControlClass}
                />
                <FieldError id="err-sujet" message={fieldErrors.sujet} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="sondage-date-debut" required>
                    Date de début
                  </FieldLabel>
                  <Input
                    id="sondage-date-debut"
                    data-field="dateDebut"
                    type="datetime-local"
                    value={values.dateDebut}
                    onChange={(e) => {
                      clearFieldError("dateDebut");
                      setValues((p) => ({ ...p, dateDebut: e.target.value }));
                    }}
                    disabled={readOnly}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.dateDebut)}
                    aria-describedby={
                      fieldErrors.dateDebut ? "err-dateDebut" : undefined
                    }
                    className={fieldControlClass}
                  />
                  <FieldError
                    id="err-dateDebut"
                    message={fieldErrors.dateDebut}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="sondage-date-fin" required>
                    Date de fin
                  </FieldLabel>
                  <Input
                    id="sondage-date-fin"
                    data-field="dateFin"
                    type="datetime-local"
                    value={values.dateFin}
                    onChange={(e) => {
                      clearFieldError("dateFin");
                      setValues((p) => ({ ...p, dateFin: e.target.value }));
                    }}
                    disabled={readOnly}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.dateFin)}
                    aria-describedby={
                      fieldErrors.dateFin ? "err-dateFin" : undefined
                    }
                    className={fieldControlClass}
                  />
                  <FieldError id="err-dateFin" message={fieldErrors.dateFin} />
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="sondage-intro">Introduction</FieldLabel>
                <Textarea
                  id="sondage-intro"
                  value={values.introduction}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, introduction: e.target.value }))
                  }
                  disabled={readOnly}
                  rows={4}
                  placeholder="Texte d'accroche affiché aux adhérents"
                  aria-describedby="hint-intro"
                  className={fieldControlClass}
                />
                <FieldHint id="hint-intro">
                  Exemple : présentez le contexte du questionnaire aux
                  adhérents.
                </FieldHint>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="sondage-conclusion">Conclusion</FieldLabel>
                <Textarea
                  id="sondage-conclusion"
                  value={values.conclusion}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, conclusion: e.target.value }))
                  }
                  disabled={readOnly}
                  rows={3}
                  className={fieldControlClass}
                />
              </div>
              {!sondageId ? (
                <p className={cn(fieldHintClass, "rounded-md border border-slate-300 bg-slate-50 px-3 py-2")}>
                  Enregistrement en brouillon uniquement. La publication et les
                  notifications se feront depuis la page de détail, après
                  relecture.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {addQuestionsOnly ? "Nouvelles questions" : "Questions"}
          </h3>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("w-full sm:w-auto", secondaryBtnClass)}
              onClick={addQuestion}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter une question
            </Button>
          )}
        </div>

        {values.questions.map((question, qIndex) => (
          <Card key={qIndex} className="border-2 border-slate-300">
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-500" aria-hidden />
                Question {qIndex + 1}
              </CardTitle>
              {!readOnly && values.questions.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-2 border-red-600 text-red-700 hover:bg-red-50 font-semibold"
                  onClick={() => removeQuestion(qIndex)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Supprimer la question {qIndex + 1}</span>
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor={`q-${qIndex}-libelle`} required>
                    Libellé
                  </FieldLabel>
                  <Textarea
                    id={`q-${qIndex}-libelle`}
                    data-field={`q${qIndex}.libelle`}
                    value={question.libelle}
                    onChange={(e) => {
                      clearFieldError(`q${qIndex}.libelle`);
                      updateQuestion(qIndex, { libelle: e.target.value });
                    }}
                    disabled={readOnly}
                    rows={2}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors[`q${qIndex}.libelle`])}
                    aria-describedby={
                      fieldErrors[`q${qIndex}.libelle`]
                        ? `err-q${qIndex}-libelle`
                        : undefined
                    }
                    className={fieldControlClass}
                  />
                  <FieldError
                    id={`err-q${qIndex}-libelle`}
                    message={fieldErrors[`q${qIndex}.libelle`]}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`q-${qIndex}-section`}>
                    Section
                  </FieldLabel>
                  <Input
                    id={`q-${qIndex}-section`}
                    value={question.section}
                    onChange={(e) =>
                      updateQuestion(qIndex, { section: e.target.value })
                    }
                    disabled={readOnly}
                    placeholder="Ex. Communication"
                    aria-describedby={`hint-q${qIndex}-section`}
                    className={fieldControlClass}
                  />
                  <FieldHint id={`hint-q${qIndex}-section`}>
                    Optionnel — regroupe les questions par thème.
                  </FieldHint>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`q-${qIndex}-type`} required>
                    Type
                  </FieldLabel>
                  {values.kind === "Quiz" ? (
                    <Input
                      id={`q-${qIndex}-type`}
                      value="Choix unique (quiz)"
                      disabled
                      aria-required="true"
                      className={fieldControlClass}
                    />
                  ) : (
                    <Select
                      value={question.type}
                      onValueChange={(v) =>
                        updateQuestion(qIndex, {
                          type: v as SondageQuestionType,
                        })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger
                        id={`q-${qIndex}-type`}
                        aria-required="true"
                        className={cn(fieldControlClass, "h-11")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(
                            QUESTION_TYPE_LABELS
                          ) as SondageQuestionType[]
                        ).map((t) => (
                          <SelectItem key={t} value={t}>
                            {QUESTION_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`obligatoire-${qIndex}`}
                  checked={question.obligatoire}
                  onCheckedChange={(c) =>
                    updateQuestion(qIndex, { obligatoire: c === true })
                  }
                  disabled={readOnly}
                />
                <Label
                  htmlFor={`obligatoire-${qIndex}`}
                  className={cn(fieldLabelClass, "font-semibold cursor-pointer")}
                >
                  Question obligatoire pour les adhérents
                </Label>
              </div>

              {question.type === "ChoixMultiple" && (
                <div className="space-y-1.5 max-w-xs">
                  <FieldLabel htmlFor={`q-${qIndex}-maxsel`}>
                    Max. sélections
                  </FieldLabel>
                  <Input
                    id={`q-${qIndex}-maxsel`}
                    type="number"
                    min={1}
                    value={question.maxSelections}
                    onChange={(e) =>
                      updateQuestion(qIndex, {
                        maxSelections: e.target.value,
                      })
                    }
                    disabled={readOnly}
                    placeholder="Illimité"
                    className={fieldControlClass}
                  />
                </div>
              )}

              {question.type === "TexteLibre" && (
                <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={`q-${qIndex}-minc`}>
                      Min. caractères
                    </FieldLabel>
                    <Input
                      id={`q-${qIndex}-minc`}
                      type="number"
                      min={0}
                      value={question.minCaracteres}
                      onChange={(e) =>
                        updateQuestion(qIndex, {
                          minCaracteres: e.target.value,
                        })
                      }
                      disabled={readOnly}
                      className={fieldControlClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={`q-${qIndex}-maxc`}>
                      Max. caractères
                    </FieldLabel>
                    <Input
                      id={`q-${qIndex}-maxc`}
                      type="number"
                      min={1}
                      value={question.maxCaracteres}
                      onChange={(e) =>
                        updateQuestion(qIndex, {
                          maxCaracteres: e.target.value,
                        })
                      }
                      disabled={readOnly}
                      className={fieldControlClass}
                    />
                  </div>
                </div>
              )}

              {(question.type === "ChoixUnique" ||
                question.type === "ChoixMultiple" ||
                question.type === "Matrice") && (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <FieldLabel required>
                      {question.type === "Matrice" ? "Colonnes" : "Choix"}
                    </FieldLabel>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={secondaryBtnClass}
                        onClick={() =>
                          updateQuestion(qIndex, {
                            options: [
                              ...question.options,
                              {
                                ordre: question.options.length,
                                libelle: "",
                                permetTexteLibre: false,
                                estCorrecte: false,
                              },
                            ],
                          })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ajouter un choix
                      </Button>
                    )}
                  </div>
                  <FieldError
                    id={`err-q${qIndex}-options`}
                    message={
                      fieldErrors[`q${qIndex}.options`] ||
                      fieldErrors[`q${qIndex}.correct`]
                    }
                  />
                  {question.options.map((opt, oi) => {
                    const optKey = `q${qIndex}.opt${oi}`;
                    return (
                      <div
                        key={oi}
                        className="flex flex-col gap-2 sm:flex-row sm:items-start rounded-md border border-slate-200 bg-slate-50/50 p-2"
                      >
                        <div className="flex-1 space-y-1 min-w-0">
                          <FieldLabel
                            htmlFor={`q-${qIndex}-opt-${oi}`}
                            required
                          >
                            Choix {oi + 1}
                          </FieldLabel>
                          <Input
                            id={`q-${qIndex}-opt-${oi}`}
                            data-field={optKey}
                            value={opt.libelle}
                            onChange={(e) => {
                              clearFieldError(optKey);
                              clearFieldError(`q${qIndex}.options`);
                              clearFieldError(`q${qIndex}.correct`);
                              const options = [...question.options];
                              options[oi] = {
                                ...options[oi]!,
                                libelle: e.target.value,
                              };
                              updateQuestion(qIndex, { options });
                            }}
                            disabled={readOnly}
                            placeholder={`Ex. Option ${oi + 1}`}
                            required
                            aria-required="true"
                            aria-invalid={Boolean(fieldErrors[optKey])}
                            aria-describedby={
                              fieldErrors[optKey]
                                ? `err-${optKey}`
                                : undefined
                            }
                            className={fieldControlClass}
                          />
                          <FieldError
                            id={`err-${optKey}`}
                            message={fieldErrors[optKey]}
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0 sm:pt-7">
                          {values.kind === "Quiz" ? (
                            <>
                              <Checkbox
                                id={`q-${qIndex}-correct-${oi}`}
                                checked={opt.estCorrecte}
                                onCheckedChange={(c) => {
                                  clearFieldError(`q${qIndex}.correct`);
                                  const options = question.options.map(
                                    (o, i) => ({
                                      ...o,
                                      estCorrecte: c === true ? i === oi : false,
                                    })
                                  );
                                  updateQuestion(qIndex, { options });
                                }}
                                disabled={readOnly}
                              />
                              <Label
                                htmlFor={`q-${qIndex}-correct-${oi}`}
                                className="text-xs font-semibold text-teal-900 cursor-pointer"
                              >
                                Bonne réponse
                              </Label>
                            </>
                          ) : (
                            <>
                              <Checkbox
                                id={`q-${qIndex}-autre-${oi}`}
                                checked={opt.permetTexteLibre}
                                onCheckedChange={(c) => {
                                  const options = [...question.options];
                                  options[oi] = {
                                    ...options[oi]!,
                                    permetTexteLibre: c === true,
                                  };
                                  updateQuestion(qIndex, { options });
                                }}
                                disabled={readOnly}
                              />
                              <Label
                                htmlFor={`q-${qIndex}-autre-${oi}`}
                                className={cn(fieldHintClass, "cursor-pointer")}
                              >
                                Autre (texte libre)
                              </Label>
                            </>
                          )}
                          {!readOnly && question.options.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-2 border-red-600 text-red-700 hover:bg-red-50"
                              onClick={() =>
                                updateQuestion(qIndex, {
                                  options: question.options.filter(
                                    (_, i) => i !== oi
                                  ),
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                              <span className="sr-only">
                                Supprimer le choix {oi + 1}
                              </span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {values.kind === "Quiz" && (
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`q-${qIndex}-explication`}>
                    Explication du corrigé
                  </FieldLabel>
                  <Textarea
                    id={`q-${qIndex}-explication`}
                    value={question.explication}
                    onChange={(e) =>
                      updateQuestion(qIndex, { explication: e.target.value })
                    }
                    disabled={readOnly}
                    rows={2}
                    placeholder="Ex. Affichée après publication du corrigé"
                    aria-describedby={`hint-q${qIndex}-expl`}
                    className={fieldControlClass}
                  />
                  <FieldHint id={`hint-q${qIndex}-expl`}>
                    Facultatif — visible aux adhérents uniquement après
                    publication du corrigé.
                  </FieldHint>
                </div>
              )}

              {question.type === "Matrice" && values.kind !== "Quiz" && (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <FieldLabel required>Lignes du tableau</FieldLabel>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={secondaryBtnClass}
                        onClick={() =>
                          updateQuestion(qIndex, {
                            lignesMatrice: [
                              ...question.lignesMatrice,
                              {
                                ordre: question.lignesMatrice.length,
                                libelle: "",
                              },
                            ],
                          })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ajouter une ligne
                      </Button>
                    )}
                  </div>
                  <FieldError
                    id={`err-q${qIndex}-lignes`}
                    message={fieldErrors[`q${qIndex}.lignes`]}
                  />
                  {question.lignesMatrice.map((ligne, li) => (
                    <div key={li} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <FieldLabel
                          htmlFor={`q-${qIndex}-ligne-${li}`}
                          required
                        >
                          Ligne {li + 1}
                        </FieldLabel>
                        <Input
                          id={`q-${qIndex}-ligne-${li}`}
                          value={ligne.libelle}
                          onChange={(e) => {
                            clearFieldError(`q${qIndex}.lignes`);
                            const lignesMatrice = [...question.lignesMatrice];
                            lignesMatrice[li] = {
                              ...lignesMatrice[li]!,
                              libelle: e.target.value,
                            };
                            updateQuestion(qIndex, { lignesMatrice });
                          }}
                          disabled={readOnly}
                          placeholder={`Ex. Ligne ${li + 1}`}
                          aria-required="true"
                          className={fieldControlClass}
                        />
                      </div>
                      {!readOnly && question.lignesMatrice.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-7 border-2 border-red-600 text-red-700 hover:bg-red-50"
                          onClick={() =>
                            updateQuestion(qIndex, {
                              lignesMatrice: question.lignesMatrice.filter(
                                (_, i) => i !== li
                              ),
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="sr-only">
                            Supprimer la ligne {li + 1}
                          </span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!readOnly && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

export function mapSondageDetailToFormValues(detail: {
  sujet: string;
  introduction: string | null;
  conclusion: string | null;
  dateDebut: string;
  dateFin: string;
  kind?: SondageKind;
  modeEnDirect?: boolean;
  questions: Array<{
    ordre: number;
    section: string | null;
    libelle: string;
    type: SondageQuestionType;
    obligatoire: boolean;
    maxSelections: number | null;
    minCaracteres: number | null;
    maxCaracteres: number | null;
    explication?: string | null;
    options: Array<{
      ordre: number;
      libelle: string;
      permetTexteLibre: boolean;
      estCorrecte?: boolean;
    }>;
    lignesMatrice: Array<{ ordre: number; libelle: string }>;
  }>;
}): SondageFormValues {
  return {
    sujet: detail.sujet,
    introduction: detail.introduction || "",
    conclusion: detail.conclusion || "",
    dateDebut: toDatetimeLocalValue(detail.dateDebut),
    dateFin: toDatetimeLocalValue(detail.dateFin),
    kind: detail.kind ?? "Sondage",
    modeEnDirect:
      (detail.kind ?? "Sondage") === "Quiz"
        ? Boolean(detail.modeEnDirect)
        : false,
    questions: detail.questions.map((q) => ({
      ordre: q.ordre,
      section: q.section || "",
      libelle: q.libelle,
      type: q.type,
      obligatoire: q.obligatoire,
      maxSelections: q.maxSelections?.toString() ?? "",
      minCaracteres: q.minCaracteres?.toString() ?? "",
      maxCaracteres: q.maxCaracteres?.toString() ?? "",
      explication: q.explication || "",
      options: q.options.length
        ? q.options.map((o) => ({
            ordre: o.ordre,
            libelle: o.libelle,
            permetTexteLibre: o.permetTexteLibre,
            estCorrecte: Boolean(o.estCorrecte),
          }))
        : [
            {
              ordre: 0,
              libelle: "",
              permetTexteLibre: false,
              estCorrecte: false,
            },
          ],
      lignesMatrice: q.lignesMatrice.length
        ? q.lignesMatrice.map((l) => ({ ordre: l.ordre, libelle: l.libelle }))
        : [{ ordre: 0, libelle: "" }],
    })),
  };
}
