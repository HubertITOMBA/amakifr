"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Send,
  Ban,
  Users,
  Eye,
  BarChart3,
} from "lucide-react";
import { toast } from "react-toastify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SondageForm,
  mapSondageDetailToFormValues,
} from "@/components/sondages/SondageForm";
import {
  closeSondage,
  getSondageByIdAdmin,
  getSondageParticipationAdmin,
  getSondageReponseByAdherentAdmin,
  publishSondage,
} from "@/actions/sondages";
import { SondageSynthesePanel } from "@/components/sondages/SondageSynthesePanel";

const STATUS_COLORS: Record<string, string> = {
  Brouillon: "bg-slate-100 text-slate-800",
  Ouvert: "bg-green-100 text-green-800",
  Cloture: "bg-red-100 text-red-800",
};

/**
 * Page admin : détail, édition (brouillon) et suivi des réponses
 */
export default function AdminSondageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sondage, setSondage] = useState<Awaited<ReturnType<typeof getSondageByIdAdmin>>["data"]>(null);
  const [participation, setParticipation] = useState<
    Awaited<ReturnType<typeof getSondageParticipationAdmin>>["data"] | null
  >(null);
  const [reponseDetail, setReponseDetail] = useState<
    Awaited<ReturnType<typeof getSondageReponseByAdherentAdmin>>["data"] | null
  >(null);
  const [reponseDialogOpen, setReponseDialogOpen] = useState(false);
  const [loadingReponse, setLoadingReponse] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, partRes] = await Promise.all([
        getSondageByIdAdmin(id),
        getSondageParticipationAdmin(id),
      ]);

      if (!detailRes.success || !detailRes.data) {
        toast.error(detailRes.error || "Sondage introuvable");
        router.push("/admin/sondages");
        return;
      }

      setSondage(detailRes.data);
      if (partRes.success && partRes.data) {
        setParticipation(partRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handlePublish = async () => {
    const res = await publishSondage(id);
    if (res.success) {
      toast.success(res.message || "Publié");
      loadAll();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleClose = async () => {
    if (!confirm("Clôturer ce sondage ?")) return;
    const res = await closeSondage(id);
    if (res.success) {
      toast.success(res.message || "Clôturé");
      loadAll();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const viewReponse = async (adherentId: string) => {
    setLoadingReponse(true);
    setReponseDialogOpen(true);
    setReponseDetail(null);
    try {
      const res = await getSondageReponseByAdherentAdmin(id, adherentId);
      if (res.success && res.data) {
        setReponseDetail(res.data);
      } else {
        toast.error(res.error || "Réponse introuvable");
        setReponseDialogOpen(false);
      }
    } finally {
      setLoadingReponse(false);
    }
  };

  if (loading || !sondage) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isBrouillon = sondage.status === "Brouillon";
  const tauxParticipation =
    participation && participation.totalActifs > 0
      ? Math.round((participation.totalReponses / participation.totalActifs) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Link href="/admin/sondages">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Liste
            </Button>
          </Link>
          <div className="flex gap-2">
            {isBrouillon && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handlePublish}>
                <Send className="h-4 w-4 mr-1" />
                Publier
              </Button>
            )}
            {sondage.status === "Ouvert" && (
              <Button size="sm" variant="destructive" onClick={handleClose}>
                <Ban className="h-4 w-4 mr-1" />
                Clôturer
              </Button>
            )}
          </div>
        </div>

        <Card className="shadow-lg border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5" />
                {sondage.sujet}
              </CardTitle>
              <Badge className={STATUS_COLORS[sondage.status]}>{sondage.status}</Badge>
            </div>
            <p className="text-blue-100 text-sm mt-1">
              {new Date(sondage.dateDebut).toLocaleString("fr-FR")} →{" "}
              {new Date(sondage.dateFin).toLocaleString("fr-FR")}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue={isBrouillon ? "edition" : "participation"}>
              <TabsList className="mb-4">
                {isBrouillon && <TabsTrigger value="edition">Édition</TabsTrigger>}
                <TabsTrigger value="participation">
                  <Users className="h-4 w-4 mr-1" />
                  Participation
                </TabsTrigger>
                <TabsTrigger value="synthese">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Synthèse
                </TabsTrigger>
                <TabsTrigger value="apercu">Aperçu</TabsTrigger>
              </TabsList>

              {isBrouillon && (
                <TabsContent value="edition">
                  <SondageForm
                    sondageId={id}
                    initialData={mapSondageDetailToFormValues(sondage)}
                    onSuccess={() => loadAll()}
                  />
                </TabsContent>
              )}

              <TabsContent value="participation" className="space-y-4">
                {participation && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatBox label="Adhérents actifs" value={participation.totalActifs} />
                      <StatBox label="Réponses" value={participation.totalReponses} />
                      <StatBox label="Taux" value={`${tauxParticipation} %`} />
                      <StatBox label="Questions" value={sondage.questionCount} />
                    </div>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                          <tr>
                            <th className="text-left p-2 font-bold">Adhérent</th>
                            <th className="text-left p-2 font-bold hidden sm:table-cell">Email</th>
                            <th className="text-center p-2 font-bold">Statut</th>
                            <th className="text-center p-2 font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participation.participants.map((p) => (
                            <tr key={p.adherentId} className="border-t border-slate-200">
                              <td className="p-2">{p.nomComplet}</td>
                              <td className="p-2 hidden sm:table-cell text-muted-foreground truncate max-w-[200px]">
                                {p.email || "—"}
                              </td>
                              <td className="p-2 text-center">
                                <Badge
                                  className={
                                    p.aRepondu
                                      ? "bg-green-100 text-green-800"
                                      : "bg-amber-100 text-amber-800"
                                  }
                                >
                                  {p.aRepondu ? "Répondu" : "En attente"}
                                </Badge>
                              </td>
                              <td className="p-2 text-center">
                                {p.aRepondu && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-blue-300"
                                    onClick={() => viewReponse(p.adherentId)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="synthese">
                <SondageSynthesePanel sondageId={id} />
              </TabsContent>

              <TabsContent value="apercu" className="space-y-4">
                {sondage.introduction && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sondage.introduction}</p>
                )}
                {sondage.questions.map((q, i) => (
                  <Card key={q.id}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium">
                        {i + 1}. {q.libelle}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {q.type}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground pb-3">
                      {q.type === "TexteLibre" && <p>Champ texte libre</p>}
                      {q.options.length > 0 && (
                        <ul className="list-disc pl-5">
                          {q.options.map((o) => (
                            <li key={o.id}>{o.libelle}</li>
                          ))}
                        </ul>
                      )}
                      {q.lignesMatrice.length > 0 && (
                        <p className="mt-1">{q.lignesMatrice.length} ligne(s) matrice</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={reponseDialogOpen} onOpenChange={setReponseDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Réponse adhérent</DialogTitle>
          </DialogHeader>
          {loadingReponse || !reponseDetail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <strong>{reponseDetail.adherent.nomComplet}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Soumise le {new Date(reponseDetail.soumiseLe).toLocaleString("fr-FR")}
              </p>
              {reponseDetail.items.map((item, idx) => (
                <div key={idx} className="border-t pt-2">
                  <p className="font-medium">{item.questionLibelle}</p>
                  <p className="text-muted-foreground">
                    {[item.ligneMatriceLibelle, item.optionLibelle, item.texteLibre]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-blue-800">{value}</p>
    </div>
  );
}
