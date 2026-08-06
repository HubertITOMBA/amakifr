"use client";

import { useState } from "react";
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
import type { SondageQuestionType } from "@prisma/client";
import { createSondage, updateSondage } from "@/actions/sondages";

export type SondageFormQuestion = {
  ordre: number;
  section: string;
  libelle: string;
  type: SondageQuestionType;
  obligatoire: boolean;
  maxSelections: string;
  minCaracteres: string;
  maxCaracteres: string;
  options: Array<{ ordre: number; libelle: string; permetTexteLibre: boolean }>;
  lignesMatrice: Array<{ ordre: number; libelle: string }>;
};

export type SondageFormValues = {
  sujet: string;
  introduction: string;
  conclusion: string;
  dateDebut: string;
  dateFin: string;
  publier: boolean;
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

function defaultQuestion(ordre: number): SondageFormQuestion {
  return {
    ordre,
    section: "",
    libelle: "",
    type: "ChoixUnique",
    obligatoire: true,
    maxSelections: "",
    minCaracteres: "",
    maxCaracteres: "2000",
    options: [
      { ordre: 0, libelle: "", permetTexteLibre: false },
      { ordre: 1, libelle: "", permetTexteLibre: false },
    ],
    lignesMatrice: [{ ordre: 0, libelle: "" }],
  };
}

function buildDefaultValues(initial?: Partial<SondageFormValues>): SondageFormValues {
  const now = new Date();
  const fin = new Date(now);
  fin.setDate(fin.getDate() + 14);

  return {
    sujet: initial?.sujet ?? "",
    introduction: initial?.introduction ?? "",
    conclusion: initial?.conclusion ?? "",
    dateDebut: initial?.dateDebut ?? toDatetimeLocalValue(now),
    dateFin: initial?.dateFin ?? toDatetimeLocalValue(fin),
    publier: initial?.publier ?? true,
    questions: initial?.questions?.length ? initial.questions : [defaultQuestion(0)],
  };
}

interface SondageFormProps {
  sondageId?: string;
  initialData?: SondageFormValues;
  readOnly?: boolean;
  onSuccess?: (id: string) => void;
}

/**
 * Formulaire de création / édition d'un sondage (admin).
 */
export function SondageForm({
  sondageId,
  initialData,
  readOnly = false,
  onSuccess,
}: SondageFormProps) {
  const [values, setValues] = useState<SondageFormValues>(() =>
    buildDefaultValues(initialData)
  );
  const [saving, setSaving] = useState(false);

  const updateQuestion = (index: number, patch: Partial<SondageFormQuestion>) => {
    setValues((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const addQuestion = () => {
    setValues((prev) => ({
      ...prev,
      questions: [...prev.questions, defaultQuestion(prev.questions.length)],
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

    setSaving(true);
    try {
      const payload = {
        sujet: values.sujet.trim(),
        introduction: values.introduction.trim() || null,
        conclusion: values.conclusion.trim() || null,
        dateDebut: new Date(values.dateDebut),
        dateFin: new Date(values.dateFin),
        publier: values.publier,
        questions: values.questions.map((q, i) => ({
          ordre: i,
          section: q.section.trim() || null,
          libelle: q.libelle.trim(),
          type: q.type,
          obligatoire: q.obligatoire,
          maxSelections: q.maxSelections ? Number(q.maxSelections) : null,
          minCaracteres: q.minCaracteres ? Number(q.minCaracteres) : null,
          maxCaracteres: q.maxCaracteres ? Number(q.maxCaracteres) : null,
          options:
            q.type === "TexteLibre"
              ? []
              : q.options
                  .filter((o) => o.libelle.trim())
                  .map((o, oi) => ({
                    ordre: oi,
                    libelle: o.libelle.trim(),
                    permetTexteLibre: o.permetTexteLibre,
                  })),
          lignesMatrice:
            q.type === "Matrice"
              ? q.lignesMatrice
                  .filter((l) => l.libelle.trim())
                  .map((l, li) => ({ ordre: li, libelle: l.libelle.trim() }))
              : [],
        })),
      };

      const result = sondageId
        ? await updateSondage({ ...payload, id: sondageId, publier: false })
        : await createSondage(payload);

      if (!result.success) {
        toast.error(result.error || "Erreur lors de l'enregistrement");
        return;
      }

      toast.success(result.message || "Sondage enregistré");
      onSuccess?.(result.id || sondageId || "");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-1">
            <Label>Sujet (unique) *</Label>
            <Input
              value={values.sujet}
              onChange={(e) => setValues((p) => ({ ...p, sujet: e.target.value }))}
              disabled={readOnly}
              required
              maxLength={255}
              placeholder="Ex. Bilan des 6 premiers mois"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Date de début *</Label>
              <Input
                type="datetime-local"
                value={values.dateDebut}
                onChange={(e) => setValues((p) => ({ ...p, dateDebut: e.target.value }))}
                disabled={readOnly}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Date de fin *</Label>
              <Input
                type="datetime-local"
                value={values.dateFin}
                onChange={(e) => setValues((p) => ({ ...p, dateFin: e.target.value }))}
                disabled={readOnly}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Introduction</Label>
            <Textarea
              value={values.introduction}
              onChange={(e) => setValues((p) => ({ ...p, introduction: e.target.value }))}
              disabled={readOnly}
              rows={4}
              placeholder="Texte d'accroche affiché aux adhérents"
            />
          </div>
          <div className="space-y-1">
            <Label>Conclusion</Label>
            <Textarea
              value={values.conclusion}
              onChange={(e) => setValues((p) => ({ ...p, conclusion: e.target.value }))}
              disabled={readOnly}
              rows={3}
            />
          </div>
          {!sondageId && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="publier"
                checked={values.publier}
                onCheckedChange={(c) => setValues((p) => ({ ...p, publier: c === true }))}
                disabled={readOnly}
              />
              <Label htmlFor="publier" className="font-normal cursor-pointer">
                Publier immédiatement et envoyer un email à tous les adhérents actifs
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Questions</h3>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter une question
            </Button>
          )}
        </div>

        {values.questions.map((question, qIndex) => (
          <Card key={qIndex} className="border-slate-200 dark:border-slate-700">
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-400" />
                Question {qIndex + 1}
              </CardTitle>
              {!readOnly && values.questions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => removeQuestion(qIndex)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Libellé *</Label>
                  <Textarea
                    value={question.libelle}
                    onChange={(e) => updateQuestion(qIndex, { libelle: e.target.value })}
                    disabled={readOnly}
                    rows={2}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Section (optionnel)</Label>
                  <Input
                    value={question.section}
                    onChange={(e) => updateQuestion(qIndex, { section: e.target.value })}
                    disabled={readOnly}
                    placeholder="Ex. Communication"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type *</Label>
                  <Select
                    value={question.type}
                    onValueChange={(v) =>
                      updateQuestion(qIndex, { type: v as SondageQuestionType })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(QUESTION_TYPE_LABELS) as SondageQuestionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {QUESTION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`obligatoire-${qIndex}`}
                  checked={question.obligatoire}
                  onCheckedChange={(c) => updateQuestion(qIndex, { obligatoire: c === true })}
                  disabled={readOnly}
                />
                <Label htmlFor={`obligatoire-${qIndex}`} className="font-normal">
                  Question obligatoire
                </Label>
              </div>

              {question.type === "ChoixMultiple" && (
                <div className="space-y-1 max-w-xs">
                  <Label>Max. sélections</Label>
                  <Input
                    type="number"
                    min={1}
                    value={question.maxSelections}
                    onChange={(e) => updateQuestion(qIndex, { maxSelections: e.target.value })}
                    disabled={readOnly}
                    placeholder="Illimité"
                  />
                </div>
              )}

              {question.type === "TexteLibre" && (
                <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
                  <div className="space-y-1">
                    <Label>Min. caractères</Label>
                    <Input
                      type="number"
                      min={0}
                      value={question.minCaracteres}
                      onChange={(e) => updateQuestion(qIndex, { minCaracteres: e.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Max. caractères</Label>
                    <Input
                      type="number"
                      min={1}
                      value={question.maxCaracteres}
                      onChange={(e) => updateQuestion(qIndex, { maxCaracteres: e.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                </div>
              )}

              {(question.type === "ChoixUnique" ||
                question.type === "ChoixMultiple" ||
                question.type === "Matrice") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{question.type === "Matrice" ? "Colonnes" : "Options"}</Label>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateQuestion(qIndex, {
                            options: [
                              ...question.options,
                              {
                                ordre: question.options.length,
                                libelle: "",
                                permetTexteLibre: false,
                              },
                            ],
                          })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ajouter
                      </Button>
                    )}
                  </div>
                  {question.options.map((opt, oi) => (
                    <div key={oi} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input
                        value={opt.libelle}
                        onChange={(e) => {
                          const options = [...question.options];
                          options[oi] = { ...options[oi], libelle: e.target.value };
                          updateQuestion(qIndex, { options });
                        }}
                        disabled={readOnly}
                        placeholder={`Option ${oi + 1}`}
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <Checkbox
                          checked={opt.permetTexteLibre}
                          onCheckedChange={(c) => {
                            const options = [...question.options];
                            options[oi] = { ...options[oi], permetTexteLibre: c === true };
                            updateQuestion(qIndex, { options });
                          }}
                          disabled={readOnly}
                        />
                        <span className="text-xs text-muted-foreground">Autre (texte)</span>
                        {!readOnly && question.options.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateQuestion(qIndex, {
                                options: question.options.filter((_, i) => i !== oi),
                              })
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {question.type === "Matrice" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Lignes du tableau</Label>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateQuestion(qIndex, {
                            lignesMatrice: [
                              ...question.lignesMatrice,
                              { ordre: question.lignesMatrice.length, libelle: "" },
                            ],
                          })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ligne
                      </Button>
                    )}
                  </div>
                  {question.lignesMatrice.map((ligne, li) => (
                    <div key={li} className="flex gap-2">
                      <Input
                        value={ligne.libelle}
                        onChange={(e) => {
                          const lignesMatrice = [...question.lignesMatrice];
                          lignesMatrice[li] = { ...lignesMatrice[li], libelle: e.target.value };
                          updateQuestion(qIndex, { lignesMatrice });
                        }}
                        disabled={readOnly}
                        placeholder={`Ligne ${li + 1}`}
                        className="flex-1"
                      />
                      {!readOnly && question.lignesMatrice.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateQuestion(qIndex, {
                              lignesMatrice: question.lignesMatrice.filter((_, i) => i !== li),
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
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
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {sondageId ? "Enregistrer le brouillon" : "Créer le sondage"}
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
  questions: Array<{
    ordre: number;
    section: string | null;
    libelle: string;
    type: SondageQuestionType;
    obligatoire: boolean;
    maxSelections: number | null;
    minCaracteres: number | null;
    maxCaracteres: number | null;
    options: Array<{ ordre: number; libelle: string; permetTexteLibre: boolean }>;
    lignesMatrice: Array<{ ordre: number; libelle: string }>;
  }>;
}): SondageFormValues {
  return {
    sujet: detail.sujet,
    introduction: detail.introduction || "",
    conclusion: detail.conclusion || "",
    dateDebut: toDatetimeLocalValue(detail.dateDebut),
    dateFin: toDatetimeLocalValue(detail.dateFin),
    publier: false,
    questions: detail.questions.map((q) => ({
      ordre: q.ordre,
      section: q.section || "",
      libelle: q.libelle,
      type: q.type,
      obligatoire: q.obligatoire,
      maxSelections: q.maxSelections?.toString() ?? "",
      minCaracteres: q.minCaracteres?.toString() ?? "",
      maxCaracteres: q.maxCaracteres?.toString() ?? "",
      options: q.options.length
        ? q.options.map((o) => ({
            ordre: o.ordre,
            libelle: o.libelle,
            permetTexteLibre: o.permetTexteLibre,
          }))
        : [{ ordre: 0, libelle: "", permetTexteLibre: false }],
      lignesMatrice: q.lignesMatrice.length
        ? q.lignesMatrice.map((l) => ({ ordre: l.ordre, libelle: l.libelle }))
        : [{ ordre: 0, libelle: "" }],
    })),
  };
}
