"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SondageReponseForm } from "@/components/sondages/SondageReponseForm";
import { getSondageForAdherent } from "@/actions/sondages";

/**
 * Page adhérent : répondre à un sondage / quiz, ou consulter la synthèse après clôture.
 */
export default function SondageReponsePage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getSondageForAdherent>>["data"]>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSondageForAdherent(id);
      if (!res.success || !res.data) {
        toast.error(res.error || "Sondage inaccessible");
        return;
      }
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const kindLabel = data?.kindLabel ?? data?.kind ?? "Sondage";
  const synthese = data?.synthesePersonnelle;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <Link href="/user/profile" className="inline-block mb-6">
          <Button variant="outline" size="sm" className="border-slate-300">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour au profil
          </Button>
        </Link>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : !data ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Ce sondage n&apos;est pas disponible.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="shadow-lg border-blue-200 dark:border-slate-700">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                <div className="flex items-start justify-between gap-2 pt-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardList className="h-5 w-5" />
                    {data.sujet}
                  </CardTitle>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="mt-1 bg-white text-blue-800 border border-blue-200 shadow-sm font-semibold">
                      {kindLabel}
                    </Badge>
                    <Badge
                      className={
                        data.modifiable
                          ? "bg-white text-green-700 border border-green-200 shadow-sm font-semibold"
                          : "bg-white text-red-700 border border-red-200 shadow-sm font-semibold"
                      }
                    >
                      {data.modifiable ? "Ouvert" : "Clôturé"}
                    </Badge>
                  </div>
                </div>
                <p className="text-blue-100 text-sm mt-2">
                  Jusqu&apos;au{" "}
                  {new Date(data.dateFin).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </CardHeader>
              {data.introduction && (
                <CardContent className="pt-4 pb-0">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.introduction}</p>
                </CardContent>
              )}
            </Card>

            {data.modifiable ? (
              <SondageReponseForm
                sondageId={id}
                questions={data.questions}
                modifiable={data.modifiable}
                initialItems={data.maReponse?.items}
                onSuccess={load}
              />
            ) : synthese ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Votre synthèse personnelle</CardTitle>
                  {synthese.corrigePublie && synthese.score ? (
                    <p className="text-sm font-semibold text-teal-700">
                      Score : {synthese.score.correct} / {synthese.score.total}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {!synthese.aRepondu ? (
                    <p className="text-sm text-muted-foreground">
                      {synthese.message ?? "Vous n’avez pas répondu"}
                    </p>
                  ) : (
                    synthese.questions.map((q) => (
                      <div
                        key={q.questionId}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1"
                      >
                        <p className="text-sm font-medium text-slate-900">{q.libelle}</p>
                        {q.reponses.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sans réponse</p>
                        ) : (
                          q.reponses.map((r, idx) => (
                            <p key={`${q.questionId}-${idx}`} className="text-sm text-slate-800">
                              {r}
                            </p>
                          ))
                        )}
                        {synthese.corrigePublie ? (
                          <div className="pt-2 mt-1 border-t border-slate-200 space-y-0.5">
                            {typeof q.estCorrecte === "boolean" ? (
                              <p
                                className={
                                  q.estCorrecte
                                    ? "text-xs font-semibold text-green-700"
                                    : "text-xs font-semibold text-red-700"
                                }
                              >
                                {q.estCorrecte ? "Bonne réponse" : "Réponse incorrecte"}
                              </p>
                            ) : null}
                            {q.bonneReponse ? (
                              <p className="text-xs text-slate-800">
                                Corrigé : {q.bonneReponse}
                              </p>
                            ) : null}
                            {q.explication ? (
                              <p className="text-xs text-muted-foreground">{q.explication}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Ce questionnaire est clôturé.
                </CardContent>
              </Card>
            )}

            {data.conclusion && (
              <p className="text-sm text-muted-foreground text-center whitespace-pre-wrap px-2">
                {data.conclusion}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
