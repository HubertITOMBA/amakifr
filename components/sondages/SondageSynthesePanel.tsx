"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Download, Printer } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  generateSondageSynthesePdf,
  getSondageSyntheseAdmin,
} from "@/actions/sondages";

type SyntheseData = NonNullable<
  Awaited<ReturnType<typeof getSondageSyntheseAdmin>>["data"]
>;

interface SondageSynthesePanelProps {
  sondageId: string;
}

/**
 * Panneau de synthèse des résultats avec export PDF.
 */
export function SondageSynthesePanel({ sondageId }: SondageSynthesePanelProps) {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [synthese, setSynthese] = useState<SyntheseData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSondageSyntheseAdmin(sondageId);
      if (res.success && res.data) {
        setSynthese(res.data);
      } else {
        toast.error(res.error || "Erreur de chargement");
      }
    } finally {
      setLoading(false);
    }
  }, [sondageId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await generateSondageSynthesePdf(sondageId);
      if (!res.success || !res.data) {
        toast.error(res.error || "Erreur d'export");
        return;
      }

      const link = document.createElement("a");
      link.href = res.data;
      link.download = res.fileName || "synthese_sondage.pdf";
      link.click();
      toast.success(res.message || "PDF téléchargé");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setExporting(true);
    try {
      const res = await generateSondageSynthesePdf(sondageId);
      if (!res.success || !res.data) {
        toast.error(res.error || "Erreur d'impression");
        return;
      }
      const w = window.open(res.data, "_blank");
      w?.print();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'impression");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!synthese) {
    return <p className="text-sm text-muted-foreground">Synthèse indisponible.</p>;
  }

  let lastSection: string | null = null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-start">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          <MiniStat
            label="Réponses"
            value={synthese.totalReponses}
            tone="blue"
          />
          <MiniStat
            label="Adhérents actifs"
            value={synthese.totalAdherentsActifs}
            tone="sky"
          />
          <MiniStat
            label="Taux"
            value={`${synthese.tauxParticipation} %`}
            tone="teal"
          />
          <MiniStat
            label="Questions"
            value={synthese.questions.length}
            tone="indigo"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={exporting}
            className="border-blue-300"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-1" />
            )}
            Imprimer
          </Button>
          <Button
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Généré le {new Date(synthese.generatedAt).toLocaleString("fr-FR")} — les pourcentages
        sont calculés sur le nombre de répondants par question.
      </p>

      {synthese.questions.map((question) => {
        const showSection = question.section && question.section !== lastSection;
        if (showSection) lastSection = question.section;

        return (
          <div key={question.id}>
            {showSection && (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700 mt-4 mb-2">
                {question.section}
              </h3>
            )}
            <Card className="border-slate-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium leading-snug">
                  {question.ordre + 1}. {question.libelle}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {question.participations} réponse(s)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                {question.choix?.map((opt, optIdx) => (
                  <div key={opt.optionId} className="space-y-1">
                    <div className="flex justify-between text-sm gap-2 text-slate-800 dark:text-slate-100">
                      <span className="min-w-0 break-words">{opt.libelle}</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300 shrink-0 tabular-nums">
                        {opt.count} — {opt.percent} %
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden print:bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all print:bg-slate-600 ${
                          optIdx % 2 === 0
                            ? "bg-gradient-to-r from-blue-500 to-blue-600"
                            : "bg-gradient-to-r from-teal-400 to-teal-500"
                        }`}
                        style={{ width: `${Math.min(100, opt.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}

                {question.matrice?.map((ligne) => (
                  <div key={ligne.ligneId} className="border-t pt-2 first:border-0 first:pt-0">
                    <p className="text-sm font-medium mb-2 text-slate-800 dark:text-slate-100">
                      {ligne.libelle}
                    </p>
                    <div className="space-y-2 pl-2">
                      {ligne.colonnes.map((col, colIdx) => (
                        <div key={col.optionId} className="space-y-1">
                          <div className="flex justify-between text-xs gap-2 text-slate-800 dark:text-slate-100">
                            <span className="min-w-0 break-words">{col.libelle}</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                              {col.count} — {col.percent} %
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden print:bg-slate-200">
                            <div
                              className={`h-full rounded-full print:bg-slate-600 ${
                                colIdx % 2 === 0
                                  ? "bg-gradient-to-r from-blue-500 to-blue-600"
                                  : "bg-gradient-to-r from-teal-400 to-teal-500"
                              }`}
                              style={{ width: `${Math.min(100, col.percent)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {question.textes && question.textes.length > 0 && (
                  <ul className="text-sm space-y-2 list-disc pl-5 text-slate-700 dark:text-slate-300">
                    {question.textes.map((t, i) => (
                      <li key={i} className="whitespace-pre-wrap">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}

                {question.type === "TexteLibre" && (!question.textes || question.textes.length === 0) && (
                  <p className="text-sm text-muted-foreground italic">Aucune réponse.</p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

const MINI_STAT_TONES = {
  blue: {
    box: "border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/40 print:border-slate-400 print:bg-blue-50",
    value: "text-blue-800 dark:text-blue-200 print:text-slate-900",
  },
  sky: {
    box: "border-sky-200 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/40 print:border-slate-400 print:bg-sky-50",
    value: "text-sky-800 dark:text-sky-200 print:text-slate-900",
  },
  teal: {
    box: "border-teal-200 bg-teal-50/80 dark:border-teal-800 dark:bg-teal-950/40 print:border-slate-400 print:bg-teal-50",
    value: "text-teal-800 dark:text-teal-200 print:text-slate-900",
  },
  indigo: {
    box: "border-indigo-200 bg-indigo-50/80 dark:border-indigo-800 dark:bg-indigo-950/40 print:border-slate-400 print:bg-indigo-50",
    value: "text-indigo-800 dark:text-indigo-200 print:text-slate-900",
  },
} as const;

type MiniStatTone = keyof typeof MINI_STAT_TONES;

/**
 * Indicateur compact de la synthèse — teintes légères, contraste conservé à l’écran.
 */
function MiniStat({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  tone?: MiniStatTone;
}) {
  const t = MINI_STAT_TONES[tone];
  return (
    <div className={`rounded-lg border p-3 text-center ${t.box}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300 print:text-slate-700">
        {label}
      </p>
      <p className={`text-lg font-bold tabular-nums ${t.value}`}>{value}</p>
    </div>
  );
}
