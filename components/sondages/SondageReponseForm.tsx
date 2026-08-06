"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import type { SondageQuestionType } from "@prisma/client";
import { submitSondageReponse } from "@/actions/sondages";

type SondageQuestion = {
  id: string;
  ordre: number;
  section: string | null;
  libelle: string;
  type: SondageQuestionType;
  obligatoire: boolean;
  maxSelections: number | null;
  minCaracteres: number | null;
  maxCaracteres: number | null;
  options: Array<{
    id: string;
    ordre: number;
    libelle: string;
    permetTexteLibre: boolean;
  }>;
  lignesMatrice: Array<{ id: string; ordre: number; libelle: string }>;
};

type ReponseItem = {
  questionId: string;
  optionId?: string | null;
  ligneMatriceId?: string | null;
  texteLibre?: string | null;
};

interface SondageReponseFormProps {
  sondageId: string;
  questions: SondageQuestion[];
  modifiable: boolean;
  initialItems?: ReponseItem[];
  onSuccess?: () => void;
}

/**
 * Formulaire de réponse adhérent à un sondage.
 */
export function SondageReponseForm({
  sondageId,
  questions,
  modifiable,
  initialItems = [],
  onSuccess,
}: SondageReponseFormProps) {
  const [saving, setSaving] = useState(false);
  const [singleChoices, setSingleChoices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of initialItems) {
      if (item.optionId && !item.ligneMatriceId) {
        const q = questions.find((x) => x.id === item.questionId);
        if (q?.type === "ChoixUnique") map[item.questionId] = item.optionId;
      }
    }
    return map;
  });
  const [multiChoices, setMultiChoices] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const item of initialItems) {
      if (item.optionId && !item.ligneMatriceId) {
        const q = questions.find((x) => x.id === item.questionId);
        if (q?.type === "ChoixMultiple") {
          map[item.questionId] = [...(map[item.questionId] || []), item.optionId];
        }
      }
    }
    return map;
  });
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of initialItems) {
      if (item.texteLibre != null) {
        const q = questions.find((x) => x.id === item.questionId);
        if (q?.type === "TexteLibre") map[item.questionId] = item.texteLibre;
        else if (item.optionId) {
          const key = `${item.questionId}:${item.optionId}`;
          map[key] = item.texteLibre;
        }
      }
    }
    return map;
  });
  const [matrixChoices, setMatrixChoices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of initialItems) {
      if (item.ligneMatriceId && item.optionId) {
        map[`${item.questionId}:${item.ligneMatriceId}`] = item.optionId;
      }
    }
    return map;
  });

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.ordre - b.ordre),
    [questions]
  );

  const buildItems = (): ReponseItem[] => {
    const items: ReponseItem[] = [];

    for (const q of sortedQuestions) {
      if (q.type === "TexteLibre") {
        const text = textAnswers[q.id]?.trim();
        if (text) items.push({ questionId: q.id, texteLibre: text });
        continue;
      }

      if (q.type === "ChoixUnique") {
        const optionId = singleChoices[q.id];
        if (optionId) {
          items.push({
            questionId: q.id,
            optionId,
            texteLibre: textAnswers[`${q.id}:${optionId}`]?.trim() || null,
          });
        }
        continue;
      }

      if (q.type === "ChoixMultiple") {
        for (const optionId of multiChoices[q.id] || []) {
          items.push({
            questionId: q.id,
            optionId,
            texteLibre: textAnswers[`${q.id}:${optionId}`]?.trim() || null,
          });
        }
        continue;
      }

      if (q.type === "Matrice") {
        for (const ligne of q.lignesMatrice) {
          const optionId = matrixChoices[`${q.id}:${ligne.id}`];
          if (optionId) {
            items.push({
              questionId: q.id,
              ligneMatriceId: ligne.id,
              optionId,
            });
          }
        }
      }
    }

    return items;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifiable) {
      toast.info("Ce sondage est clôturé : vos réponses ne peuvent plus être modifiées");
      return;
    }

    setSaving(true);
    try {
      const result = await submitSondageReponse({
        sondageId,
        items: buildItems(),
      });

      if (!result.success) {
        toast.error(result.error || "Erreur lors de l'enregistrement");
        return;
      }

      toast.success(result.message || "Réponse enregistrée");
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  let lastSection: string | null = null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {sortedQuestions.map((q, index) => {
        const showSection = q.section && q.section !== lastSection;
        if (showSection) lastSection = q.section;

        return (
          <div key={q.id}>
            {showSection && (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 mt-6 mb-3">
                {q.section}
              </h3>
            )}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium leading-snug">
                  {index + 1}. {q.libelle}
                  {q.obligatoire && <span className="text-red-500 ml-1">*</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {q.type === "TexteLibre" && (
                  <Textarea
                    value={textAnswers[q.id] || ""}
                    onChange={(e) =>
                      setTextAnswers((p) => ({ ...p, [q.id]: e.target.value }))
                    }
                    disabled={!modifiable}
                    rows={4}
                    maxLength={q.maxCaracteres ?? undefined}
                    placeholder="Votre réponse..."
                  />
                )}

                {q.type === "ChoixUnique" && (
                  <RadioGroup
                    value={singleChoices[q.id] || ""}
                    onValueChange={(v) => setSingleChoices((p) => ({ ...p, [q.id]: v }))}
                    disabled={!modifiable}
                    className="space-y-2"
                  >
                    {q.options.map((opt) => (
                      <div key={opt.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={opt.id} id={`${q.id}-${opt.id}`} />
                          <Label htmlFor={`${q.id}-${opt.id}`} className="font-normal cursor-pointer">
                            {opt.libelle}
                          </Label>
                        </div>
                        {opt.permetTexteLibre && singleChoices[q.id] === opt.id && (
                          <InputAutre
                            value={textAnswers[`${q.id}:${opt.id}`] || ""}
                            onChange={(v) =>
                              setTextAnswers((p) => ({ ...p, [`${q.id}:${opt.id}`]: v }))
                            }
                            disabled={!modifiable}
                          />
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {q.type === "ChoixMultiple" && (
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const checked = (multiChoices[q.id] || []).includes(opt.id);
                      return (
                        <div key={opt.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`${q.id}-${opt.id}`}
                              checked={checked}
                              disabled={!modifiable}
                              onCheckedChange={(c) => {
                                setMultiChoices((p) => {
                                  const current = p[q.id] || [];
                                  const next =
                                    c === true
                                      ? [...current, opt.id]
                                      : current.filter((id) => id !== opt.id);
                                  return { ...p, [q.id]: next };
                                });
                              }}
                            />
                            <Label htmlFor={`${q.id}-${opt.id}`} className="font-normal cursor-pointer">
                              {opt.libelle}
                            </Label>
                          </div>
                          {opt.permetTexteLibre && checked && (
                            <InputAutre
                              value={textAnswers[`${q.id}:${opt.id}`] || ""}
                              onChange={(v) =>
                                setTextAnswers((p) => ({ ...p, [`${q.id}:${opt.id}`]: v }))
                              }
                              disabled={!modifiable}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === "Matrice" && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left p-2 border-b border-slate-200" />
                          {q.options.map((col) => (
                            <th
                              key={col.id}
                              className="p-2 border-b border-slate-200 text-center font-medium text-xs"
                            >
                              {col.libelle}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {q.lignesMatrice.map((ligne) => (
                          <tr key={ligne.id} className="border-b border-slate-100">
                            <td className="p-2 font-medium align-middle">{ligne.libelle}</td>
                            {q.options.map((col) => (
                              <td key={col.id} className="p-2 text-center align-middle">
                                <input
                                  type="radio"
                                  name={`matrix-${q.id}-${ligne.id}`}
                                  checked={matrixChoices[`${q.id}:${ligne.id}`] === col.id}
                                  disabled={!modifiable}
                                  onChange={() =>
                                    setMatrixChoices((p) => ({
                                      ...p,
                                      [`${q.id}:${ligne.id}`]: col.id,
                                    }))
                                  }
                                  className="h-4 w-4 accent-blue-600"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}

      {modifiable ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer ma réponse
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-slate-50 dark:bg-slate-900">
          Ce sondage est clôturé. Vous pouvez consulter vos réponses ci-dessus mais plus les modifier.
        </p>
      )}
    </form>
  );
}

function InputAutre({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Précisez..."
      className="ml-6 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600"
    />
  );
}
