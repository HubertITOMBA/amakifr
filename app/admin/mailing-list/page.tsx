"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Loader2,
  Mail,
  Search,
  Users,
  FileType,
  MapPin,
  History,
  Plus,
  RefreshCw,
  Trash2,
  MessageSquare,
  Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import DOMPurify from "isomorphic-dompurify";
import {
  generateMailingListDocument,
  getMailingListRecipients,
  getMailingCampaigns,
  getMailingCampaignById,
  updateMailingRecipientResponse,
  deleteMailingCampaign,
} from "@/actions/admin/mailing-list";
import { MAILING_LIST_PLACEHOLDERS } from "@/lib/mailing-list";
import { plainTextToMailingHtml } from "@/lib/mailing-list-html";
import { RichTextEditor } from "@/components/admin/rapports-reunion/RichTextEditor";

type RecipientRow = {
  adherentId: string;
  civilite: string;
  prenom: string;
  nom: string;
  nomComplet: string;
  adresseLigne1: string;
  codePostal: string;
  ville: string;
  email?: string;
  hasCompleteAddress: boolean;
};

type CampaignSummary = {
  id: string;
  objet: string;
  lieu: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  totalRecipients: number;
  reponsesCount: number;
  relancesCount: number;
  totalEnvois: number;
};

type CampaignDetail = {
  id: string;
  objet: string;
  corps: string;
  lieu: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  recipients: Array<{
    id: string;
    adherentId: string;
    civilite: string;
    prenom: string;
    nom: string;
    nomComplet: string;
    adresseLigne1: string;
    adresseLigne2?: string | null;
    codePostal: string;
    ville: string;
    format: string;
    statut: "Envoye" | "Relance" | "Repondu";
    sentAt: string;
    lastSentAt: string;
    sendCount: number;
    reponse: string | null;
    reponseAt: string | null;
  }>;
};

const DEFAULT_CORPS_PLAIN = `{{civilite}} {{nomComplet}},

Nous avons le plaisir de vous adresser les informations suivantes de la part de l'association AMAKI France.

[Votre texte ici]

Nous vous prions d'agréer, {{civilite}}, l'expression de nos salutations distinguées.`;

const DEFAULT_CORPS = plainTextToMailingHtml(DEFAULT_CORPS_PLAIN);

const STATUS_LABELS: Record<string, string> = {
  Envoye: "Envoyé",
  Relance: "Relancé",
  Repondu: "Répondu",
};

const STATUS_BADGE: Record<string, string> = {
  Envoye: "bg-blue-50 text-blue-700 border-blue-200",
  Relance: "bg-amber-50 text-amber-800 border-amber-200",
  Repondu: "bg-green-50 text-green-700 border-green-200",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Page admin : courriers postaux mailing list (PDF / Word) + historique
 */
export default function AdminMailingListPage() {
  const [tab, setTab] = useState("nouveau");
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [generating, setGenerating] = useState<"pdf" | "docx" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [objet, setObjet] = useState("Information de l'association AMAKI France");
  const [lieu, setLieu] = useState("Paris");
  const [corps, setCorps] = useState(DEFAULT_CORPS);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [savingResponseId, setSavingResponseId] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  const loadRecipients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMailingListRecipients();
      if (!res.success || !res.data) {
        toast.error(res.error || "Erreur lors du chargement");
        return;
      }
      setRecipients(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des adhérents");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await getMailingCampaigns();
      if (!res.success || !res.data) {
        toast.error(res.error || "Erreur historique");
        return;
      }
      setCampaigns(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadRecipients();
    loadCampaigns();
  }, [loadRecipients, loadCampaigns]);

  const filteredRecipients = useMemo(() => {
    let list = recipients;
    if (activeCampaignId && campaignDetail?.id === activeCampaignId) {
      const already = new Set(campaignDetail.recipients.map((r) => r.adherentId));
      // En mode campagne active, on affiche tous (pour relancer) mais on pré-coche les non déjà présents pour "ajout"
      list = recipients;
      void already;
    }
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter((r) =>
      [r.nomComplet, r.adresseLigne1, r.codePostal, r.ville, r.email || ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [recipients, searchTerm, activeCampaignId, campaignDetail]);

  const eligibleCount = useMemo(
    () => recipients.filter((r) => r.hasCompleteAddress).length,
    [recipients]
  );

  const existingCampaignAdherentIds = useMemo(() => {
    if (!activeCampaignId || campaignDetail?.id !== activeCampaignId) return new Set<string>();
    return new Set(campaignDetail.recipients.map((r) => r.adherentId));
  }, [activeCampaignId, campaignDetail]);

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredRecipients
      .filter((r) => r.hasCompleteAddress)
      .map((r) => r.adherentId);
    setSelectedIds(ids);
    toast.info(`${ids.length} adhérent(s) sélectionné(s)`);
  };

  const clearSelection = () => setSelectedIds([]);

  const insertPlaceholder = (key: string) => {
    setCorps((c) => `${c}${key}`);
  };

  const resetComposeForm = () => {
    setActiveCampaignId(null);
    setObjet("Information de l'association AMAKI France");
    setLieu("Paris");
    setCorps(DEFAULT_CORPS);
    setSelectedIds([]);
  };

  const handleGenerate = async (format: "pdf" | "docx") => {
    if (!objet.trim() || !corps.trim()) {
      toast.warning("Renseignez l'objet et le corps du courrier");
      return;
    }
    if (selectedIds.length === 0) {
      toast.warning("Sélectionnez au moins un destinataire");
      return;
    }

    setGenerating(format);
    try {
      const formData = new FormData();
      formData.append("objet", objet.trim());
      formData.append("corps", corps.trim());
      formData.append("lieu", lieu.trim() || "Paris");
      formData.append("format", format);
      if (activeCampaignId) formData.append("campaignId", activeCampaignId);
      selectedIds.forEach((id) => formData.append("adherentIds", id));

      const res = await generateMailingListDocument(formData);
      if (!res.success) {
        toast.error(res.error || "Échec de la génération");
        return;
      }
      if (!res.data || !res.fileName) {
        toast.error("Échec de la génération");
        return;
      }

      downloadDataUrl(res.data, res.fileName);
      toast.success(res.message || `Document ${format.toUpperCase()} généré`);

      if (res.campaignId) {
        setActiveCampaignId(res.campaignId);
      }
      await loadCampaigns();
      if (res.campaignId) {
        const detail = await getMailingCampaignById(res.campaignId);
        if (detail.success && detail.data) {
          setCampaignDetail(detail.data);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(null);
    }
  };

  const openCampaignDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setCampaignDetail(null);
    try {
      const res = await getMailingCampaignById(id);
      if (!res.success || !res.data) {
        toast.error(res.error || "Campagne introuvable");
        setDetailOpen(false);
        return;
      }
      setCampaignDetail(res.data);
      const drafts: Record<string, string> = {};
      res.data.recipients.forEach((r) => {
        drafts[r.id] = r.reponse || "";
      });
      setResponseDrafts(drafts);
    } catch (e) {
      console.error(e);
      toast.error("Erreur de chargement");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const continueCampaign = (detail: CampaignDetail) => {
    setActiveCampaignId(detail.id);
    setObjet(detail.objet);
    setLieu(detail.lieu);
    setCorps(detail.corps);
    setSelectedIds([]);
    setTab("nouveau");
    setDetailOpen(false);
    toast.info("Campagne chargée — sélectionnez destinataires à ajouter ou relancer");
  };

  const saveResponse = async (recipientId: string) => {
    setSavingResponseId(recipientId);
    try {
      const formData = new FormData();
      formData.append("recipientId", recipientId);
      formData.append("reponse", responseDrafts[recipientId] || "");
      const res = await updateMailingRecipientResponse(formData);
      if (!res.success) {
        toast.error(res.error || "Erreur");
        return;
      }
      toast.success(res.message || "Réponse enregistrée");
      if (campaignDetail) {
        setCampaignDetail({
          ...campaignDetail,
          recipients: campaignDetail.recipients.map((r) =>
            r.id === recipientId
              ? {
                  ...r,
                  reponse: res.data?.reponse ?? null,
                  reponseAt: res.data?.reponseAt ?? null,
                  statut: (res.data?.statut as CampaignDetail["recipients"][0]["statut"]) || r.statut,
                }
              : r
          ),
        });
      }
      await loadCampaigns();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingResponseId(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignDetail) return;
    setDeletingCampaign(true);
    try {
      const res = await deleteMailingCampaign(campaignDetail.id);
      if (!res.success) {
        toast.error(res.error || "Erreur");
        return;
      }
      toast.success(res.message || "Campagne supprimée");
      if (activeCampaignId === campaignDetail.id) resetComposeForm();
      setDetailOpen(false);
      setCampaignDetail(null);
      await loadCampaigns();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingCampaign(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Mail className="h-5 w-5 sm:h-6 sm:w-6" />
                Courriers postaux ({eligibleCount})
              </CardTitle>
              <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl">
                Rédigez, exportez, historisez les envois, enregistrez les réponses et
                relancez ou ajoutez des destinataires.
              </p>
            </div>
            {tab === "nouveau" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleGenerate("pdf")}
                  disabled={generating !== null}
                  className="bg-white text-blue-700 hover:bg-blue-50 shadow-sm"
                >
                  {generating === "pdf" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Exporter PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleGenerate("docx")}
                  disabled={generating !== null}
                  className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  {generating === "docx" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileType className="h-4 w-4 mr-2" />
                  )}
                  Exporter Word
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="nouveau" className="gap-1.5">
                <Plus className="h-4 w-4" />
                {activeCampaignId ? "Continuer la campagne" : "Nouveau courrier"}
              </TabsTrigger>
              <TabsTrigger value="historique" className="gap-1.5">
                <History className="h-4 w-4" />
                Historique ({campaigns.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nouveau" className="space-y-6 mt-0">
              {activeCampaignId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <span>
                    Mode campagne active — les destinataires déjà présents seront{" "}
                    <strong>relancés</strong>, les nouveaux seront <strong>ajoutés</strong>.
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={resetComposeForm}>
                    Nouvelle campagne
                  </Button>
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="objet">Objet du courrier *</Label>
                      <Input
                        id="objet"
                        value={objet}
                        onChange={(e) => setObjet(e.target.value)}
                        className="mt-1"
                        placeholder="Objet affiché sur le courrier"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lieu" className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        Lieu (ville et date)
                      </Label>
                      <Input
                        id="lieu"
                        value={lieu}
                        onChange={(e) => setLieu(e.target.value)}
                        className="mt-1"
                        placeholder="Paris"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Affiché à droite : « {lieu || "Paris"}, le … »
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label>Corps du courrier *</Label>
                    <div className="mt-1">
                      <RichTextEditor
                        value={corps}
                        onChange={setCorps}
                        placeholder="Rédigez votre courrier ici…"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Variables disponibles (cliquez pour insérer) :
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {MAILING_LIST_PLACEHOLDERS.map((p) => (
                        <Badge
                          key={p.key}
                          variant="outline"
                          className="text-[10px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          onClick={() => insertPlaceholder(p.key)}
                        >
                          {p.key}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground border-t border-slate-200 dark:border-slate-700 pt-3">
                    Chaque export est historisé. Vous pourrez ensuite enregistrer les réponses
                    adhérents et relancer / ajouter des destinataires.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4" />
                      Destinataires ({selectedIds.length} sélectionné
                      {selectedIds.length > 1 ? "s" : ""})
                    </Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                        Tout sélectionner
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                        Effacer
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher nom, adresse, ville..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-[520px] overflow-y-auto divide-y dark:divide-slate-700 border-slate-200 dark:border-slate-700">
                      {filteredRecipients.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground text-center">
                          Aucun adhérent avec adresse postale
                        </p>
                      ) : (
                        filteredRecipients.map((r) => {
                          const checked = selectedIds.includes(r.adherentId);
                          const alreadyInCampaign = existingCampaignAdherentIds.has(r.adherentId);
                          return (
                            <label
                              key={r.adherentId}
                              className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                                !r.hasCompleteAddress ? "opacity-60" : ""
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={!r.hasCompleteAddress}
                                onCheckedChange={(v) => toggleOne(r.adherentId, v === true)}
                                className="mt-1"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm">
                                  {r.civilite} {r.prenom} {r.nom}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {r.adresseLigne1}
                                  {r.codePostal || r.ville
                                    ? ` — ${[r.codePostal, r.ville].filter(Boolean).join(" ")}`
                                    : ""}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {!r.hasCompleteAddress && (
                                    <Badge variant="destructive" className="text-[10px]">
                                      Adresse incomplète
                                    </Badge>
                                  )}
                                  {alreadyInCampaign && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-amber-300 text-amber-800"
                                    >
                                      Déjà dans la campagne (relance)
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {recipients.length} adhérent(s) avec adresse enregistrée
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historique" className="mt-0 space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadCampaigns}
                  disabled={loadingHistory}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loadingHistory ? "animate-spin" : ""}`} />
                  Actualiser
                </Button>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">
                  Aucune campagne pour le moment. Créez un courrier puis exportez-le.
                </p>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {c.objet}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(c.createdAt)} · {c.createdByName} · {c.lieu}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px]">
                              {c.totalRecipients} destinataire{c.totalRecipients > 1 ? "s" : ""}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {c.totalEnvois} envoi{c.totalEnvois > 1 ? "s" : ""}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${STATUS_BADGE.Repondu}`}
                            >
                              {c.reponsesCount} réponse{c.reponsesCount > 1 ? "s" : ""}
                            </Badge>
                            {c.relancesCount > 0 && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${STATUS_BADGE.Relance}`}
                              >
                                {c.relancesCount} relance{c.relancesCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openCampaignDetail(c.id)}
                          className="shrink-0"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Voir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Détail de la campagne
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !campaignDetail ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-lg">{campaignDetail.objet}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Créée le {formatDate(campaignDetail.createdAt)} par{" "}
                  {campaignDetail.createdByName} · Lieu : {campaignDetail.lieu}
                </p>
              </div>

              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Contenu de la lettre (historisé)
                </p>
                <p className="text-sm">
                  <span className="font-medium">Objet :</span> {campaignDetail.objet}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lieu / date : {campaignDetail.lieu}
                </p>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert text-sm border-t border-slate-200 dark:border-slate-700 pt-2 mt-1"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(campaignDetail.corps || "", {
                      ALLOWED_TAGS: [
                        "p",
                        "br",
                        "strong",
                        "em",
                        "u",
                        "span",
                        "ul",
                        "ol",
                        "li",
                        "h1",
                        "h2",
                        "h3",
                      ],
                      ALLOWED_ATTR: ["style"],
                    }),
                  }}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Destinataires ({campaignDetail.recipients.length})
                </p>
                {campaignDetail.recipients.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {r.civilite} {r.prenom} {r.nom}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.adresseLigne1}
                          {r.codePostal || r.ville
                            ? ` — ${[r.codePostal, r.ville].filter(Boolean).join(" ")}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[r.statut]}`}>
                          {STATUS_LABELS[r.statut] || r.statut}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {r.sendCount} envoi{r.sendCount > 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Premier envoi : {formatDate(r.sentAt)} · Dernier :{" "}
                      {formatDate(r.lastSentAt)} · Format : {r.format.toUpperCase()}
                    </p>
                    <div>
                      <Label className="text-xs flex items-center gap-1 mb-1">
                        <MessageSquare className="h-3 w-3" />
                        Réponse / retour de l&apos;adhérent
                      </Label>
                      <Textarea
                        rows={2}
                        value={responseDrafts[r.id] ?? ""}
                        onChange={(e) =>
                          setResponseDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        placeholder="Saisir le retour reçu (courrier, appel, email…)"
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={savingResponseId === r.id}
                        onClick={() => saveResponse(r.id)}
                      >
                        {savingResponseId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : null}
                        Enregistrer la réponse
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={deletingCampaign}
                  onClick={handleDeleteCampaign}
                >
                  {deletingCampaign ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Supprimer
                </Button>
                <Button type="button" onClick={() => continueCampaign(campaignDetail)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Relancer / ajouter destinataires
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
