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
  Plus,
  RefreshCw,
  Lock,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SondageForm,
  mapSondageDetailToFormValues,
} from "@/components/sondages/SondageForm";
import { SondageDatesEditor } from "@/components/sondages/SondageDatesEditor";
import { SondageCollapsibleSection } from "@/components/sondages/SondageCollapsibleSection";
import {
  closeSondage,
  getSondageByIdAdmin,
  getSondageParticipationAdmin,
  getSondagePublishAudiencePreview,
  getSondageReponseByAdherentAdmin,
  publishSondage,
  setSondageCorrigeVisiblesAdherents,
  setSondageResultatsVisiblesAdherents,
} from "@/actions/sondages";
import { SondageSynthesePanel } from "@/components/sondages/SondageSynthesePanel";
import { SondageLivePilotPanel } from "@/components/sondages/SondageLivePilotPanel";

const STATUS_COLORS: Record<string, string> = {
  Brouillon: "bg-slate-100 text-slate-800",
  Ouvert: "bg-green-100 text-green-800",
  Cloture: "bg-red-100 text-red-800",
};

/**
 * Page admin : détail, édition (brouillon) et suivi des réponses.
 * L’affichage n’écrit pas le statut en base (clôture effective = lecture seule).
 */
export default function AdminSondageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sondage, setSondage] = useState<
    Awaited<ReturnType<typeof getSondageByIdAdmin>>["data"]
  >(null);
  const [participation, setParticipation] = useState<
    Awaited<ReturnType<typeof getSondageParticipationAdmin>>["data"] | null
  >(null);
  const [reponseDetail, setReponseDetail] = useState<
    Awaited<ReturnType<typeof getSondageReponseByAdherentAdmin>>["data"] | null
  >(null);
  const [reponseDialogOpen, setReponseDialogOpen] = useState(false);
  const [loadingReponse, setLoadingReponse] = useState(false);
  const [togglingResultats, setTogglingResultats] = useState(false);
  const [togglingCorrige, setTogglingCorrige] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishAudience, setPublishAudience] = useState<string | null>(null);
  const [publishAudienceLoading, setPublishAudienceLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Charge le détail et la participation.
   * En mode `quiet`, ne remonte pas le spinner plein page afin de
   * conserver la saisie en cours dans le formulaire d’ajout.
   */
  const loadAll = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const quiet = Boolean(opts?.quiet);
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const [detailRes, partRes] = await Promise.all([
          getSondageByIdAdmin(id),
          getSondageParticipationAdmin(id),
        ]);

        if (!detailRes.success || !detailRes.data) {
          toast.error(detailRes.error || "Sondage introuvable");
          if (!quiet) {
            router.push("/admin/sondages");
          }
          return;
        }

        setSondage(detailRes.data);
        if (partRes.success && partRes.data) {
          setParticipation(partRes.data);
        }
      } finally {
        if (quiet) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [id, router]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /**
   * Actualise la liste des questions depuis le serveur sans perdre
   * le brouillon de saisie du formulaire « Ajouter des questions ».
   */
  const handleRefreshQuestions = useCallback(async () => {
    await loadAll({ quiet: true });
    toast.info("Liste des questions actualisée");
  }, [loadAll]);

  /**
   * Ouvre la confirmation de publication avec le détail de l’audience.
   */
  const openPublishDialog = async () => {
    setPublishDialogOpen(true);
    setPublishAudienceLoading(true);
    setPublishAudience(null);
    try {
      const preview = await getSondagePublishAudiencePreview();
      if (preview.success) {
        setPublishAudience(preview.message);
      } else {
        setPublishAudience(
          preview.error ||
            "Impossible de charger le nombre d’adhérents concernés."
        );
      }
    } catch {
      setPublishAudience("Impossible de charger le nombre d’adhérents concernés.");
    } finally {
      setPublishAudienceLoading(false);
    }
  };

  const handlePublishConfirm = async () => {
    setPublishing(true);
    try {
      const res = await publishSondage(id);
      if (res.success) {
        toast.success(res.message || "Publié");
        setPublishDialogOpen(false);
        loadAll();
      } else {
        toast.error(res.error || "Erreur");
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleClose = async () => {
    const label =
      sondage?.kind === "Quiz" ? "Clôturer le quiz ?" : "Clôturer ce sondage ?";
    if (!confirm(label)) return;
    const res = await closeSondage(id);
    if (res.success) {
      toast.success(res.message || "Clôturé");
      loadAll();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  /**
   * Action isolée : uniquement resultatsVisiblesAdherents (ADMIN).
   * Ne passe jamais par updateSondageDates.
   */
  const handleToggleResultatsAdherents = async (
    e: React.MouseEvent,
    visibles: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setTogglingResultats(true);
    try {
      const res = await setSondageResultatsVisiblesAdherents({ id, visibles });
      if (res.success) {
        toast.success(
          res.message ||
            (visibles
              ? "Résultats collectifs autorisés à la consultation"
              : "Résultats collectifs retirés de la consultation")
        );
        await loadAll();
      } else {
        toast.error(res.error || "Impossible d’enregistrer l’autorisation");
      }
    } catch {
      toast.error("Impossible d’enregistrer l’autorisation des résultats");
    } finally {
      setTogglingResultats(false);
    }
  };

  /**
   * Publication du corrigé quiz — indépendante des résultats collectifs.
   */
  const handleToggleCorrigeAdherents = async (
    e: React.MouseEvent,
    visibles: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setTogglingCorrige(true);
    try {
      const res = await setSondageCorrigeVisiblesAdherents({ id, visibles });
      if (res.success) {
        toast.success(
          res.message ||
            (visibles ? "Corrigé publié" : "Corrigé retiré")
        );
        await loadAll();
      } else {
        toast.error(res.error || "Impossible d’enregistrer le corrigé");
      }
    } catch {
      toast.error("Impossible d’enregistrer la publication du corrigé");
    } finally {
      setTogglingCorrige(false);
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

  const statusEffectif = sondage.statusEffectif ?? sondage.status;
  const statusLabel = sondage.statusLabel ?? sondage.status;
  const statusBadgeKey = sondage.statusBadgeKey ?? sondage.status;
  const isBrouillon = statusEffectif === "Brouillon";
  const isOuvertEffectif = statusEffectif === "Ouvert";
  const isTermineEffectif = statusEffectif === "Cloture";
  const tauxParticipation =
    participation && participation.totalActifs > 0
      ? Math.round(
          (participation.totalReponses / participation.totalActifs) * 100
        )
      : 0;

  const isQuizEnDirect =
    sondage.kind === "Quiz" && Boolean(sondage.modeEnDirect);
  const defaultTab = isBrouillon
    ? "edition"
    : "participation";

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-lg">
      {/*
        Conteneur commun centré dans l’espace à droite de la sidebar :
        bandeau, pilote, dates, questions et onglets partagent les mêmes bords.
      */}
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Link href="/admin/sondages">
            <Button type="button" variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Liste
            </Button>
          </Link>
          <div className="flex flex-wrap gap-2">
            {isBrouillon && (
              <Button
                type="button"
                size="sm"
                className="bg-blue-700 text-white hover:bg-blue-800 font-semibold"
                onClick={openPublishDialog}
              >
                <Send className="h-4 w-4 mr-1" />
                {sondage.kind === "Quiz"
                  ? "Publier le quiz"
                  : "Publier le sondage"}
              </Button>
            )}
            {isOuvertEffectif && !isQuizEnDirect && (
              <Button
                type="button"
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700 font-semibold"
                onClick={handleClose}
              >
                <Ban className="h-4 w-4 mr-1" />
                {sondage.kind === "Quiz" ? "Clôturer le quiz" : "Clôturer le sondage"}
              </Button>
            )}
          </div>
        </div>

        <Card className="w-full min-w-0 shadow-lg border-blue-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 sm:px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-start gap-2 text-lg min-w-0 flex-1 pr-0 sm:pr-4">
                <ClipboardList className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="break-words leading-snug">{sondage.sujet}</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                <Badge
                  className={
                    sondage.kind === "Quiz"
                      ? "bg-white text-blue-900 px-2.5 py-1 font-semibold"
                      : "bg-white/20 text-white px-2.5 py-1"
                  }
                >
                  {sondage.kindLabel ?? sondage.kind ?? "Sondage"}
                </Badge>
                {sondage.modeEnDirect ? (
                  <Badge className="bg-emerald-200 text-emerald-950 px-2.5 py-1 font-semibold border border-emerald-600">
                    En direct
                  </Badge>
                ) : null}
                <Badge
                  className={`${STATUS_COLORS[statusBadgeKey] || ""} px-2.5 py-1 font-semibold`}
                >
                  {statusLabel}
                </Badge>
              </div>
            </div>
            <p className="text-blue-100 text-sm mt-3">
              {new Date(sondage.dateDebut).toLocaleString("fr-FR")} →{" "}
              {new Date(sondage.dateFin).toLocaleString("fr-FR")}
            </p>
          </CardHeader>
          <CardContent className="pt-4 pb-4 space-y-5 min-w-0 px-0">
            {sondage.kind === "Quiz" ? (
              <div className="w-full min-w-0 px-4 sm:px-6">
                <SondageLivePilotPanel
                  sondageId={sondage.id}
                  modeEnDirect={Boolean(sondage.modeEnDirect)}
                  status={statusEffectif}
                  questions={sondage.questions.map((q) => ({
                    id: q.id,
                    ordre: q.ordre,
                    libelle: q.libelle,
                    liveEtat: q.liveEtat,
                  }))}
                  onChanged={() => void loadAll({ quiet: true })}
                  onCloturerQuiz={
                    isOuvertEffectif && isQuizEnDirect
                      ? handleClose
                      : undefined
                  }
                />
              </div>
            ) : null}

            <div className="w-full min-w-0 px-4 sm:px-6">
              <SondageCollapsibleSection
                className="w-full min-w-0"
                title={
                  isTermineEffectif && sondage.kind === "Quiz"
                    ? "Dates du quiz"
                    : "Modifier les dates"
                }
              >
                {/* Champs courts : largeur limitée à l’intérieur de la section pleine largeur */}
                <div className="w-full max-w-md sm:max-w-lg">
                  <SondageDatesEditor
                    sondageId={sondage.id}
                    dateDebut={sondage.dateDebut}
                    dateFin={sondage.dateFin}
                    statusEffectif={statusEffectif}
                    onSuccess={() => void loadAll({ quiet: true })}
                  />
                </div>
              </SondageCollapsibleSection>
            </div>

            {isOuvertEffectif ? (
              <div className="w-full min-w-0 space-y-4 px-4 sm:px-6">
                <section
                  className="w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                  aria-labelledby="questions-enregistrees-heading"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <h2
                      id="questions-enregistrees-heading"
                      className="text-sm font-semibold text-slate-800 flex items-center gap-2"
                    >
                      <Lock
                        className="h-3.5 w-3.5 text-slate-500 shrink-0"
                        aria-hidden
                      />
                      Questions enregistrées ({sondage.questions.length})
                    </h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-slate-300 text-slate-700 hover:bg-slate-50"
                      onClick={() => void handleRefreshQuestions()}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Actualiser
                    </Button>
                  </div>
                  {sondage.questions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">
                      Aucune question enregistrée pour le moment.
                    </p>
                  ) : (
                    <ol className="divide-y divide-slate-100">
                      {sondage.questions.map((q, i) => (
                        <li
                          key={q.id}
                          className="flex items-start gap-3 px-4 py-2.5 text-sm"
                        >
                          <span className="shrink-0 font-mono text-xs font-semibold text-slate-500 w-6 pt-0.5">
                            {i + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900 break-words">
                              {q.libelle}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {q.type}
                              </Badge>
                              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                Lecture seule
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                <SondageCollapsibleSection
                  className="w-full min-w-0"
                  title="Ajouter des questions"
                  icon={<Plus className="h-4 w-4 shrink-0" aria-hidden />}
                  defaultOpen
                >
                  <SondageForm
                    sondageId={id}
                    addQuestionsOnly
                    initialData={{
                      kind: sondage.kind ?? "Sondage",
                      questions: undefined,
                    }}
                    onSuccess={() => void loadAll({ quiet: true })}
                  />
                </SondageCollapsibleSection>
              </div>
            ) : null}

            <Tabs defaultValue={defaultTab} className="w-full min-w-0 px-4 sm:px-6">
              <TabsList className="mb-4 flex flex-wrap h-auto gap-1 w-full justify-start">
                {isBrouillon && (
                  <TabsTrigger value="edition">Édition</TabsTrigger>
                )}
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
                <TabsContent value="edition" className="min-w-0">
                  <div className="w-full min-w-0">
                    <p className="text-sm text-slate-600 mb-4">
                      Corrigez le contenu (questions, choix
                      {sondage.kind === "Quiz" ? ", bonne réponse" : ""}) puis
                      enregistrez le brouillon. La publication se fait via le
                      bouton en haut de page.
                    </p>
                    <SondageForm
                      sondageId={id}
                      initialData={mapSondageDetailToFormValues(sondage)}
                      onSuccess={() => loadAll()}
                    />
                  </div>
                </TabsContent>
              )}

              <TabsContent value="participation" className="space-y-4 min-w-0">
                {participation && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatBox
                        label="Adhérents actifs"
                        value={participation.totalActifs}
                      />
                      <StatBox
                        label="Réponses"
                        value={participation.totalReponses}
                      />
                      <StatBox label="Taux" value={`${tauxParticipation} %`} />
                      <StatBox
                        label="Questions"
                        value={sondage.questionCount}
                      />
                    </div>
                    <div className="rounded-md border overflow-x-auto max-w-full">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                          <tr>
                            <th className="text-left p-2 font-bold min-w-[140px]">
                              Adhérent
                            </th>
                            <th className="text-left p-2 font-bold hidden sm:table-cell">
                              Email
                            </th>
                            <th className="text-center p-2 font-bold">Statut</th>
                            <th className="text-center p-2 font-bold">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {participation.participants.map((p) => (
                            <tr
                              key={p.adherentId}
                              className="border-t border-slate-200"
                            >
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
                                    type="button"
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

              <TabsContent value="synthese" className="space-y-4 min-w-0">
                {isTermineEffectif ? (
                  <>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-slate-700">
                        <p className="font-semibold">
                          Consultation adhérent des résultats collectifs
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Indépendant du corrigé. La clôture seule ne publie
                          pas les agrégats.
                          {sondage.resultatsCollectifsPublies
                            ? " Actuellement visibles pour les adhérents."
                            : " Actuellement masqués."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={togglingResultats}
                        className={
                          sondage.resultatsVisiblesAdherents
                            ? "border-red-300 hover:bg-red-50"
                            : "border-blue-300 hover:bg-blue-50"
                        }
                        onClick={(e) =>
                          void handleToggleResultatsAdherents(
                            e,
                            !sondage.resultatsVisiblesAdherents
                          )
                        }
                      >
                        {togglingResultats ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : null}
                        {sondage.resultatsVisiblesAdherents
                          ? "Retirer la consultation"
                          : "Autoriser la consultation"}
                      </Button>
                    </div>
                    {sondage.kind === "Quiz" ? (
                      <div className="rounded-md border border-teal-200 bg-teal-50/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm text-slate-700">
                          <p className="font-semibold text-teal-900">
                            Publication du corrigé (quiz)
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Réservé ADMIN après clôture. Tant que masqué, les
                            adhérents ne voient ni bonne réponse, ni
                            explication, ni score.
                            {sondage.corrigePublie
                              ? " Corrigé actuellement visible."
                              : " Corrigé actuellement masqué."}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={togglingCorrige}
                          className={
                            sondage.corrigeVisiblesAdherents
                              ? "border-red-300 hover:bg-red-50"
                              : "border-teal-300 hover:bg-teal-50"
                          }
                          onClick={(e) =>
                            void handleToggleCorrigeAdherents(
                              e,
                              !sondage.corrigeVisiblesAdherents
                            )
                          }
                        >
                          {togglingCorrige ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : null}
                          {sondage.corrigeVisiblesAdherents
                            ? "Retirer le corrigé"
                            : "Publier le corrigé"}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    L&apos;autorisation des résultats collectifs
                    {sondage.kind === "Quiz" ? " et du corrigé" : ""} sera
                    disponible lorsque le questionnaire sera terminé (clôture
                    ou échéance passée).
                  </p>
                )}
                <SondageSynthesePanel sondageId={id} />
              </TabsContent>

              <TabsContent value="apercu" className="space-y-4 min-w-0">
                {sondage.introduction && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {sondage.introduction}
                  </p>
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
                        <p className="mt-1">
                          {q.lignesMatrice.length} ligne(s) matrice
                        </p>
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
                Soumise le{" "}
                {new Date(reponseDetail.soumiseLe).toLocaleString("fr-FR")}
              </p>
              {reponseDetail.items.map((item, idx) => (
                <div key={idx} className="border-t pt-2">
                  <p className="font-medium">{item.questionLibelle}</p>
                  <p className="text-muted-foreground">
                    {[
                      item.ligneMatriceLibelle,
                      item.optionLibelle,
                      item.texteLibre,
                    ]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sondage?.kind === "Quiz"
                ? "Publier le quiz ?"
                : "Publier le sondage ?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Une fois publié, les adhérents concernés pourront y répondre
                  selon les dates définies.
                </p>
                {publishAudienceLoading ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calcul de l’audience…
                  </p>
                ) : (
                  <p className="text-slate-800 font-medium">
                    {publishAudience}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-700 hover:bg-blue-800"
              disabled={publishing || publishAudienceLoading}
              onClick={(e) => {
                e.preventDefault();
                void handlePublishConfirm();
              }}
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publication…
                </>
              ) : sondage?.kind === "Quiz" ? (
                "Confirmer la publication du quiz"
              ) : (
                "Confirmer la publication du sondage"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold text-blue-800">{value}</p>
    </div>
  );
}
